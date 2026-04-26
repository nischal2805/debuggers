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
  const nodeRef = useRef<HTMLDivElement>(null)
  const pct = Math.round(mastery * 100)

  useEffect(() => {
    if (!justMastered || !nodeRef.current) return
    nodeRef.current.animate(
      [
        { boxShadow: `0 0 0 0 ${color}00` },
        { boxShadow: `0 0 24px 8px ${color}60` },
        { boxShadow: `0 0 0 0 ${color}00` },
      ],
      { duration: 900, easing: 'ease-out' }
    )
  }, [justMastered, color])

  return (
    <div
      ref={nodeRef}
      style={{
        width: 120,
        height: 54,
        borderRadius: 8,
        background: 'var(--bg-elevated)',
        border: `1px solid ${
          recommended ? '#ffb300' : selected ? '#6c63ff' : 'rgba(108,99,255,0.18)'
        }`,
        boxShadow: recommended
          ? '0 0 14px rgba(255,179,0,0.3)'
          : `0 2px 8px rgba(0,0,0,0.3)`,
        opacity: locked ? 0.38 : 1,
        cursor: locked ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative',
        animation: recommended ? 'pulse 2s infinite' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      {/* Content area */}
      <div style={{ padding: '7px 10px 4px', flex: 1 }}>
        <div
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 9.5,
            fontWeight: 700,
            color: locked ? 'var(--text-secondary)' : 'var(--text-primary)',
            lineHeight: 1.2,
            letterSpacing: '0.01em',
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 9,
            color,
            fontWeight: 500,
          }}
        >
          {locked ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: 8 }}>locked</span>
          ) : (
            `${pct}%`
          )}
        </div>
      </div>

      {/* Bottom mastery progress bar */}
      <div
        style={{
          height: 3,
          background: 'rgba(108,99,255,0.1)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 4px ${color}80`,
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      {/* Recommended dot */}
      {recommended && (
        <div
          style={{
            position: 'absolute',
            top: 5, right: 6,
            width: 5, height: 5,
            borderRadius: '50%',
            background: '#ffb300',
            boxShadow: '0 0 5px #ffb30099',
          }}
        />
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

export default memo(MasteryNode)
