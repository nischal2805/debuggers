import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, setDoc } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { useStore } from '../store/useStore'
import { buildDefaultKnowledgeModel } from '../lib/types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

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

const INTERVIEW_DATE_OPTIONS = [
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [interviewDate, setInterviewDate] = useState('')
  const [customDate, setCustomDate] = useState('')
  const { user, isDemoMode, demoToken } = useStore()
  const navigate = useNavigate()

  const totalSteps = STEPS.length + 1 // +1 for interview date step
  const current = step < STEPS.length ? STEPS[step] : null
  const isDateStep = step === STEPS.length

  const selectOption = async (value: string) => {
    const newAnswers = { ...answers, [current!.id]: value }
    setAnswers(newAnswers)
    setStep(step + 1)
  }

  const selectDateOption = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setInterviewDate(d.toISOString().slice(0, 10))
  }

  const finish = async (skipDate = false) => {
    setSaving(true)
    try {
      const uid = user?.uid
      const knowledgeModel = uid ? buildDefaultKnowledgeModel(uid, answers.level) : null

      if (uid && db && knowledgeModel) {
        await setDoc(doc(db, 'users', uid, 'knowledgeModel', 'current'), knowledgeModel)
        await updateDoc(doc(db, 'users', uid), {
          goal: answers.goal,
          dailyGoalMinutes: parseInt(answers.time),
          onboarded: true,
          ...(interviewDate && !skipDate ? { interviewDate } : {}),
        })
      }

      // Save interview date via API (works for demo mode too)
      const date = skipDate ? '' : (interviewDate || customDate)
      if (date) {
        const token = isDemoMode && demoToken ? demoToken
          : auth?.currentUser ? await auth.currentUser.getIdToken() : null
        if (token) {
          await fetch(`${BACKEND_URL}/user/interview-date`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ interview_date: date }),
          }).catch(() => {})
        }
      }

      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <div className="flex gap-2 mb-12">
          {Array.from({ length: totalSteps }).map((_, i) => (
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
              {step + 1} / {totalSteps}
            </p>

            {!isDateStep && current ? (
              <>
                <h2 className="font-display text-3xl font-bold text-text-primary mb-8">
                  {current.question}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {current.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => selectOption(opt.value)}
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
              </>
            ) : (
              <>
                <h2 className="font-display text-3xl font-bold text-text-primary mb-2">
                  When is your interview?
                </h2>
                <p className="font-body text-text-secondary text-sm mb-8">
                  The agent will manage your preparation as a countdown. It knows your deadline.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {INTERVIEW_DATE_OPTIONS.map(opt => {
                    const d = new Date()
                    d.setDate(d.getDate() + opt.days)
                    const val = d.toISOString().slice(0, 10)
                    const selected = interviewDate === val
                    return (
                      <button
                        key={opt.label}
                        onClick={() => selectDateOption(opt.days)}
                        className={`text-left p-4 bg-bg-surface border rounded-lg transition-all duration-150 ${selected ? 'border-accent-primary bg-accent-primary/5' : 'border-border hover:border-accent-primary/50'}`}
                      >
                        <div className={`font-body font-medium text-sm ${selected ? 'text-accent-primary' : 'text-text-primary'}`}>
                          {opt.label}
                        </div>
                        <div className="font-body text-text-secondary text-xs mt-1">
                          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="flex gap-2 mb-6">
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => { setCustomDate(e.target.value); setInterviewDate(e.target.value) }}
                    placeholder="Custom date"
                    min={new Date().toISOString().slice(0, 10)}
                    className="flex-1 bg-bg-elevated border border-border text-text-primary font-body text-sm rounded px-3 py-2"
                  />
                </div>

                <button
                  onClick={() => finish(false)}
                  disabled={saving || (!interviewDate && !customDate)}
                  className="w-full py-3 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white font-display font-bold rounded-lg transition-colors mb-3"
                >
                  {saving ? 'Building your model...' : 'Start Preparation'}
                </button>
                <button
                  onClick={() => finish(true)}
                  disabled={saving}
                  className="w-full py-2 font-body text-text-secondary text-sm hover:text-text-primary transition-colors"
                >
                  Skip — no interview date
                </button>
              </>
            )}
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
