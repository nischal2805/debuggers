import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { SessionMessage } from '../lib/types'
import DifficultyBadge from './DifficultyBadge'

interface Props {
  message: SessionMessage
  difficultyLevel?: number
}

export default function TutorMessage({ message, difficultyLevel }: Props) {
  const [displayed, setDisplayed] = useState('')
  const isTutor = message.role === 'tutor'

  useEffect(() => {
    if (!isTutor) {
      setDisplayed(message.content)
      return
    }
    let i = 0
    setDisplayed('')
    const interval = setInterval(() => {
      if (i < message.content.length) {
        setDisplayed(message.content.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
      }
    }, 12)
    return () => clearInterval(interval)
  }, [message.content, isTutor])

  if (!isTutor) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[70%] bg-accent-primary/20 border border-accent-primary/30 rounded-lg px-4 py-3">
          <p className="font-body text-sm text-text-primary whitespace-pre-wrap">{message.content}</p>
        </div>
      </motion.div>
    )
  }

  const typeColor = {
    question: 'border-accent-secondary/30',
    hint: 'border-accent-warn/30',
    explanation: 'border-accent-primary/30',
    feedback: message.content.toLowerCase().includes('correct') ? 'border-accent-success/30' : 'border-accent-danger/30',
    celebration: 'border-accent-success/30',
    topic_transition: 'border-accent-secondary/30',
    prereq_intervention: 'border-accent-warn/30',
    session_summary: 'border-accent-primary/30',
  }[message.type ?? 'explanation'] ?? 'border-border'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className={`max-w-[80%] bg-bg-elevated border ${typeColor} rounded-lg px-4 py-3`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
          <span className="font-body text-[10px] text-text-secondary uppercase tracking-wider">
            {message.type ?? 'tutor'}
          </span>
          {difficultyLevel && <DifficultyBadge level={difficultyLevel} />}
        </div>
        <p className="font-body text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
          {displayed}
          {displayed.length < message.content.length && (
            <span className="inline-block w-1 h-3.5 bg-accent-primary ml-0.5 animate-pulse" />
          )}
        </p>
      </div>
    </motion.div>
  )
}
