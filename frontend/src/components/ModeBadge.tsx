import { motion, AnimatePresence } from 'framer-motion'
import type { AgentMode } from '../lib/types'

const MODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ASSESS:    { bg: 'bg-accent-secondary/10', border: 'border-accent-secondary/30', text: 'text-accent-secondary' },
  SCAFFOLD:  { bg: 'bg-accent-warn/10',      border: 'border-accent-warn/30',      text: 'text-accent-warn' },
  REINFORCE: { bg: 'bg-accent-primary/10',   border: 'border-accent-primary/30',   text: 'text-accent-primary' },
  ADVANCE:   { bg: 'bg-accent-success/10',   border: 'border-accent-success/30',   text: 'text-accent-success' },
  EXPLAIN:   { bg: 'bg-accent-secondary/10', border: 'border-accent-secondary/30', text: 'text-accent-secondary' },
  CONTINUE:  { bg: 'bg-bg-elevated',          border: 'border-border',              text: 'text-text-secondary' },
}

interface ModeBadgeProps {
  mode: AgentMode | string | null
  reason?: string | null
  compact?: boolean
}

export default function ModeBadge({ mode, reason, compact = false }: ModeBadgeProps) {
  if (!mode) return null
  const palette = MODE_COLORS[mode] ?? MODE_COLORS.CONTINUE
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.18 }}
        className={`inline-flex items-center gap-2 ${palette.bg} ${palette.border} border rounded-md px-2 py-1`}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'currentColor' }} />
        <span className={`font-body text-[10px] font-semibold uppercase tracking-wider ${palette.text}`}>
          {mode}
        </span>
        {!compact && reason && (
          <span className="font-body text-[10px] text-text-secondary truncate max-w-[260px]">
            {reason}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
