import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { getMasteryColor } from '../lib/topics'

interface MasteryNodeData {
  label: string
  mastery: number
  confidence: number
  locked: boolean
  recommended: boolean
  category: string
  [key: string]: unknown
}

function MasteryNode({ data, selected }: NodeProps) {
  const nodeData = data as MasteryNodeData
  const { label, mastery, locked, recommended } = nodeData
  const color = getMasteryColor(mastery)
  const opacity = locked ? 0.35 : 1

  return (
    <div
      style={{
        opacity,
        outline: recommended ? `2px solid #ffb300` : selected ? '2px solid #6c63ff' : '2px solid transparent',
        outlineOffset: 2,
        animation: recommended ? 'pulse 2s infinite' : undefined,
      }}
      className="relative bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 min-w-[90px] text-center cursor-pointer hover:border-accent-primary/40 transition-all"
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        className="absolute inset-0 rounded-lg opacity-15"
        style={{ background: color }}
      />
      <div className="relative">
        <div
          className="w-1.5 h-1.5 rounded-full mx-auto mb-1.5"
          style={{ background: color }}
        />
        <div className="font-body text-xs text-text-primary font-medium leading-tight">
          {label}
        </div>
        <div className="font-body text-[10px] text-text-secondary mt-0.5">
          {Math.round(mastery * 100)}%
        </div>
      </div>
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/60 rounded-lg">
          <svg className="w-3 h-3 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

export default memo(MasteryNode)
