import { useState } from 'react'
import { motion } from 'framer-motion'

interface ThoughtTraceInputProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export default function ThoughtTraceInput({ value, onChange, disabled }: ThoughtTraceInputProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="font-body text-[10px] text-text-secondary uppercase tracking-wider hover:text-accent-secondary transition-colors"
      >
        {open ? '— hide thought trace' : '+ think aloud (optional)'}
      </button>
      {open && (
        <motion.textarea
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Outline your reasoning before answering. The agent will evaluate the reasoning separately."
          className="w-full mt-2 bg-bg-elevated border border-border rounded-lg px-3 py-2 font-body text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-secondary/50 resize-none"
          rows={3}
        />
      )}
    </div>
  )
}
