import { useState, useRef, useCallback, useEffect } from 'react'
import { auth } from '../firebase'
import type { SessionMessage, TutorResponse } from '../lib/types'
import { useStore } from '../store/useStore'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export interface EvaluationResult {
  correct: boolean
  partial_credit: number
  feedback: string
  errors: string[]
  hint_for_retry: string | null
}

export interface PrereqGapEvent {
  previousTopic: string
  newTopic: string
  reason: string
  prereqStack: string[]
}

export interface SessionSummary {
  strengths: string[]
  gaps: string[]
  next_recommended: string | null
}

export function useTutorSession(topicId: string) {
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const [currentResponse, setCurrentResponse] = useState<TutorResponse | null>(null)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)
  const [prereqGap, setPrereqGap] = useState<PrereqGapEvent | null>(null)
  const [activeTopic, setActiveTopic] = useState(topicId)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const answerStartTime = useRef<number>(Date.now())
  const { updateTopicMastery, knowledgeModel } = useStore()

  const connect = useCallback(async () => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) return

    const token = await firebaseUser.getIdToken()
    const wsUrl = BACKEND_URL.replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsUrl}/session/stream?token=${token}&topic=${topicId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ action: 'start_topic', topic: topicId }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'chunk') {
        setStreamBuffer(prev => prev + (data.text || ''))
        setStreaming(true)
      } else if (data.type === 'response') {
        const tutor = data.data as TutorResponse & {
          _agent_action?: string
          _active_topic?: string
          session_summary?: SessionSummary
        }
        setCurrentResponse(tutor)
        setStreamBuffer('')
        setStreaming(false)
        if (tutor._active_topic) setActiveTopic(tutor._active_topic)
        setMessages(prev => [...prev, {
          role: 'tutor',
          content: tutor.content,
          type: tutor.type,
          timestamp: Date.now(),
        }])
        if (tutor.session_summary) {
          setSessionSummary(tutor.session_summary)
        }
        answerStartTime.current = Date.now()
        setEvaluation(null)
      } else if (data.type === 'evaluation') {
        setEvaluation({
          correct: data.correct,
          partial_credit: data.partial_credit,
          feedback: data.feedback,
          errors: data.errors || [],
          hint_for_retry: data.hint_for_retry || null,
        })
      } else if (data.type === 'mastery_update') {
        updateTopicMastery(data.topic, data.mastery, data.confidence)
      } else if (data.type === 'topic_change') {
        setActiveTopic(data.new_topic)
        setPrereqGap({
          previousTopic: data.previous_topic,
          newTopic: data.new_topic,
          reason: data.reason,
          prereqStack: data.prereq_stack || [],
        })
      } else if (data.type === 'session_ended') {
        setSessionEnded(true)
        setConnected(false)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      setStreaming(false)
    }

    ws.onerror = () => {
      setConnected(false)
      setStreaming(false)
    }
  }, [topicId, updateTopicMastery])

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [connect])

  const sendAnswer = useCallback((answer: string) => {
    const timeMs = Date.now() - answerStartTime.current
    setMessages(prev => [...prev, {
      role: 'user',
      content: answer,
      timestamp: Date.now(),
    }])
    setEvaluation(null)
    wsRef.current?.send(JSON.stringify({ action: 'answer', answer, time_ms: timeMs }))
    answerStartTime.current = Date.now()
  }, [])

  const requestHint = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: 'hint_request' }))
  }, [])

  const endSession = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: 'end' }))
    wsRef.current?.close()
  }, [])

  const dismissPrereqGap = useCallback(() => setPrereqGap(null), [])

  return {
    messages,
    streaming,
    connected,
    currentResponse,
    streamBuffer,
    evaluation,
    prereqGap,
    activeTopic,
    sessionEnded,
    sessionSummary,
    sendAnswer,
    requestHint,
    endSession,
    dismissPrereqGap,
    currentMastery: knowledgeModel?.topics[activeTopic]?.mastery ?? 0,
  }
}
