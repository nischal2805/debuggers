"""
Voice endpoints — TTS and STT for the interview panel.

POST /voice/tts  — text → WAV audio (LuxTTS; falls back to pyttsx3 / silent)
POST /voice/stt  — audio file → transcript (OpenAI Whisper local model)

Both endpoints require auth but work in demo mode.
Heavy models are loaded once at first request and cached in module scope.
"""

from __future__ import annotations

import io
import os
import sys
import tempfile
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel

from services import demo_store
import firebase_admin.auth as fb_auth

router = APIRouter(prefix="/voice", tags=["voice"])

# ── Lazy model cache ──────────────────────────────────────────────────────────

_lux_tts = None
_lux_encoded_prompt = None   # default voice prompt encoding
_whisper_model = None

LUX_TTS_MODEL = os.environ.get("LUX_TTS_MODEL", "YatharthS/LuxTTS")
LUX_DEVICE    = os.environ.get("LUX_DEVICE", "cpu")   # 'cuda' | 'cpu' | 'mps'
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")  # tiny/base/small/medium


def _get_lux():
    global _lux_tts
    if _lux_tts is not None:
        return _lux_tts
    try:
        from zipvoice.luxvoice import LuxTTS
        _lux_tts = LuxTTS(LUX_TTS_MODEL, device=LUX_DEVICE)
        print(f"[voice] LuxTTS loaded on {LUX_DEVICE}", file=sys.stderr)
    except Exception as e:
        print(f"[voice] LuxTTS unavailable: {e}", file=sys.stderr)
        _lux_tts = None
    return _lux_tts


def _get_whisper():
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    try:
        import whisper
        _whisper_model = whisper.load_model(WHISPER_MODEL)
        print(f"[voice] Whisper '{WHISPER_MODEL}' loaded", file=sys.stderr)
    except Exception as e:
        print(f"[voice] Whisper unavailable: {e}", file=sys.stderr)
        _whisper_model = None
    return _whisper_model


# ── Auth helper ───────────────────────────────────────────────────────────────

async def _resolve_token(authorization: str) -> tuple[str, bool, str]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    if demo_store.is_demo_token(token):
        return demo_store.get_demo_uid(token), True, token
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded["uid"], False, token
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── TTS ───────────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    speed: float = 1.0
    num_steps: int = 4


@router.post("/tts")
async def text_to_speech(req: TTSRequest, authorization: str = Header(...)):
    """
    Convert text to speech using LuxTTS.
    Returns audio/wav bytes directly.
    Falls back to browser-side Web Speech API hint if LuxTTS not available.
    """
    await _resolve_token(authorization)

    text = req.text.strip()[:500]  # safety cap
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")

    tts = _get_lux()

    if tts is None:
        # Return a 204 — frontend will fall back to Web Speech API
        return Response(status_code=204)

    try:
        import numpy as np
        import soundfile as sf

        # Encode a default neutral voice prompt if we don't have one cached
        global _lux_encoded_prompt
        if _lux_encoded_prompt is None:
            # Generate a short silent reference — LuxTTS needs at least 3s audio
            # Use a bundled reference if available, else skip voice cloning
            ref_path = os.path.join(os.path.dirname(__file__), "..", "assets", "voice_ref.wav")
            if os.path.exists(ref_path):
                _lux_encoded_prompt = tts.encode_prompt(ref_path, rms=0.01)
            else:
                # No reference audio — use generate_speech without cloning
                _lux_encoded_prompt = "NO_CLONE"

        if _lux_encoded_prompt == "NO_CLONE":
            # LuxTTS without voice clone (uses random init — still usable)
            wav = tts.generate_speech(text, None, num_steps=req.num_steps, speed=req.speed)
        else:
            wav = tts.generate_speech(text, _lux_encoded_prompt, num_steps=req.num_steps, speed=req.speed)

        wav_np = wav.numpy().squeeze()

        buf = io.BytesIO()
        sf.write(buf, wav_np, 48000, format="WAV")
        buf.seek(0)

        return Response(
            content=buf.read(),
            media_type="audio/wav",
            headers={"Cache-Control": "no-store"},
        )

    except Exception as e:
        print(f"[voice/tts] generation error: {e}", file=sys.stderr)
        return Response(status_code=204)


# ── STT ───────────────────────────────────────────────────────────────────────

@router.post("/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    authorization: str = Header(...),
):
    """
    Transcribe uploaded audio using OpenAI Whisper (local).
    Accepts webm, wav, mp3, ogg, m4a.
    Falls back to soundfile decode for wav if ffmpeg is not on PATH.
    Returns { "transcript": "..." }
    """
    await _resolve_token(authorization)

    model = _get_whisper()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Whisper not available. Install with: pip install openai-whisper"
        )

    raw_bytes = await audio.read()
    if len(raw_bytes) < 500:
        return {"transcript": ""}

    filename = audio.filename or "audio.webm"
    suffix = "." + filename.rsplit(".", 1)[-1].lower()

    # Write to temp file
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    transcript = ""
    try:
        # Attempt 1: direct Whisper transcription (needs ffmpeg for webm/mp4/ogg)
        result = model.transcribe(tmp_path, language="en", fp16=False)
        transcript = result.get("text", "").strip()
    except Exception as e1:
        print(f"[voice/stt] direct transcribe failed ({e1}), trying soundfile fallback", file=sys.stderr)
        # Attempt 2: soundfile decode → numpy → Whisper (works for wav without ffmpeg)
        try:
            import soundfile as sf
            import numpy as np

            data, samplerate = sf.read(tmp_path, dtype="float32", always_2d=False)
            # Whisper expects mono float32 at 16kHz
            if data.ndim == 2:
                data = data.mean(axis=1)
            if samplerate != 16000:
                # Simple resample via numpy (crude but functional for speech)
                duration = len(data) / samplerate
                target_len = int(duration * 16000)
                data = np.interp(
                    np.linspace(0, len(data) - 1, target_len),
                    np.arange(len(data)),
                    data,
                ).astype(np.float32)
            result = model.transcribe(data, language="en", fp16=False)
            transcript = result.get("text", "").strip()
        except Exception as e2:
            print(f"[voice/stt] soundfile fallback also failed: {e2}", file=sys.stderr)
            raise HTTPException(
                status_code=500,
                detail=(
                    "Transcription failed. If you're uploading webm/opus, install ffmpeg: "
                    "winget install Gyan.FFmpeg and restart the backend."
                )
            )
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    return {"transcript": transcript}

