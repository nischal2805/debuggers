import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { TOPIC_GRAPH } from '../lib/topics'

export default function MasteredCelebration() {
  const masteredJustNow = useStore(s => s.masteredJustNow)
  const acknowledgeMastered = useStore(s => s.acknowledgeMastered)

  const topic = masteredJustNow[0]
  const label = topic ? (TOPIC_GRAPH[topic]?.label ?? topic) : null

  return (
    <AnimatePresence>
      {topic && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <div className="pointer-events-auto bg-bg-surface border border-accent-success/40 rounded-2xl px-10 py-8 text-center"
               style={{ boxShadow: '0 0 60px 8px rgba(0, 230, 118, 0.18)' }}>
            <p className="font-body text-[10px] text-accent-success uppercase tracking-[0.4em] mb-3">
              concept mastered
            </p>
            <h2 className="font-display text-3xl font-bold text-text-primary uppercase tracking-wider mb-3">
              {label?.toUpperCase()}
            </h2>
            <p className="font-body text-sm text-text-secondary mb-4">
              Knowledge crossed the 0.85 threshold. Adjacent topics may now be unlocked.
            </p>
            <button
              onClick={() => acknowledgeMastered(topic)}
              className="font-body text-xs text-accent-success border border-accent-success/40 rounded-md px-3 py-1.5 hover:bg-accent-success/10 transition-colors"
            >
              continue
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
