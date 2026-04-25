import { useState, useRef, useCallback, useEffect } from 'react'
import { auth } from '../firebase'
import type {
  SessionMessage,
  TutorResponse,
  EvaluationResult,
  AgentMode,
  ReportCard,
  PriorityQueueEntry,
  ReadinessSnapshot,
} from '../lib/types'
import { useStore } from '../store/useStore'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const ALLOWED_TYPES = new Set([
  'question', 'hint', 'explanation', 'feedback',
  'celebration', 'topic_transition', 'prereq_intervention', 'session_summary',
])
const ALLOWED_ANSWER_TYPES = new Set(['code', 'text', 'multiple_choice', 'complexity'])
const PROACTIVE_HINT_MS = 45_000

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
  const [agentMode, setAgentMode] = useState<AgentMode | string | null>(null)
  const [agentModeReason, setAgentModeReason] = useState<string | null>(null)
  const [reportCard, setReportCard] = useState<ReportCard | null>(null)
  const [proactiveHintReady, setProactiveHintReady] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const answerStartTime = useRef<number>(Date.now())
  const firstInputTime = useRef<number | null>(null)
  const proactiveHintTimer = useRef<number | null>(null)
  const authRetryCountRef = useRef(0)

  const {
    updateTopicMastery,
    knowledgeModel,
    pushAgentLog,
    setCurrentMode,
    pushAnswer,
    setReadiness,
    setPriorityQueue,
    setReviewDue,
    setLastReport,
    resetSessionLayer,
  } = useStore()

  const tryParseJson = (value: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }

  const extractContentFromJsonLike = (value: string): string | null => {
    const match = value.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
    if (!match) return null
    try {
      return JSON.parse(`"${match[1]}"`) as string
    } catch {
      return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
    }
  }

  const normalizeTutorPayload = (input: unknown) => {
    const payload = (input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : {}) as Record<string, unknown>
    let nested: Record<string, unknown> | null = null
    const content = payload.content
    if (content && typeof content === 'object') {
      nested = content as Record<string, unknown>
    } else if (typeof content === 'string') {
      const trimmed = content.trim()
      if (trimmed.startsWith('{') && trimmed.includes('"content"')) {
        nested = tryParseJson(trimmed)
        if (!nested) {
          const extracted = extractContentFromJsonLike(trimmed)
          if (extracted) payload.content = extracted
        }
      }
    }
    if (nested) {
      for (const key of [
        'type', 'content', 'code_snippet', 'expected_answer_type', 'options',
        'difficulty_level', 'pattern_name', 'prereq_gap', 'session_summary',
        'evaluation', 'internal_note', 'next_action',
      ]) {
        if (nested[key] !== undefined && nested[key] !== null) payload[key] = nested[key]
      }
    }
    if (typeof payload.content !== 'string') payload.content = 'Let us continue.'
    if (typeof payload.type !== 'string' || !ALLOWED_TYPES.has(payload.type as string)) payload.type = 'explanation'
    if (typeof payload.expected_answer_type !== 'string' || !ALLOWED_ANSWER_TYPES.has(payload.expected_answer_type as string)) {
      payload.expected_answer_type = 'text'
    }
    const difficulty = Number(payload.difficulty_level)
    payload.difficulty_level = Number.isFinite(difficulty) ? Math.max(1, Math.min(10, Math.trunc(difficulty))) : 3
    if (!('next_action' in payload)) payload.next_action = 'wait_for_answer'
    return payload as unknown as TutorResponse
  }

  const clearProactiveTimer = useCallback(() => {
    if (proactiveHintTimer.current !== null) {
      window.clearTimeout(proactiveHintTimer.current)
      proactiveHintTimer.current = null
    }
    setProactiveHintReady(false)
  }, [])

  const armProactiveTimer = useCallback(() => {
    clearProactiveTimer()
    proactiveHintTimer.current = window.setTimeout(() => {
      setProactiveHintReady(true)
    }, PROACTIVE_HINT_MS)
  }, [clearProactiveTimer])

  const connect = useCallback(async () => {
    const { isDemoMode, demoToken } = useStore.getState()

    let token: string
    if (isDemoMode && demoToken) {
      token = demoToken
    } else {
      if (!auth) {
        // Firebase not initialized, skip connection
        return
      }
      const firebaseUser = auth.currentUser
      if (!firebaseUser) {
        if (authRetryCountRef.current < 10) {
          authRetryCountRef.current += 1
          window.setTimeout(() => { void connect() }, 300)
        }
        return
      }
      authRetryCountRef.current = 0
      token = await firebaseUser.getIdToken()
    }

    const wsUrl = BACKEND_URL.replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsUrl}/session/stream?token=${token}&topic=${topicId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      resetSessionLayer()
      ws.send(JSON.stringify({ action: 'start_topic', topic: topicId }))
    }

    ws.onmessage = (event) => {
      let data: any
      try { data = JSON.parse(event.data) } catch { return }

      switch (data.type) {
        case 'agent_mode': {
          const mode = data.mode as AgentMode
          setAgentMode(mode)
          setAgentModeReason(data.reason)
          setCurrentMode(mode, data.reason)
          pushAgentLog({
            mode,
            reason: data.reason,
            description: data.description,
            ts: Date.now(),
          })
          break
        }
        case 'chunk':
          setStreamBuffer(prev => prev + (data.text || ''))
          setStreaming(true)
          break
        case 'response': {
          const tutor = normalizeTutorPayload(data.data)
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
          if (tutor.session_summary) setSessionSummary(tutor.session_summary)
          answerStartTime.current = Date.now()
          firstInputTime.current = null
          setEvaluation(null)
          armProactiveTimer()
          break
        }
        case 'evaluation': {
          const evalObj: EvaluationResult = {
            correct: data.correct,
            partial_credit: data.partial_credit,
            feedback: data.feedback,
            errors: data.errors || [],
            hint_for_retry: data.hint_for_retry || null,
            error_fingerprint: data.error_fingerprint ?? null,
            optimality_score: data.optimality_score ?? null,
          }
          setEvaluation(evalObj)
          pushAnswer({
            topic: activeTopic,
            correct: !!data.correct,
            ts: Date.now(),
          })
          break
        }
        case 'mastery_update':
          updateTopicMastery(data.topic, {
            knowledge: data.knowledge ?? data.mastery,
            mastery: data.knowledge ?? data.mastery,
            confidence: data.confidence,
            speed: data.speed,
            consistency: data.consistency,
            patternRecognition: data.patternRecognition,
          })
          break
        case 'topic_change':
          setActiveTopic(data.new_topic)
          setPrereqGap({
            previousTopic: data.previous_topic,
            newTopic: data.new_topic,
            reason: data.reason,
            prereqStack: data.prereq_stack || [],
          })
          break
        case 'readiness_update':
          if (data.snapshot) {
            setReadiness(data.snapshot as ReadinessSnapshot, data.calibration_gap ?? 0)
          }
          break
        case 'priority_queue':
          setPriorityQueue((data.queue ?? []) as PriorityQueueEntry[], data.explanation)
          break
        case 'review_due':
          setReviewDue(data.topics ?? [])
          break
        case 'report_card':
          setReportCard(data.report as ReportCard)
          setLastReport(data.report as ReportCard)
          break
        case 'session_ended':
          setSessionEnded(true)
          setConnected(false)
          clearProactiveTimer()
          break
        case 'error':
          setStreaming(false)
          setConnected(false)
          setMessages(prev => [...prev, {
            role: 'tutor',
            content: typeof data.message === 'string' ? data.message : 'Connection error. Please restart the session.',
            type: 'explanation',
            timestamp: Date.now(),
          }])
          break
      }
    }

    ws.onclose = () => {
      setConnected(false)
      setStreaming(false)
      clearProactiveTimer()
    }
    ws.onerror = () => {
      setConnected(false)
      setStreaming(false)
      clearProactiveTimer()
    }
  }, [
    topicId, updateTopicMastery, pushAgentLog, setCurrentMode, pushAnswer,
    setReadiness, setPriorityQueue, setReviewDue, setLastReport, resetSessionLayer,
    armProactiveTimer, clearProactiveTimer, activeTopic,
  ])

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [connect])

  const noteFirstInput = useCallback(() => {
    if (firstInputTime.current === null) {
      firstInputTime.current = Date.now()
    }
  }, [])

  const sendAnswer = useCallback((answer: string, thoughtTrace?: string) => {
    const timeMs = Date.now() - answerStartTime.current
    const firstInputMs = firstInputTime.current
      ? firstInputTime.current - answerStartTime.current
      : 0
    setMessages(prev => [...prev, {
      role: 'user',
      content: answer,
      timestamp: Date.now(),
    }])
    setEvaluation(null)
    clearProactiveTimer()
    wsRef.current?.send(JSON.stringify({
      action: 'answer',
      answer,
      time_ms: timeMs,
      first_input_ms: firstInputMs,
      thought_trace: thoughtTrace ?? null,
    }))
    answerStartTime.current = Date.now()
    firstInputTime.current = null
  }, [clearProactiveTimer])

  const sendLearnerQuery = useCallback((query: string) => {
    const cleaned = query.trim()
    if (!cleaned) return
    setMessages(prev => [...prev, {
      role: 'user',
      content: cleaned,
      timestamp: Date.now(),
    }])
    wsRef.current?.send(JSON.stringify({ action: 'learner_query', query: cleaned }))
  }, [])

  const requestHint = useCallback(() => {
    setProactiveHintReady(false)
    wsRef.current?.send(JSON.stringify({ action: 'hint_request' }))
  }, [])

  const endSession = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: 'end' }))
    setTimeout(() => wsRef.current?.close(), 800)
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
    agentMode,
    agentModeReason,
    reportCard,
    proactiveHintReady,
    sendAnswer,
    sendLearnerQuery,
    requestHint,
    endSession,
    dismissPrereqGap,
    noteFirstInput,
    currentMastery: knowledgeModel?.topics[activeTopic]?.knowledge
      ?? knowledgeModel?.topics[activeTopic]?.mastery ?? 0,
  }
}
