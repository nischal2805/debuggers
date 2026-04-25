import { useState, useRef, useEffect } from 'react'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  'Where should I start?',
  'What are my weak areas?',
  'I have 30 minutes — what to focus on?',
  'Why is my readiness score low?',
]

export default function AdvisorWidget() {
  const { isDemoMode, demoToken } = useStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const getToken = async () => {
    if (isDemoMode && demoToken) return demoToken
    return auth.currentUser?.getIdToken() ?? null
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setInput('')
    setLoading(true)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const r = await fetch(`${BACKEND_URL}/advisor/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history: messages.slice(-6) }),
      })
      const data = await r.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response ?? 'No response.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach advisor. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Panel */}
      {open && (
        <div className="mb-3 w-80 bg-bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 420, boxShadow: '0 0 40px 4px rgba(108,99,255,0.12)' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <div>
              <span className="font-display font-bold text-sm text-text-primary">Advisor</span>
              <span className="font-body text-[10px] text-text-secondary ml-2">knows your brain model</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="font-body text-xs text-text-secondary">Ask me anything about your learning path.</p>
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left font-body text-xs text-text-secondary bg-bg-elevated rounded px-3 py-2 hover:text-text-primary hover:border-accent-primary/30 border border-border transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-lg px-3 py-2 font-body text-xs leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'rgba(108,99,255,0.15)', color: '#f0f0ff' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#8888aa' }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-bg-elevated rounded-lg px-3 py-2 flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-3 pb-3">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 font-body text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary/40 transition-colors"
                placeholder="Ask about your learning path..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              />
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="px-3 py-2 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-40 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-12 h-12 rounded-full bg-accent-primary hover:bg-accent-primary/90 flex items-center justify-center shadow-lg transition-all"
        style={{ boxShadow: '0 0 20px 4px rgba(108,99,255,0.3)' }}
      >
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </div>
  )
}
