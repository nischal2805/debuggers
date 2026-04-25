import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

interface DomainGroupData {
  label: string
  avg: number
  mastered: number
  total: number
  color: string
  expanded: boolean
  [key: string]: unknown
}

function DomainGroupNode({ data }: NodeProps) {
  const { label, avg, mastered, total, color, expanded } = data as DomainGroupData
  const pct = Math.round(avg * 100)
  const arcR = 28
  const circ = 2 * Math.PI * arcR
  const dash = (pct / 100) * circ

  return (
    <div
      className="relative rounded-2xl px-5 py-4 min-w-[160px] cursor-pointer select-none"
      style={{
        background: `${color}12`,
        border: `1.5px solid ${color}40`,
        boxShadow: `0 0 ${16 + pct / 4}px 2px ${color}18`,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <div className="flex items-center gap-4">
        {/* Circular progress ring */}
        <svg width={64} height={64} className="flex-shrink-0">
          <circle cx={32} cy={32} r={arcR} fill="none" stroke={`${color}20`} strokeWidth={5} />
          <circle
            cx={32} cy={32} r={arcR}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeDasharray={`${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
          <text x={32} y={36} textAnchor="middle" fontSize={13} fontWeight="bold" fill={color}>
            {pct}%
          </text>
        </svg>

        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-bold text-text-primary leading-tight mb-1">{label}</div>
          <div className="font-body text-[10px] text-text-secondary">
            {mastered}/{total} mastered
          </div>
          <div
            className="font-body text-[10px] mt-1"
            style={{ color: expanded ? color : 'rgba(136,136,170,0.7)' }}
          >
            {expanded ? 'collapse' : 'expand topics'}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

export default memo(DomainGroupNode)
