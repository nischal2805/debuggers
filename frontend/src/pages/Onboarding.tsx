import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useStore } from '../store/useStore'
import { buildDefaultKnowledgeModel } from '../lib/types'

const STEPS = [
  {
    id: 'level',
    question: 'Where are you at?',
    options: [
      { value: 'beginner', label: 'Beginner', sub: 'just starting out' },
      { value: 'basics', label: 'Know the basics', sub: 'arrays, sorting, maybe recursion' },
      { value: 'intermediate', label: 'Intermediate', sub: 'solving medium problems' },
      { value: 'grinding', label: 'Grinding LC', sub: 'consistent practice' },
    ],
  },
  {
    id: 'goal',
    question: 'What is your goal?',
    options: [
      { value: 'placement', label: 'Crack placements', sub: 'campus or lateral hiring' },
      { value: 'faang', label: 'FAANG / top tech', sub: 'Google, Meta, Amazon, etc.' },
      { value: 'competitive', label: 'Competitive', sub: 'Codeforces, ICPC, etc.' },
      { value: 'learning', label: 'Just learning', sub: 'no deadline pressure' },
    ],
  },
  {
    id: 'time',
    question: 'How much time per day?',
    options: [
      { value: '15', label: '15 min', sub: 'quick daily practice' },
      { value: '30', label: '30 min', sub: 'focused half hour' },
      { value: '60', label: '1 hour', sub: 'dedicated sessions' },
      { value: '120', label: 'Unlimited', sub: 'full grind mode' },
    ],
  },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { user } = useStore()
  const navigate = useNavigate()

  const current = STEPS[step]

  const select = async (value: string) => {
    const newAnswers = { ...answers, [current.id]: value }
    setAnswers(newAnswers)

    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      setSaving(true)
      try {
        const uid = user!.uid
        const knowledgeModel = buildDefaultKnowledgeModel(uid, newAnswers.level)

        await setDoc(doc(db, 'users', uid, 'knowledgeModel', 'current'), knowledgeModel)
        await updateDoc(doc(db, 'users', uid), {
          goal: newAnswers.goal,
          dailyGoalMinutes: parseInt(newAnswers.time),
          onboarded: true,
        })

        navigate('/dashboard')
      } catch (err) {
        console.error(err)
        setSaving(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <div className="flex gap-2 mb-12">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 transition-all duration-300 ${i <= step ? 'bg-accent-primary' : 'bg-bg-elevated'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <p className="font-body text-text-secondary text-sm mb-2">
              {step + 1} / {STEPS.length}
            </p>
            <h2 className="font-display text-3xl font-bold text-text-primary mb-8">
              {current.question}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {current.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => select(opt.value)}
                  disabled={saving}
                  className="text-left p-4 bg-bg-surface border border-border rounded-lg hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all duration-150 group"
                >
                  <div className="font-body font-medium text-text-primary text-sm group-hover:text-accent-primary transition-colors">
                    {opt.label}
                  </div>
                  <div className="font-body text-text-secondary text-xs mt-1">
                    {opt.sub}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {saving && (
          <div className="mt-8 flex items-center gap-3 text-text-secondary font-body text-sm">
            <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            Building your knowledge model...
          </div>
        )}
      </div>
    </div>
  )
}
