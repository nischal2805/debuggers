import { useEffect, useMemo, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ReactFlow, Background, BackgroundVariant, useNodesState, useEdgesState, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { TOPIC_GRAPH, getMasteryColor, arePrereqsMet } from '../lib/topics'
import MasteryNode from '../components/MasteryNode'
import ProgressiveGraph from '../components/ProgressiveGraph'
import SkillRadar from '../components/SkillRadar'
import SessionHeatmap from '../components/SessionHeatmap'
import ReadinessCard from '../components/ReadinessCard'
import Last10Streak from '../components/Last10Streak'
import TrajectorySparkline from '../components/TrajectorySparkline'
import AdvisorWidget from '../components/AdvisorWidget'
import CountdownWidget from '../components/CountdownWidget'
import NavBar from '../components/NavBar'

const NODE_TYPES = { masteryNode: MasteryNode }
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const spring = { type: 'spring' as const, stiffness: 420, damping: 26 }

function getWhyNextExplanation(topicId: string, masteryMap: Record<string, number>): string {
  const mastery = masteryMap[topicId] ?? 0
  const prereqs = TOPIC_GRAPH[topicId]?.prereqs ?? []
  const metPrereqs = prereqs.filter(p => (masteryMap[p] ?? 0) > 0.5)
  if (mastery === 0) return `Not started — prerequisites met (${metPrereqs.join(', ') || 'none required'}).`
  if (mastery < 0.4) return `Low mastery (${Math.round(mastery * 100)}%). Most to gain here.`
  if (mastery < 0.7) return `Mid-range mastery (${Math.round(mastery * 100)}%). Highest marginal learning gain.`
  return `Mastery at ${Math.round(mastery * 100)}% — consolidate before advancing.`
}

export default function Dashboard() {
  const { user, readiness, calibrationGap, answerStreak, setReadiness, isDemoMode, demoToken } = useStore()
  const model = useKnowledgeModel()
  const navigate = useNavigate()
  const [recommended, setRecommended] = useState<string | null>(null)
  const [roadmap, setRoadmap] = useState<string[]>([])
  const [sessionDates, setSessionDates] = useState<string[]>([])
  const [useProgressiveGraph, setUseProgressiveGraph] = useState(true)

  useEffect(() => {
    if (!user) return
    const tokenPromise = isDemoMode && demoToken
      ? Promise.resolve(demoToken)
      : auth?.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)
    tokenPromise.then(token => {
      if (!token) return
      fetch(`${BACKEND_URL}/user/readiness`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.snapshot) setReadiness(data.snapshot, data.calibration_gap ?? 0) })
        .catch(() => {})
    })
  }, [user, isDemoMode, demoToken, setReadiness])

  useEffect(() => {
    if (!user) return
    const { isDemoMode, demoToken } = useStore.getState()
    const tokenPromise = isDemoMode && demoToken
      ? Promise.resolve(demoToken)
      : auth && auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)
    tokenPromise.then(token => {
      if (!token) return
      fetch(`${BACKEND_URL}/user/roadmap`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          const list: string[] = data.roadmap ?? []
          setRoadmap(list)
          setRecommended(list[0] ?? null)
        })
        .catch(() => {
          if (!model) return
          const masteryMap: Record<string, number> = {}
          for (const [k, v] of Object.entries(model.topics)) masteryMap[k] = v.mastery
          let best: string | null = null
          let bestScore = -Infinity
          for (const [id] of Object.entries(TOPIC_GRAPH)) {
            const m = masteryMap[id] ?? 0
            if (m > 0.85 || !arePrereqsMet(id, masteryMap)) continue
            const score = 1 - Math.abs(m - 0.5) * 2
            if (score > bestScore) { bestScore = score; best = id }
          }
          setRecommended(best)
        })
    })
  }, [user, model])

  useEffect(() => {
    if (!user) return
    const { isDemoMode, demoToken } = useStore.getState()
    const tokenPromise = isDemoMode && demoToken
      ? Promise.resolve(demoToken)
      : auth?.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)
    tokenPromise.then(token => {
      if (!token) return
      fetch(`${BACKEND_URL}/user/sessions`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          const dates = (data.sessions ?? []).map((s: any) =>
            typeof s.startedAt === 'string' ? s.startedAt.slice(0, 10) : ''
          ).filter(Boolean)
          setSessionDates(dates)
        })
        .catch(() => {})
    })
  }, [user])

  const masteryMap = useMemo(() => {
    if (!model) return {}
    const m: Record<string, number> = {}
    for (const [k, v] of Object.entries(model.topics)) m[k] = v.mastery
    return m
  }, [model])

  const masteredJustNow = useStore(s => s.masteredJustNow)

  const rawNodes = useMemo(() => {
    return Object.entries(TOPIC_GRAPH).map(([id, meta]) => {
      const mastery = masteryMap[id] ?? 0
      const locked = !arePrereqsMet(id, masteryMap)
      const topicsInCol = Object.entries(TOPIC_GRAPH).filter(([, m]) => m.difficulty === meta.difficulty)
      const row = topicsInCol.findIndex(([k]) => k === id)
      return {
        id,
        type: 'masteryNode',
        position: { x: (meta.difficulty - 1) * 190 + 50, y: row * 130 + 30 },
        data: {
          label: meta.label,
          mastery,
          confidence: model?.topics[id]?.confidence ?? 0,
          locked,
          recommended: id === recommended,
          category: meta.category,
          justMastered: masteredJustNow.includes(id),
        },
      }
    })
  }, [masteryMap, recommended, model, masteredJustNow])

  const rawEdges = useMemo(() => {
    return Object.entries(TOPIC_GRAPH).flatMap(([id, meta]) =>
      meta.prereqs.map(prereq => {
        const prereqMastery = masteryMap[prereq] ?? 0
        const met = prereqMastery > 0.5
        return {
          id: `${prereq}-${id}`,
          source: prereq,
          target: id,
          animated: met,
          style: {
            stroke: met
              ? `hsl(${Math.round(prereqMastery * 120)}, 65%, 48%)`
              : 'rgba(108,99,255,0.18)',
            strokeDasharray: met ? undefined : '5 5',
            strokeWidth: met ? 1.8 : 1,
            strokeOpacity: met ? 0.7 : 0.4,
          },
        }
      })
    )
  }, [masteryMap])

  const [nodes, setNodes, onNodesChange] = useNodesState(rawNodes)
  const [edges, , onEdgesChange] = useEdgesState(rawEdges)

  useEffect(() => { setNodes(rawNodes) }, [rawNodes, setNodes])

  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    if (!arePrereqsMet(node.id, masteryMap)) return
    navigate(`/solve/${node.id}`)
  }, [masteryMap, navigate])

  const weakTopics = useMemo(() => {
    if (!model) return []
    return Object.entries(model.topics)
      .filter(([, v]) => v.mastery > 0 && v.mastery < 0.4)
      .sort((a, b) => a[1].mastery - b[1].mastery)
      .slice(0, 5)
      .map(([k]) => TOPIC_GRAPH[k]?.label ?? k)
  }, [model])

  const nextInRoadmap = roadmap.slice(0, 5)

  if (!model) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-accent-primary/10 animate-ping" />
          <div className="absolute inset-0 w-14 h-14 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-2 w-10 h-10 border-2 border-accent-secondary/30 border-b-transparent rounded-full animate-spin" style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-bg-primary flex flex-col overflow-hidden">

      <NavBar active="/dashboard" interviewTopic={recommended ?? 'arrays'} />

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Knowledge Graph ── */}
        <div className="flex-1 min-h-0 relative">
          {/* Graph toggle */}
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setUseProgressiveGraph(!useProgressiveGraph)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 10,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {useProgressiveGraph ? 'all topics' : 'grouped'}
            </motion.button>
          </div>

          {useProgressiveGraph ? (
            <ProgressiveGraph
              model={model}
              recommended={recommended}
              onTopicClick={(id) => navigate(`/solve/${id}`)}
            />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="rgba(108,99,255,0.07)" />
              <Controls />
              <MiniMap
                nodeColor={(n) => getMasteryColor((n.data as { mastery: number }).mastery ?? 0)}
                maskColor="rgba(10,10,15,0.85)"
              />
            </ReactFlow>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="w-72 border-l border-border flex flex-col overflow-y-auto scrollbar-thin bg-bg-surface flex-shrink-0">

          {/* Recommended next */}
          {recommended && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border-b border-border"
              style={{ borderTop: '2px solid #6c63ff' }}
            >
              <div className="p-5">
                <p className="font-body text-[10px] text-accent-primary mb-2 uppercase tracking-widest font-medium">
                  Recommended next
                </p>
                <h3 className="font-display text-text-primary font-bold text-base mb-1.5 leading-tight">
                  {TOPIC_GRAPH[recommended]?.label}
                </h3>
                <p className="font-body text-text-secondary text-xs mb-1 leading-relaxed">
                  {getWhyNextExplanation(recommended, masteryMap)}
                </p>
                <p className="font-body text-[10px] text-accent-primary/50 mb-4">
                  Difficulty {TOPIC_GRAPH[recommended]?.difficulty}/6
                </p>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.03, boxShadow: '0 6px 20px rgba(108,99,255,0.4)' }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    onClick={() => navigate(`/solve/${recommended}`)}
                    className="flex-1 text-white font-body text-xs py-2.5 rounded-xl transition-all"
                    style={{ background: 'linear-gradient(135deg, #6c63ff, #5a54d4)', boxShadow: '0 4px 15px rgba(108,99,255,0.3)' }}
                  >
                    solve problem
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    onClick={() => navigate(`/session/${recommended}`)}
                    className="flex-1 border border-border text-text-secondary font-body text-xs py-2.5 rounded-xl hover:bg-bg-elevated hover:text-text-primary transition-all"
                  >
                    concept
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Roadmap */}
          {nextInRoadmap.length > 1 && (
            <div className="p-5 border-b border-border">
              <p className="font-body text-[10px] text-text-secondary mb-3 uppercase tracking-widest">Your roadmap</p>
              <div className="space-y-1">
                {nextInRoadmap.map((topicId, i) => (
                  <motion.button
                    key={topicId}
                    whileHover={{ x: 3, backgroundColor: 'var(--bg-elevated)' }}
                    whileTap={{ scale: 0.98 }}
                    transition={spring}
                    onClick={() => navigate(`/solve/${topicId}`)}
                    className="w-full flex items-center gap-3 text-left rounded-xl px-2 py-2 group"
                  >
                    <span className="font-body text-[10px] text-text-secondary/50 w-4 tabular-nums flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-xs text-text-primary group-hover:text-accent-primary transition-colors truncate">
                        {TOPIC_GRAPH[topicId]?.label ?? topicId}
                      </div>
                      <div className="font-body text-[10px] text-text-secondary">
                        {Math.round((masteryMap[topicId] ?? 0) * 100)}% mastery
                      </div>
                    </div>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: getMasteryColor(masteryMap[topicId] ?? 0),
                        boxShadow: `0 0 6px ${getMasteryColor(masteryMap[topicId] ?? 0)}80`,
                      }}
                    />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Readiness */}
          <div className="p-5 border-b border-border">
            <ReadinessCard snapshot={readiness} calibrationGap={calibrationGap} />
          </div>

          {/* Streak */}
          {answerStreak.length > 0 && (
            <div className="p-5 border-b border-border">
              <Last10Streak />
            </div>
          )}

          {/* Trajectory */}
          {(model.readinessHistory ?? []).length >= 2 && (
            <div className="p-5 border-b border-border">
              <p className="font-body text-[10px] text-text-secondary mb-3 uppercase tracking-widest">Readiness trajectory</p>
              <TrajectorySparkline points={model.readinessHistory!} width={200} height={48} />
            </div>
          )}

          {/* Skill radar */}
          <div className="p-5 border-b border-border">
            <p className="font-body text-[10px] text-text-secondary mb-3 uppercase tracking-widest">Skill overview</p>
            <SkillRadar model={model} />
          </div>

          {/* Weak areas */}
          <div className="p-5 border-b border-border">
            <p className="font-body text-[10px] text-text-secondary mb-3 uppercase tracking-widest">Weak areas</p>
            {weakTopics.length === 0 ? (
              <p className="font-body text-text-secondary text-xs">No active weak areas.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {weakTopics.map(t => (
                  <div key={t} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-accent-danger/5 border border-accent-danger/15">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-danger flex-shrink-0 animate-pulse" />
                    <span className="font-body text-xs text-accent-danger/85 truncate">{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom stats */}
          <div className="p-5">
            <div className="mb-4">
              <CountdownWidget />
            </div>
            <SessionHeatmap sessionDates={sessionDates} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="bg-bg-elevated rounded-xl p-3 border border-border">
                <div className="font-display text-2xl font-bold text-text-primary">{model.sessionCount}</div>
                <div className="font-body text-[10px] text-text-secondary mt-0.5">sessions</div>
              </div>
              <div className="bg-bg-elevated rounded-xl p-3 border border-border">
                <div className="font-display text-2xl font-bold text-text-primary">{Math.round(model.totalMinutes / 60)}h</div>
                <div className="font-body text-[10px] text-text-secondary mt-0.5">total</div>
              </div>
            </div>
          </div>

        </aside>
      </div>

      <AdvisorWidget />
    </div>
  )
}
