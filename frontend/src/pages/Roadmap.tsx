import { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReactFlow, Background, BackgroundVariant, useNodesState, useEdgesState, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { TOPIC_GRAPH, getMasteryColor, arePrereqsMet } from '../lib/topics'
import MasteryNode from '../components/MasteryNode'

const NODE_TYPES = { masteryNode: MasteryNode }

const PHASE_LABELS: Record<string, string> = {
  foundation: 'Foundation',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
}

export default function Roadmap() {
  const navigate = useNavigate()
  const model = useKnowledgeModel()

  const masteryMap = useMemo(() => {
    if (!model) return {}
    const m: Record<string, number> = {}
    for (const [k, v] of Object.entries(model.topics)) m[k] = v.mastery
    return m
  }, [model])

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    const phases: Record<string, string[]> = { foundation: [], intermediate: [], advanced: [], expert: [] }
    for (const [id, meta] of Object.entries(TOPIC_GRAPH)) {
      phases[meta.category]?.push(id)
    }

    const phaseOrder = ['foundation', 'intermediate', 'advanced', 'expert']
    const nodes = []
    const PHASE_X: Record<string, number> = { foundation: 100, intermediate: 350, advanced: 600, expert: 850 }

    for (const phase of phaseOrder) {
      const topicsInPhase = phases[phase] ?? []
      topicsInPhase.forEach((id, rowIdx) => {
        const mastery = masteryMap[id] ?? 0
        const locked = !arePrereqsMet(id, masteryMap)
        nodes.push({
          id,
          type: 'masteryNode',
          position: { x: PHASE_X[phase], y: rowIdx * 65 + 60 },
          data: {
            label: TOPIC_GRAPH[id]?.label ?? id,
            mastery,
            confidence: model?.topics[id]?.confidence ?? 0,
            locked,
            recommended: false,
            category: phase,
          },
        })
      })
    }

    const edges = []
    for (const [id, meta] of Object.entries(TOPIC_GRAPH)) {
      for (const prereq of meta.prereqs) {
        const prereqMastery = masteryMap[prereq] ?? 0
        edges.push({
          id: `${prereq}-${id}`,
          source: prereq,
          target: id,
          style: {
            stroke: prereqMastery > 0.5 ? getMasteryColor(prereqMastery) : 'rgba(108,99,255,0.2)',
            strokeDasharray: prereqMastery > 0.5 ? undefined : '4 4',
            strokeWidth: 1,
            opacity: 0.6,
          },
        })
      }
    }

    return { nodes, edges }
  }, [masteryMap, model])

  const [nodes, , onNodesChange] = useNodesState(rawNodes)
  const [edges, , onEdgesChange] = useEdgesState(rawEdges)

  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string; data: Record<string, unknown> }) => {
    if (!node.data.locked) navigate(`/session/${node.id}`)
  }, [navigate])

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-text-secondary hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-display font-bold text-text-primary">Roadmap</span>
        </div>
        <div className="flex items-center gap-6 text-xs font-body text-text-secondary">
          {Object.entries(PHASE_LABELS).map(([k, v]) => (
            <span key={k}>{v}</span>
          ))}
        </div>
      </header>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="rgba(108,99,255,0.1)" />
          <Controls />
        </ReactFlow>
      </div>

      <div className="px-6 py-3 border-t border-border flex items-center gap-6 text-xs font-body text-text-secondary">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-accent-primary" />
          <span>prereq met</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 border-t border-dashed border-accent-primary/40" />
          <span>locked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ background: getMasteryColor(0.1) }} />
          <span>low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ background: getMasteryColor(0.5) }} />
          <span>mid</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ background: getMasteryColor(0.9) }} />
          <span>mastered</span>
        </div>
      </div>
    </div>
  )
}
