import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { TOPIC_GRAPH, getMasteryColor, arePrereqsMet } from '../lib/topics'
import NavBar from '../components/NavBar'

const PHASES = [
  { id: 'foundation',   label: 'Foundation',   color: '#6c63ff', bg: 'rgba(108,99,255,0.06)', border: 'rgba(108,99,255,0.25)' },
  { id: 'intermediate', label: 'Intermediate', color: '#00d4ff', bg: 'rgba(0,212,255,0.06)',  border: 'rgba(0,212,255,0.25)' },
  { id: 'advanced',     label: 'Advanced',     color: '#ffb300', bg: 'rgba(255,179,0,0.06)',  border: 'rgba(255,179,0,0.25)' },
  { id: 'expert',       label: 'Expert',       color: '#ff4757', bg: 'rgba(255,71,87,0.06)',  border: 'rgba(255,71,87,0.25)' },
] as const

type Phase = typeof PHASES[number]['id']

const PHASE_TOPICS: Record<Phase, string[]> = (() => {
  const out: Record<string, string[]> = { foundation: [], intermediate: [], advanced: [], expert: [] }
  for (const [id, meta] of Object.entries(TOPIC_GRAPH)) {
    out[meta.category]?.push(id)
  }
  return out as Record<Phase, string[]>
})()

export default function Roadmap() {
  const navigate = useNavigate()
  const model = useKnowledgeModel()

  const masteryMap = useMemo(() => {
    if (!model) return {}
    const m: Record<string, number> = {}
    for (const [k, v] of Object.entries(model.topics)) m[k] = v.mastery
    return m
  }, [model])

  if (!model) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-bg-primary flex flex-col overflow-hidden">
      <NavBar active="/roadmap" />

      {/* Sub-header */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-border bg-bg-surface/60 flex-shrink-0">
        <span className="font-display font-bold text-text-primary text-sm">Learning Roadmap</span>
        <span className="font-body text-[11px] text-text-secondary">
          {Object.values(masteryMap).filter(m => m >= 0.5).length} / {Object.keys(TOPIC_GRAPH).length} topics mastered
        </span>
      </div>

      {/* Phase connector arrows row */}
      <div className="flex flex-shrink-0 px-6 pt-4 pb-0 gap-0 items-center">
        {PHASES.map((phase, i) => (
          <div key={phase.id} className="flex items-center flex-1">
            <div
              className="flex-1 h-0.5 rounded-full"
              style={{ background: phase.border }}
            />
            <div
              className="font-body text-[10px] font-semibold px-3 py-1 rounded-full whitespace-nowrap"
              style={{ color: phase.color, background: phase.bg, border: `1px solid ${phase.border}` }}
            >
              {phase.label}
            </div>
            {i < PHASES.length - 1 && (
              <div className="flex items-center">
                <div className="w-6 h-0.5 bg-border" />
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="flex-shrink-0" style={{ color: 'var(--border-color)' }}>
                  <path d="M1 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            {i === PHASES.length - 1 && <div className="flex-1 h-0.5 rounded-full" style={{ background: phase.border }} />}
          </div>
        ))}
      </div>

      {/* Phase columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden px-4 pb-4 pt-3 gap-3">
        {PHASES.map((phase) => {
          const topics = PHASE_TOPICS[phase.id]
          const masteredCount = topics.filter(t => (masteryMap[t] ?? 0) >= 0.5).length
          const avgMastery = topics.length
            ? topics.reduce((sum, t) => sum + (masteryMap[t] ?? 0), 0) / topics.length
            : 0

          return (
            <div
              key={phase.id}
              className="flex-1 flex flex-col rounded-2xl overflow-hidden min-w-0"
              style={{ background: phase.bg, border: `1px solid ${phase.border}` }}
            >
              {/* Column header */}
              <div
                className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: `1px solid ${phase.border}` }}
              >
                <div>
                  <div className="font-display font-bold text-sm" style={{ color: phase.color }}>
                    {phase.label}
                  </div>
                  <div className="font-body text-[10px] text-text-secondary mt-0.5">
                    {masteredCount}/{topics.length} mastered
                  </div>
                </div>
                {/* Phase progress ring */}
                <svg width="36" height="36" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="14" fill="none"
                    stroke={phase.color}
                    strokeWidth="3"
                    strokeDasharray={`${avgMastery * 87.96} 87.96`}
                    strokeLinecap="round"
                    transform="rotate(-90 18 18)"
                    style={{ opacity: 0.85 }}
                  />
                  <text x="18" y="22" textAnchor="middle" fontSize="9" fill={phase.color} fontFamily="IBM Plex Mono, monospace" fontWeight="600">
                    {Math.round(avgMastery * 100)}%
                  </text>
                </svg>
              </div>

              {/* Topic list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {topics.map((topicId, idx) => {
                  const mastery = masteryMap[topicId] ?? 0
                  const locked = !arePrereqsMet(topicId, masteryMap)
                  const masteryColor = getMasteryColor(mastery)
                  const prereqs = TOPIC_GRAPH[topicId]?.prereqs ?? []

                  return (
                    <motion.button
                      key={topicId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.2 }}
                      whileHover={locked ? {} : { x: 2, backgroundColor: 'rgba(255,255,255,0.06)' }}
                      whileTap={locked ? {} : { scale: 0.98 }}
                      onClick={() => !locked && navigate(`/solve/${topicId}`)}
                      className="w-full text-left rounded-xl px-3 py-2.5 transition-all group"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: `1px solid ${mastery >= 0.5 ? masteryColor + '40' : 'var(--border-color)'}`,
                        opacity: locked ? 0.45 : 1,
                        cursor: locked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Mastery dot */}
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: mastery > 0 ? masteryColor : 'var(--border-color)',
                            boxShadow: mastery >= 0.5 ? `0 0 6px ${masteryColor}80` : 'none',
                          }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="font-body text-xs font-medium truncate transition-colors"
                              style={{ color: locked ? 'var(--text-secondary)' : mastery >= 0.5 ? masteryColor : 'var(--text-primary)' }}
                            >
                              {TOPIC_GRAPH[topicId]?.label ?? topicId}
                            </span>
                            <span
                              className="font-body text-[10px] flex-shrink-0 tabular-nums"
                              style={{ color: mastery > 0 ? masteryColor : 'var(--text-secondary)' }}
                            >
                              {Math.round(mastery * 100)}%
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-1.5 h-1 bg-bg-primary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${mastery * 100}%`,
                                background: masteryColor,
                                boxShadow: mastery >= 0.5 ? `0 0 4px ${masteryColor}60` : 'none',
                              }}
                            />
                          </div>

                          {/* Prereqs when locked */}
                          {locked && prereqs.length > 0 && (
                            <div className="mt-1 font-body text-[9px] text-text-secondary truncate">
                              needs: {prereqs.map(p => TOPIC_GRAPH[p]?.label ?? p).join(', ')}
                            </div>
                          )}
                        </div>

                        {/* Lock or arrow icon */}
                        {locked ? (
                          <svg className="w-3 h-3 flex-shrink-0 text-text-secondary opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        ) : (
                          <svg
                            className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: phase.color }}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-6 py-2.5 border-t border-border flex items-center gap-6 text-xs font-body text-text-secondary flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: getMasteryColor(0.1) }} />
          <span>low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: getMasteryColor(0.5) }} />
          <span>mid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: getMasteryColor(0.9) }} />
          <span>mastered</span>
        </div>
        <span className="ml-auto">Click any unlocked topic to practice</span>
      </div>
    </div>
  )
}
