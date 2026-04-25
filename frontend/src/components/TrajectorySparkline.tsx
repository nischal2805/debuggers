import { useMemo } from 'react'

interface TrajectorySparklineProps {
  points: { total: number; timestamp: string }[]
  width?: number
  height?: number
}

export default function TrajectorySparkline({ points, width = 220, height = 56 }: TrajectorySparklineProps) {
  const path = useMemo(() => {
    if (!points || points.length < 2) return null
    const xs = points.map((_, i) => (i / (points.length - 1)) * width)
    const ys = points.map(p => height - (Math.max(0, Math.min(100, p.total)) / 100) * height)
    return xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
  }, [points, width, height])

  if (!path) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center font-body text-[10px] text-text-secondary">
        not enough data yet
      </div>
    )
  }

  const last = points[points.length - 1]?.total ?? 0
  const first = points[0]?.total ?? 0
  const trendUp = last >= first

  return (
    <div className="flex items-end gap-3">
      <svg width={width} height={height} className="overflow-visible">
        <path d={path} fill="none" stroke={trendUp ? '#00e676' : '#ff4757'} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
      <div className="flex flex-col">
        <span className="font-display text-lg font-bold text-text-primary">{Math.round(last)}</span>
        <span className="font-body text-[10px]" style={{ color: trendUp ? '#00e676' : '#ff4757' }}>
          {trendUp ? '+' : ''}{(last - first).toFixed(1)}
        </span>
      </div>
    </div>
  )
}
