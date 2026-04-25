import { useEffect, useMemo, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReactFlow, Background, BackgroundVariant, useNodesState, useEdgesState, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { TOPIC_GRAPH, getMasteryColor, arePrereqsMet } from '../lib/topics'
import MasteryNode from '../components/MasteryNode'
import SkillRadar from '../components/SkillRadar'
import SessionHeatmap from '../components/SessionHeatmap'
import ReadinessCard from '../components/ReadinessCard'
import Last10Streak from '../components/Last10Streak'
import TrajectorySparkline from '../components/TrajectorySparkline'
import AdvisorWidget from '../components/AdvisorWidget'

const NODE_TYPES = { masteryNode: MasteryNode }
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

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
  const { user, readiness, calibrationGap, answerStreak } = useStore()
  const model = useKnowledgeModel()
  const navigate = useNavigate()
  const [recommended, setRecommended] = useState<string | null>(null)
  const [roadmap, setRoadmap] = useState<string[]>([])

  // Fetch roadmap from backend (authoritative)
  useEffect(() => {
    if (!user) return
    const { isDemoMode, demoToken } = useStore.getState()
    const tokenPromise = isDemoMode && demoToken
      ? Promise.resolve(demoToken)
      : auth.currentUser?.getIdToken() ?? Promise.resolve(null)

    tokenPromise.then(token => {
      if (!token) return
      fetch(`${BACKEND_URL}/user/roadmap`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          const list: string[] = data.roadmap ?? []
          setRoadmap(list)
          setRecommended(list[0] ?? null)
        })
        .catch(() => {
          // fallback: local computation
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
        position: { x: (meta.difficulty - 1) * 160 + 60, y: row * 70 + 40 },
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
        return {
          id: `${prereq}-${id}`,
          source: prereq,
          target: id,
          style: {
            stroke: prereqMastery > 0.5 ? `hsl(${prereqMastery * 120}, 60%, 45%)` : 'rgba(108,99,255,0.2)',
            strokeDasharray: prereqMastery > 0.5 ? undefined : '4 4',
            strokeWidth: 1,
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
    navigate(`/session/${node.id}`)
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
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="font-display font-bold text-text-primary text-lg tracking-tight">NeuralDSA</span>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/roadmap')} className="font-body text-text-secondary text-sm hover:text-text-primary transition-colors">roadmap</button>
          <button onClick={() => navigate('/profile')} className="font-body text-text-secondary text-sm hover:text-text-primary transition-colors">profile</button>
          <div className="w-7 h-7 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center text-xs font-body text-accent-primary">
            {user?.name?.[0] ?? 'U'}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 min-h-[500px]">
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
            <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="rgba(108,99,255,0.1)" />
            <Controls />
            <MiniMap nodeColor={(n) => getMasteryColor((n.data as { mastery: number }).mastery ?? 0)} maskColor="rgba(10,10,15,0.8)" />
          </ReactFlow>
        </div>

        <aside className="w-72 border-l border-border flex flex-col overflow-y-auto scrollbar-thin">
          {recommended && (
            <div className="p-5 border-b border-border">
              <p className="font-body text-text-secondary text-xs mb-2 uppercase tracking-wider">Recommended next</p>
              <h3 className="font-display text-text-primary font-semibold text-base mb-1">
                {TOPIC_GRAPH[recommended]?.label}
              </h3>
              <p className="font-body text-text-secondary text-xs mb-1">
                {getWhyNextExplanation(recommended, masteryMap)}
              </p>
              <p className="font-body text-[10px] text-accent-primary/60 mb-4">
                Difficulty {TOPIC_GRAPH[recommended]?.difficulty}/6
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/session/${recommended}`)}
                  className="flex-1 bg-accent-primary hover:bg-accent-primary/90 text-white font-body text-sm py-2.5 rounded-lg transition-colors"
                >
                  tutor session
                </button>
                <button
                  onClick={() => navigate(`/solve/${recommended}`)}
                  className="flex-1 border border-accent-primary/40 text-accent-primary font-body text-sm py-2.5 rounded-lg hover:bg-accent-primary/10 transition-colors"
                >
                  solve problem
                </button>
              </div>
            </div>
          )}

          {nextInRoadmap.length > 1 && (
            <div className="p-5 border-b border-border">
              <p className="font-body text-text-secondary text-xs mb-3 uppercase tracking-wider">Your roadmap</p>
              <div className="space-y-2">
                {nextInRoadmap.map((topicId, i) => (
                  <button
                    key={topicId}
                    onClick={() => navigate(`/session/${topicId}`)}
                    className="w-full flex items-center gap-3 text-left hover:bg-bg-elevated rounded-lg p-2 transition-colors group"
                  >
                    <span className="font-body text-[10px] text-text-secondary w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="font-body text-xs text-text-primary group-hover:text-accent-primary transition-colors">
                        {TOPIC_GRAPH[topicId]?.label ?? topicId}
                      </div>
                      <div className="font-body text-[10px] text-text-secondary">
                        {Math.round((masteryMap[topicId] ?? 0) * 100)}% mastery
                      </div>
                    </div>
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: getMasteryColor(masteryMap[topicId] ?? 0) }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-5 border-b border-border">
            <ReadinessCard snapshot={readiness} calibrationGap={calibrationGap} />
          </div>

          {answerStreak.length > 0 && (
            <div className="p-5 border-b border-border">
              <Last10Streak />
            </div>
          )}

          {(model.readinessHistory ?? []).length >= 2 && (
            <div className="p-5 border-b border-border">
              <p className="font-body text-text-secondary text-xs mb-3 uppercase tracking-wider">Readiness trajectory</p>
              <TrajectorySparkline points={model.readinessHistory!} width={200} height={48} />
            </div>
          )}

          <div className="p-5 border-b border-border">
            <p className="font-body text-text-secondary text-xs mb-3 uppercase tracking-wider">Skill overview</p>
            <SkillRadar model={model} />
          </div>

          <div className="p-5 border-b border-border">
            <p className="font-body text-text-secondary text-xs mb-3 uppercase tracking-wider">Weak areas</p>
            {weakTopics.length === 0 ? (
              <p className="font-body text-text-secondary text-xs">No active weak areas.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {weakTopics.map(t => (
                  <div key={t} className="font-body text-xs text-accent-danger">{t}</div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5">
            <SessionHeatmap sessionDates={[]} />
            <div className="mt-4 flex gap-4">
              <div>
                <div className="font-display text-xl font-bold text-text-primary">{model.sessionCount}</div>
                <div className="font-body text-[10px] text-text-secondary">sessions</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-text-primary">{Math.round(model.totalMinutes / 60)}h</div>
                <div className="font-body text-[10px] text-text-secondary">total</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <AdvisorWidget />
    </div>
  )
}
