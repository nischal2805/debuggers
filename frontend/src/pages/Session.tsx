import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTutorSession } from '../hooks/useTutorSession'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { TOPIC_GRAPH, getMasteryColor } from '../lib/topics'
import TutorMessage from '../components/TutorMessage'
import HintButton from '../components/HintButton'
import CodeEditor from '../components/CodeEditor'
import DifficultyBadge from '../components/DifficultyBadge'

export default function Session() {
  const { topicId = 'arrays' } = useParams()
  const navigate = useNavigate()
  useKnowledgeModel()

  const {
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
    currentMastery,
  } = useTutorSession(topicId)

  const [textAnswer, setTextAnswer] = useState('')
  const [codeAnswer, setCodeAnswer] = useState('# Write your solution here\n')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    lastActivityRef.current = Date.now()
  }, [messages])

  const answerType = currentResponse?.expected_answer_type ?? 'text'
  const topicLabel = TOPIC_GRAPH[topicId]?.label ?? topicId
  const activeTopicLabel = TOPIC_GRAPH[activeTopic]?.label ?? activeTopic
  const isPrereqMode = activeTopic !== topicId

  const handleSubmit = () => {
    const answer = answerType === 'code' ? codeAnswer : textAnswer
    if (!answer.trim()) return
    sendAnswer(answer)
    if (answerType !== 'code') setTextAnswer('')
  }

  const handleEnd = () => {
    endSession()
    navigate('/dashboard')
  }

  if (sessionEnded && sessionSummary) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-6">Session complete</p>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-2">{topicLabel}</h2>
          <div
            className="w-full h-1.5 rounded-full bg-bg-elevated mb-8 overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${currentMastery * 100}%`, background: getMasteryColor(currentMastery) }}
            />
          </div>

          {sessionSummary.strengths.length > 0 && (
            <div className="mb-4">
              <p className="font-body text-xs text-accent-success uppercase tracking-wider mb-2">Strengths</p>
              {sessionSummary.strengths.map((s, i) => (
                <p key={i} className="font-body text-sm text-text-primary">— {s}</p>
              ))}
            </div>
          )}

          {sessionSummary.gaps.length > 0 && (
            <div className="mb-4">
              <p className="font-body text-xs text-accent-warn uppercase tracking-wider mb-2">Review</p>
              {sessionSummary.gaps.map((g, i) => (
                <p key={i} className="font-body text-sm text-text-primary">— {g}</p>
              ))}
            </div>
          )}

          {sessionSummary.next_recommended && (
            <div className="mb-8 p-3 bg-accent-primary/10 border border-accent-primary/20 rounded-lg">
              <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-1">Next</p>
              <p className="font-body text-sm text-text-primary">{sessionSummary.next_recommended}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-3 bg-bg-elevated border border-border font-body text-sm text-text-secondary rounded-lg hover:text-text-primary transition-colors"
            >
              dashboard
            </button>
            <button
              onClick={() => navigate(`/session/${sessionSummary.next_recommended ? activeTopic : topicId}`)}
              className="flex-1 py-3 bg-accent-primary font-body text-sm text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
            >
              next session
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
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
        </div>
        <div className="flex items-center gap-3">
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
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-success' : 'bg-accent-danger'} transition-colors`} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-6 py-6">

          {/* Prereq gap intervention banner */}
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
                    <p className="font-body text-sm text-text-primary">
                      {prereqGap.reason}
                    </p>
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

          {/* Instant evaluation strip */}
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

            {streaming && streamBuffer && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="max-w-[80%] bg-bg-elevated border border-border rounded-lg px-4 py-3">
                  <p className="font-body text-sm text-text-primary whitespace-pre-wrap">
                    {streamBuffer}
                    <span className="inline-block w-1 h-3.5 bg-accent-primary ml-0.5 animate-pulse" />
                  </p>
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
                  onClick={() => sendAnswer(opt)}
                  className="text-left p-3 bg-bg-elevated border border-border rounded-lg hover:border-accent-primary/50 font-body text-sm text-text-primary transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {answerType === 'code' && (
            <div className="mb-3">
              <CodeEditor value={codeAnswer} onChange={setCodeAnswer} height={180} />
            </div>
          )}

          <div className="flex gap-3">
            {(answerType === 'text' || answerType === 'complexity') && (
              <input
                type="text"
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !streaming && handleSubmit()}
                placeholder={answerType === 'complexity' ? 'e.g. O(n log n)' : 'Your answer...'}
                className="flex-1 bg-bg-elevated border border-border rounded-lg px-4 py-2.5 font-body text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-primary/50"
              />
            )}
            {answerType === 'code' && <div className="flex-1" />}

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
        </div>
      </div>
    </div>
  )
}
