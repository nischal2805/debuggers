import { motion } from 'framer-motion'
import type { ReadinessSnapshot } from '../lib/types'
import { normalizePct } from '../lib/utils'

interface ReadinessCardProps {
  snapshot: ReadinessSnapshot
  calibrationGap?: number
}

const SUB_LABELS: { key: keyof ReadinessSnapshot; label: string }[] = [
  { key: 'coverage', label: 'Coverage' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'speed', label: 'Speed' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'recency', label: 'Recency' },
]

export default function ReadinessCard({ snapshot, calibrationGap = 0 }: ReadinessCardProps) {
  const total = normalizePct(snapshot?.total ?? 0)
  const totalColor = total >= 70 ? '#00e676' : total >= 40 ? '#ffb300' : '#ff4757'

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="font-body text-text-secondary text-xs uppercase tracking-wider">interview readiness</p>
          <motion.div
            key={total}
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-display text-4xl font-bold"
            style={{ color: totalColor }}
          >
            {total}
            <span className="font-body text-base text-text-secondary">/100</span>
          </motion.div>
        </div>
        <div className="text-right">
          <p className="font-body text-text-secondary text-[10px] uppercase tracking-wider">calibration</p>
          <p
            className="font-body text-xs"
            style={{ color: Math.abs(calibrationGap) < 0.1 ? '#8888aa' : calibrationGap > 0 ? '#ff4757' : '#00d4ff' }}
          >
            {calibrationGap > 0 ? `+${(calibrationGap * 100).toFixed(0)}% overconfident` :
             calibrationGap < 0 ? `${(calibrationGap * 100).toFixed(0)}% underconfident` :
             'aligned'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {SUB_LABELS.map(({ key, label }) => {
          const v = normalizePct((snapshot?.[key] as number) ?? 0)
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="font-body text-[10px] text-text-secondary uppercase tracking-wider w-20">{label}</span>
              <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${v}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ background: v >= 70 ? '#00e676' : v >= 40 ? '#ffb300' : '#ff4757' }}
                />
              </div>
              <span className="font-body text-[10px] text-text-secondary w-8 text-right">{v}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
