import { useRef, useCallback } from 'react'

export interface AttemptLog {
  approach_written: boolean
  approach_text: string
  approach_time_ms: number
  first_keystroke_ms: number
  num_runs: number
  hints_requested: number
  total_time_ms: number
}

export function useAttemptTracker() {
  const startedAt = useRef<number>(Date.now())
  const firstKeystrokeAt = useRef<number | null>(null)
  const approachStartedAt = useRef<number | null>(null)
  const approachText = useRef<string>('')
  const numRuns = useRef<number>(0)
  const hintsRequested = useRef<number>(0)

  const reset = useCallback(() => {
    startedAt.current = Date.now()
    firstKeystrokeAt.current = null
    approachStartedAt.current = null
    approachText.current = ''
    numRuns.current = 0
    hintsRequested.current = 0
  }, [])

  const noteFirstKeystroke = useCallback(() => {
    if (firstKeystrokeAt.current === null) {
      firstKeystrokeAt.current = Date.now()
    }
  }, [])

  const noteApproachStart = useCallback(() => {
    if (approachStartedAt.current === null) {
      approachStartedAt.current = Date.now()
    }
  }, [])

  const setApproachText = useCallback((text: string) => {
    approachText.current = text
    if (text.length > 0 && approachStartedAt.current === null) {
      approachStartedAt.current = Date.now()
    }
  }, [])

  const noteRun = useCallback(() => {
    numRuns.current += 1
  }, [])

  const noteHint = useCallback(() => {
    hintsRequested.current += 1
  }, [])

  const getLog = useCallback((): AttemptLog => {
    const now = Date.now()
    const elapsed = now - startedAt.current
    return {
      approach_written: approachText.current.trim().length > 10,
      approach_text: approachText.current.trim(),
      approach_time_ms: approachStartedAt.current
        ? (firstKeystrokeAt.current ?? now) - approachStartedAt.current
        : 0,
      first_keystroke_ms: firstKeystrokeAt.current
        ? firstKeystrokeAt.current - startedAt.current
        : 0,
      num_runs: numRuns.current,
      hints_requested: hintsRequested.current,
      total_time_ms: elapsed,
    }
  }, [])

  return { reset, noteFirstKeystroke, noteApproachStart, setApproachText, noteRun, noteHint, getLog }
}
