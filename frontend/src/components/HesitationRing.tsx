import { useEffect, useState } from 'react'

interface HesitationRingProps {
  startAt: number
  threshold?: number
  size?: number
  active?: boolean
}

export default function HesitationRing({
  startAt,
  threshold = 45_000,
  size = 24,
  active = true,
}: HesitationRingProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) return
    setElapsed(0)
    const id = window.setInterval(() => {
      setElapsed(Math.min(threshold, Date.now() - startAt))
    }, 250)
    return () => window.clearInterval(id)
  }, [startAt, threshold, active])

  const ratio = Math.min(1, elapsed / threshold)
  const r = size / 2 - 2
  const C = 2 * Math.PI * r
  const offset = C * (1 - ratio)
  const color = ratio < 0.5 ? '#00d4ff' : ratio < 0.85 ? '#ffb300' : '#ff4757'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="opacity-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={2} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeDasharray={C}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.25s linear' }}
      />
    </svg>
  )
}
