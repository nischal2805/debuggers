import { useState } from 'react'

interface ApproachBoxProps {
  onChange: (text: string) => void
  onFocus: () => void
}

export default function ApproachBox({ onChange, onFocus }: ApproachBoxProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const handleChange = (val: string) => {
    setText(val)
    onChange(val)
  }

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-text-secondary uppercase tracking-wider">Write your approach first</span>
          {text.trim().length > 10 && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent-success" />
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-3">
          <p className="font-body text-[10px] text-text-secondary mb-2">
            Explain your intuition before writing code. This is tracked as part of your brain model — approach-first solvers learn faster.
          </p>
          <textarea
            className="w-full bg-bg-elevated border border-border rounded-lg p-3 font-body text-xs text-text-primary placeholder:text-text-secondary/50 resize-none focus:outline-none focus:border-accent-primary/40 transition-colors"
            rows={5}
            placeholder={"e.g. I'll use a hash map to store complement → index. For each number, check if its complement already exists in the map. Time O(n), space O(n)."}
            value={text}
            onFocus={onFocus}
            onChange={e => handleChange(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
