/**
 * useVoice — TTS + STT integration for the interview panel.
 *
 * TTS: sends text to /voice/tts (LuxTTS), plays WAV.
 *      Falls back to Web Speech API (SpeechSynthesis) if backend returns 204.
 * STT: records from mic via MediaRecorder, sends webm blob to /voice/stt (Whisper),
 *      returns transcript string.
 */

import { useRef, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { auth } from '../firebase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

async function getToken(isDemoMode: boolean, demoToken: string | null): Promise<string | null> {
  if (isDemoMode && demoToken) return demoToken
  if (!auth) return null
  return auth.currentUser?.getIdToken() ?? null
}

export function useVoice() {
  const { isDemoMode, demoToken } = useStore()

  // STT state
  const [isRecording, setIsRecording] = useState(false)
  const [sttLoading, setSttLoading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // TTS state
  const [ttsLoading, setTtsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ── TTS ─────────────────────────────────────────────────────────────────────

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setTtsLoading(true)
    const token = await getToken(isDemoMode, demoToken)

    if (token) {
      try {
        const r = await fetch(`${BACKEND_URL}/voice/tts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, speed: 1.0, num_steps: 4 }),
        })

        if (r.status === 200) {
          const blob = await r.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            URL.revokeObjectURL(url)
            audioRef.current = null
            setTtsLoading(false)
          }
          audio.onerror = () => {
            URL.revokeObjectURL(url)
            audioRef.current = null
            setTtsLoading(false)
            _webSpeechFallback(text)
          }
          await audio.play()
          return
        }
      } catch {
        // fall through to Web Speech API
      }
    }

    // Web Speech API fallback
    _webSpeechFallback(text)
    setTtsLoading(false)
  }, [isDemoMode, demoToken])

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    setTtsLoading(false)
  }, [])

  // ── STT ─────────────────────────────────────────────────────────────────────

  const startRecording = useCallback(async (): Promise<void> => {
    if (isRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []

      // Pick best supported mimeType
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find(t => MediaRecorder.isTypeSupported(t)) || ''

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      mediaRecorderRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(100)
      setIsRecording(true)
    } catch (e) {
      console.error('[useVoice] mic error:', e)
    }
  }, [isRecording])

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise(resolve => {
      const mr = mediaRecorderRef.current
      if (!mr) { resolve(''); return }

      mr.onstop = async () => {
        // Stop all mic tracks
        mr.stream.getTracks().forEach(t => t.stop())
        setIsRecording(false)

        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        if (blob.size < 500) { resolve(''); return }

        setSttLoading(true)
        const token = await getToken(isDemoMode, demoToken)
        if (!token) { setSttLoading(false); resolve(''); return }

        try {
          // Convert to WAV via Web Audio API so backend doesn't need ffmpeg
          const arrayBuffer = await blob.arrayBuffer()
          const audioCtx = new AudioContext({ sampleRate: 16000 })
          const decoded = await audioCtx.decodeAudioData(arrayBuffer)
          audioCtx.close()

          const wavBlob = _audioBufferToWav(decoded)

          const form = new FormData()
          form.append('audio', wavBlob, 'recording.wav')
          const r = await fetch(`${BACKEND_URL}/voice/stt`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          })
          if (!r.ok) {
            const err = await r.json().catch(() => ({}))
            console.error('[useVoice] STT error response:', err.detail)
            resolve('')
            return
          }
          const data = await r.json()
          resolve(data.transcript ?? '')
        } catch (e) {
          console.error('[useVoice] STT error:', e)
          resolve('')
        } finally {
          setSttLoading(false)
        }
      }

      mr.stop()
    })
  }, [isDemoMode, demoToken])

  return {
    speak,
    stopSpeaking,
    ttsLoading,
    startRecording,
    stopRecording,
    isRecording,
    sttLoading,
  }
}

// ── WAV encoder ───────────────────────────────────────────────────────────────

/**
 * Encodes a Web Audio AudioBuffer as a PCM WAV Blob.
 * Always mono, 16kHz, 16-bit — exactly what Whisper wants.
 */
function _audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const format = 1  // PCM
  const bitDepth = 16

  // Mix down to mono
  const channelData = buffer.getChannelData(0)
  const numSamples = channelData.length
  const dataSize = numSamples * 2  // 16-bit = 2 bytes per sample
  const bufferSize = 44 + dataSize

  const out = new ArrayBuffer(bufferSize)
  const view = new DataView(out)

  // RIFF header
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)          // chunk size
  view.setUint16(20, format, true)      // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true)  // byte rate
  view.setUint16(32, numChannels * (bitDepth / 8), true)               // block align
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM samples — clamp float32 [-1,1] to int16
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([out], { type: 'audio/wav' })
}


function _webSpeechFallback(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()

  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'en-US'
  utt.rate = 0.95
  utt.pitch = 1.0

  // Ensure voices are loaded (they load async on first call)
  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices()

    // Filter to English-only voices
    const enVoices = voices.filter(v => v.lang.startsWith('en'))

    // Priority order: natural-sounding named voices
    const preferred = (
      enVoices.find(v => v.name === 'Google US English') ||
      enVoices.find(v => v.name.includes('Samantha')) ||
      enVoices.find(v => v.name.includes('Daniel') && v.lang.startsWith('en')) ||
      enVoices.find(v => v.name.includes('Karen')) ||
      enVoices.find(v => v.name.includes('Moira')) ||
      enVoices.find(v => v.lang === 'en-US') ||
      enVoices.find(v => v.lang === 'en-GB') ||
      enVoices[0]
    )

    if (preferred) utt.voice = preferred
    window.speechSynthesis.speak(utt)
  }

  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    doSpeak()
  } else {
    // Voices not loaded yet — wait for the event
    window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true })
  }
}
