import { motion, AnimatePresence } from 'framer-motion'

interface ProactiveHintPromptProps {
  open: boolean
  onAccept: () => void
  onDismiss: () => void
}

export default function ProactiveHintPrompt({ open, onAccept, onDismiss }: ProactiveHintPromptProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-4 px-4 py-3 rounded-lg border bg-accent-warn/10 border-accent-warn/30 flex items-center justify-between gap-4"
        >
          <div>
            <p className="font-body text-xs text-accent-warn uppercase tracking-wider mb-0.5">
              stuck for 45s — hint available
            </p>
            <p className="font-body text-xs text-text-secondary">
              Take a hint, or keep working. The agent flagged this as a hesitation point.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 bg-bg-elevated border border-border rounded text-xs font-body text-text-secondary hover:text-text-primary"
            >
              keep going
            </button>
            <button
              onClick={onAccept}
              className="px-3 py-1.5 bg-accent-warn text-bg-primary rounded text-xs font-body font-semibold hover:bg-accent-warn/90"
            >
              show hint
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
