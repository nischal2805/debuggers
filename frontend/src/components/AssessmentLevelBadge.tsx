import { assessmentLevel } from '../lib/types'

interface AssessmentLevelBadgeProps {
  knowledge: number
  compact?: boolean
}

const LEVEL_COLOR: Record<number, string> = {
  0: '#ff4757',
  1: '#ff8a4d',
  2: '#ffb300',
  3: '#6c63ff',
  4: '#00e676',
}

export default function AssessmentLevelBadge({ knowledge, compact = false }: AssessmentLevelBadgeProps) {
  const { level, label } = assessmentLevel(knowledge)
  const color = LEVEL_COLOR[level]

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 font-body text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5"
        style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}
      >
        L{level}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wider rounded px-2 py-0.5"
      style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}
    >
      <span className="font-bold">L{level}</span>
      <span>{label}</span>
    </span>
  )
}
