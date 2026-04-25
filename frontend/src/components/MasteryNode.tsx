import { memo, useEffect, useRef } from 'react'
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
  justMastered?: boolean
  [key: string]: unknown
}

function MasteryNode({ data, selected }: NodeProps) {
  const { label, mastery, confidence, locked, recommended, justMastered } = data as MasteryNodeData
  const color = getMasteryColor(mastery)
  const opacity = locked ? 0.35 : 1
  const ringRef = useRef<HTMLDivElement>(null)

  // Flash animation when topic crosses mastery threshold
  useEffect(() => {
    if (!justMastered || !ringRef.current) return
    ringRef.current.animate(
      [
        { boxShadow: `0 0 0 0 ${color}60` },
        { boxShadow: `0 0 32px 12px ${color}40` },
        { boxShadow: `0 0 0 0 ${color}00` },
      ],
      { duration: 900, easing: 'ease-out' }
    )
  }, [justMastered, color])

  // Ring radius based on mastery level (grows from 50% mastery upward)
  const ringOpacity = mastery > 0.5 ? (mastery - 0.5) * 1.6 : 0

  // Glow intensity: confidence × mastery
  const glowStrength = Math.round((confidence ?? 0) * mastery * 24)

  return (
    <div
      ref={ringRef}
      style={{
        opacity,
        outline: recommended
          ? '2px solid #ffb300'
          : selected
          ? '2px solid #6c63ff'
          : '2px solid transparent',
        outlineOffset: 2,
        animation: recommended ? 'pulse 2s infinite' : undefined,
        boxShadow: glowStrength > 4
          ? `0 0 ${glowStrength}px ${Math.round(glowStrength * 0.5)}px ${color}28`
          : undefined,
      }}
      className="relative bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 min-w-[90px] text-center cursor-pointer hover:border-accent-primary/40 transition-all"
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      {/* Background fill tinted by mastery color */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{ background: color, opacity: 0.10 + mastery * 0.08 }}
      />

      {/* Mastery ring: subtle SVG arc around node */}
      {ringOpacity > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          <rect
            x="-4" y="-4"
            width="calc(100% + 8px)" height="calc(100% + 8px)"
            rx="12"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeOpacity={ringOpacity}
            strokeDasharray={`${mastery * 60} 100`}
          />
        </svg>
      )}

      <div className="relative">
        <div
          className="w-1.5 h-1.5 rounded-full mx-auto mb-1.5 transition-colors duration-700"
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
