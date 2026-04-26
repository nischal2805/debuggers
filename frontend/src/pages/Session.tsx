import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTutorSession } from '../hooks/useTutorSession'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { useStore } from '../store/useStore'
import { TOPIC_GRAPH, getMasteryColor } from '../lib/topics'
import TutorMessage from '../components/TutorMessage'
import HintButton from '../components/HintButton'
import CodeEditor from '../components/CodeEditor'
import DifficultyBadge from '../components/DifficultyBadge'
import ModeBadge from '../components/ModeBadge'
import AgentLogPanel from '../components/AgentLogPanel'
import HesitationRing from '../components/HesitationRing'
import ThoughtTraceInput from '../components/ThoughtTraceInput'
import ErrorFingerprintChip from '../components/ErrorFingerprintChip'
import ProactiveHintPrompt from '../components/ProactiveHintPrompt'
import AssessmentLevelBadge from '../components/AssessmentLevelBadge'
import ReportCardPanel from '../components/ReportCardPanel'
import MasteredCelebration from '../components/MasteredCelebration'
import NavBar from '../components/NavBar'

export default function Session() {
  const { topicId = 'arrays' } = useParams()
  const navigate = useNavigate()
  useKnowledgeModel()

  const {
    messages,
    streaming,
    connected,
    currentResponse,
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
    currentMastery,
  } = useTutorSession(topicId)

  const readiness = useStore(s => s.readiness)
  const reviewDue = useStore(s => s.reviewDue)

  const [textAnswer, setTextAnswer] = useState('')
  const [codeAnswer, setCodeAnswer] = useState('# Write your solution here\n')
  const [thoughtTrace, setThoughtTrace] = useState('')
  const [learnerQuery, setLearnerQuery] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [questionStart, setQuestionStart] = useState(Date.now())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    lastActivityRef.current = Date.now()
  }, [messages])

  useEffect(() => {
    if (currentResponse?.type === 'question') {
      setQuestionStart(Date.now())
      setThoughtTrace('')
    }
  }, [currentResponse])

  const answerType = currentResponse?.expected_answer_type ?? 'text'
  const topicLabel = TOPIC_GRAPH[topicId]?.label ?? topicId
  const activeTopicLabel = TOPIC_GRAPH[activeTopic]?.label ?? activeTopic
  const isPrereqMode = activeTopic !== topicId

  const handleSubmit = () => {
    const answer = answerType === 'code' ? codeAnswer : textAnswer
    if (!answer.trim()) return
    sendAnswer(answer, thoughtTrace || undefined)
    if (answerType !== 'code') setTextAnswer('')
    setThoughtTrace('')
  }

  const handleEnd = () => {
    endSession()
  }

  const handleAsk = () => {
    if (streaming || !connected || !learnerQuery.trim()) return
    sendLearnerQuery(learnerQuery)
    setLearnerQuery('')
  }

  if (sessionEnded && (reportCard || sessionSummary)) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-6 py-10 gap-6">
        {reportCard ? (
          <ReportCardPanel report={reportCard} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-6">Session complete</p>
            <h2 className="font-display text-2xl font-bold text-text-primary mb-2">{topicLabel}</h2>
            <div className="w-full h-1.5 rounded-full bg-bg-elevated mb-8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${currentMastery * 100}%`, background: getMasteryColor(currentMastery) }}
              />
            </div>
            {sessionSummary?.strengths?.map((s, i) => (
              <p key={i} className="font-body text-sm text-accent-success">— {s}</p>
            ))}
            {sessionSummary?.gaps?.map((g, i) => (
              <p key={i} className="font-body text-sm text-accent-warn">— {g}</p>
            ))}
          </motion.div>
        )}
        <div className="flex gap-3 w-full max-w-xl">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 py-3 bg-bg-elevated border border-border font-body text-sm text-text-secondary rounded-lg hover:text-text-primary transition-colors"
          >
            dashboard
          </button>
          <button
            onClick={() => {
              const next = reportCard?.next_focus?.[0]?.split(':')[0]?.trim()
              navigate(`/session/${next || activeTopic || topicId}`)
              window.location.reload()
            }}
            className="flex-1 py-3 bg-accent-primary font-body text-sm text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
          >
            next session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <MasteredCelebration />
      <NavBar active="/session" interviewTopic={topicId} />

      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-surface/60">
        <div className="flex items-center gap-3">
          <button onClick={handleEnd} className="text-text-secondary hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-body text-text-secondary text-sm">/</span>
          <span className="font-body text-text-primary text-sm font-medium">
            {isPrereqMode ? (
              <>
                <span className="text-text-secondary line-through">{topicLabel}</span>
                <span className="mx-1.5 text-text-secondary">→</span>
                <span className="text-accent-warn">{activeTopicLabel}</span>
              </>
            ) : topicLabel}
          </span>
          <AssessmentLevelBadge knowledge={currentMastery} compact />
        </div>
        <div className="flex items-center gap-3">
          <ModeBadge mode={agentMode} reason={agentModeReason} compact />
          {currentResponse && <DifficultyBadge level={currentResponse.difficulty_level} />}
          {currentResponse?.pattern_name && (
            <span className="font-body text-[10px] text-accent-secondary border border-accent-secondary/30 rounded px-1.5 py-0.5">
              {currentResponse.pattern_name}
            </span>
          )}
          <div className="flex items-center gap-2">
            <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden" style={{ width: 80 }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${currentMastery * 100}%`, background: getMasteryColor(currentMastery) }}
              />
            </div>
            <span className="font-body text-[10px] text-text-secondary">{Math.round(currentMastery * 100)}%</span>
          </div>
          <span className="font-body text-[10px] text-text-secondary border-l border-border pl-2 ml-1">
            ready {Math.round(readiness?.total ?? 0)}
          </span>
          <button
            onClick={() => setShowLog(s => !s)}
            className="font-body text-[10px] text-text-secondary hover:text-accent-secondary uppercase tracking-wider"
          >
            {showLog ? 'hide log' : 'agent log'}
          </button>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-success' : 'bg-accent-danger'} transition-colors`} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-6 py-6">

          {reviewDue.length > 0 && (
            <div className="mb-3 p-2 px-3 rounded-md bg-accent-warn/5 border border-accent-warn/20 flex items-center gap-2 text-xs">
              <span className="font-body text-accent-warn uppercase tracking-wider text-[10px]">review due</span>
              <span className="font-body text-text-secondary">
                {reviewDue.slice(0, 3).map(t => TOPIC_GRAPH[t]?.label ?? t).join(', ')}
                {reviewDue.length > 3 ? ` +${reviewDue.length - 3}` : ''}
              </span>
            </div>
          )}

          <ProactiveHintPrompt
            open={proactiveHintReady}
            onAccept={requestHint}
            onDismiss={() => { /* state cleared on next interaction */ }}
          />

          <AnimatePresence>
            {prereqGap && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mb-4 p-4 bg-accent-warn/10 border border-accent-warn/30 rounded-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-xs text-accent-warn uppercase tracking-wider mb-1">
                      prerequisite gap detected
                    </p>
                    <p className="font-body text-sm text-text-primary">{prereqGap.reason}</p>
                    <p className="font-body text-xs text-text-secondary mt-1">
                      Teaching <span className="text-accent-warn">{TOPIC_GRAPH[prereqGap.newTopic]?.label ?? prereqGap.newTopic}</span> first.
                      Will return to <span className="text-text-primary">{TOPIC_GRAPH[prereqGap.previousTopic]?.label ?? prereqGap.previousTopic}</span> once mastered.
                    </p>
                  </div>
                  <button
                    onClick={dismissPrereqGap}
                    className="text-text-secondary hover:text-text-primary transition-colors flex-shrink-0 mt-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {evaluation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mb-4 px-4 py-3 rounded-lg border font-body text-sm ${
                  evaluation.correct
                    ? 'bg-accent-success/10 border-accent-success/30 text-accent-success'
                    : evaluation.partial_credit > 0.4
                    ? 'bg-accent-warn/10 border-accent-warn/30 text-accent-warn'
                    : 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase tracking-wider">
                    {evaluation.correct ? 'correct' : evaluation.partial_credit > 0.4 ? 'partial' : 'incorrect'}
                  </span>
                  {!evaluation.correct && evaluation.partial_credit > 0 && (
                    <span className="text-xs text-text-secondary">({Math.round(evaluation.partial_credit * 100)}% credit)</span>
                  )}
                </div>
                <p className="text-text-primary text-xs">{evaluation.feedback}</p>
                {evaluation.hint_for_retry && (
                  <p className="text-text-secondary text-xs mt-1">Hint: {evaluation.hint_for_retry}</p>
                )}
                <ErrorFingerprintChip
                  fingerprint={evaluation.error_fingerprint}
                  optimality={evaluation.optimality_score}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 mb-6">
            {messages.length === 0 && !streaming && (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="font-body text-text-secondary text-sm mt-3">
                  {connected ? 'Starting session...' : 'Connecting...'}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <TutorMessage
                key={i}
                message={msg}
                difficultyLevel={msg.role === 'tutor' && i === messages.length - 1 ? currentResponse?.difficulty_level : undefined}
              />
            ))}

            {streaming && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="max-w-[80%] bg-bg-elevated border border-border rounded-lg px-4 py-3">
                  <p className="font-body text-sm text-text-secondary">thinking...</p>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {currentResponse?.code_snippet && (
            <div className="mb-4 bg-bg-elevated border border-border rounded-lg p-3">
              <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-2">starter</p>
              <pre className="font-code text-sm text-text-primary overflow-x-auto">{currentResponse.code_snippet}</pre>
            </div>
          )}

          {answerType === 'multiple_choice' && currentResponse?.options && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {currentResponse.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => { noteFirstInput(); sendAnswer(opt, thoughtTrace || undefined) }}
                  className="text-left p-3 bg-bg-elevated border border-border rounded-lg hover:border-accent-primary/50 font-body text-sm text-text-primary transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {answerType === 'code' && (
            <div className="mb-3" onKeyDown={() => noteFirstInput()}>
              <CodeEditor value={codeAnswer} onChange={(v) => { noteFirstInput(); setCodeAnswer(v ?? '') }} height={180} />
            </div>
          )}

          {currentResponse?.type === 'question' && (
            <ThoughtTraceInput
              value={thoughtTrace}
              onChange={(v) => { noteFirstInput(); setThoughtTrace(v) }}
              disabled={streaming}
            />
          )}

          <div className="flex gap-3 items-center">
            {(answerType === 'text' || answerType === 'complexity') && (
              <input
                type="text"
                value={textAnswer}
                onChange={e => { noteFirstInput(); setTextAnswer(e.target.value) }}
                onKeyDown={e => e.key === 'Enter' && !streaming && handleSubmit()}
                placeholder={answerType === 'complexity' ? 'e.g. O(n log n)' : 'Your answer...'}
                className="flex-1 bg-bg-elevated border border-border rounded-lg px-4 py-2.5 font-body text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-primary/50"
              />
            )}
            {answerType === 'code' && <div className="flex-1" />}

            <HesitationRing startAt={questionStart} threshold={45_000} active={!streaming && !!currentResponse} />

            <HintButton
              onHint={requestHint}
              lastActivityTime={lastActivityRef.current}
              disabled={streaming}
            />

            <button
              onClick={handleSubmit}
              disabled={streaming || !connected}
              className="px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-body text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              submit
            </button>
          </div>

          <div className="flex gap-3 mt-3">
            <input
              type="text"
              value={learnerQuery}
              onChange={e => setLearnerQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder="Ask the tutor anything about this topic..."
              className="flex-1 bg-bg-elevated border border-border rounded-lg px-4 py-2.5 font-body text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-secondary/50"
            />
            <button
              onClick={handleAsk}
              disabled={streaming || !connected || !learnerQuery.trim()}
              className="px-4 py-2.5 bg-accent-secondary/80 hover:bg-accent-secondary text-bg-primary font-body text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ask
            </button>
          </div>
        </div>

        {showLog && (
          <aside className="w-80 border-l border-border bg-bg-surface px-5 py-6 overflow-y-auto scrollbar-thin">
            <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-4">agent reasoning</p>
            <AgentLogPanel />
          </aside>
        )}
      </div>
    </div>
  )
}
