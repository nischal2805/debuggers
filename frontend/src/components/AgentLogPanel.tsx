import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'

const MODE_COLOR: Record<string, string> = {
  ASSESS: 'text-accent-secondary',
  SCAFFOLD: 'text-accent-warn',
  REINFORCE: 'text-accent-primary',
  ADVANCE: 'text-accent-success',
  EXPLAIN: 'text-accent-secondary',
  CONTINUE: 'text-text-secondary',
}

export default function AgentLogPanel() {
  const log = useStore(s => s.agentLog)

  if (!log.length) {
    return (
      <p className="font-body text-xs text-text-secondary italic">
        Agent decisions will appear here as they happen.
      </p>
    )
  }

  return (
    <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin pr-1">
      {[...log].reverse().map((entry, i) => {
        const color = MODE_COLOR[entry.mode] ?? 'text-text-secondary'
        const ts = new Date(entry.ts)
        const stamp = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}:${ts.getSeconds().toString().padStart(2, '0')}`
        return (
          <motion.div
            key={`${entry.ts}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-2"
          >
            <span className="font-body text-[10px] text-text-secondary w-14 mt-0.5">{stamp}</span>
            <span className={`font-body text-[10px] font-semibold uppercase tracking-wider w-20 ${color}`}>
              {entry.mode}
            </span>
            <span className="font-body text-xs text-text-primary flex-1 leading-snug">
              {entry.reason}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
