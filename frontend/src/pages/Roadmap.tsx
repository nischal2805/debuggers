import { useMemo, useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow, Background, BackgroundVariant,
  useNodesState, useEdgesState, Controls,
  type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import {
  TOPIC_GRAPH, getMasteryColor, arePrereqsMet,
  DOMAIN_GROUPS, aggregateDomainMastery,
} from '../lib/topics'
import MasteryNode from '../components/MasteryNode'
import DomainGroupNode from '../components/DomainGroupNode'

const NODE_TYPES = { masteryNode: MasteryNode, domainGroup: DomainGroupNode }

const DOMAIN_ORDER = [
  'arrays_strings',
  'linked_structures',
  'recursion_search',
  'trees',
  'graphs',
  'dynamic_programming',
]

// Which domains are expanded in L0 view
function buildL0Graph(
  masteryMap: Record<string, number>,
  expandedDomains: Set<string>,
  confidenceMap: Record<string, number>
): { nodes: Node[], edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const COL_W = 240
  const COL_TOPIC_X_OFFSET = 270
  const ROW_H = 70

  DOMAIN_ORDER.forEach((domainId, di) => {
    const group = DOMAIN_GROUPS[domainId]
    if (!group) return
    const { avg, mastered, total } = aggregateDomainMastery(domainId, masteryMap)
    const expanded = expandedDomains.has(domainId)
    const domainY = di * 130

    nodes.push({
      id: `domain__${domainId}`,
      type: 'domainGroup',
      position: { x: 60, y: domainY },
      data: {
        label: group.label,
        avg,
        mastered,
        total,
        color: group.color,
        expanded,
        domainId,
      },
    })

    if (expanded) {
      group.topics.forEach((topicId, ti) => {
        const mastery = masteryMap[topicId] ?? 0
        const locked = !arePrereqsMet(topicId, masteryMap)
        nodes.push({
          id: topicId,
          type: 'masteryNode',
          position: { x: 60 + COL_W + COL_TOPIC_X_OFFSET * (Math.floor(ti / 5)), y: domainY + (ti % 5) * ROW_H - 80 },
          data: {
            label: TOPIC_GRAPH[topicId]?.label ?? topicId,
            mastery,
            confidence: confidenceMap[topicId] ?? 0,
            locked,
            recommended: false,
            category: TOPIC_GRAPH[topicId]?.category ?? '',
          },
        })
        edges.push({
          id: `domain__${domainId}-${topicId}`,
          source: `domain__${domainId}`,
          target: topicId,
          style: {
            stroke: group.color,
            strokeOpacity: 0.3,
            strokeWidth: 1,
            strokeDasharray: locked ? '4 4' : undefined,
          },
        })
        // prereq edges within expanded domain
        for (const prereq of TOPIC_GRAPH[topicId]?.prereqs ?? []) {
          if (group.topics.includes(prereq)) {
            const prereqMastery = masteryMap[prereq] ?? 0
            edges.push({
              id: `${prereq}-${topicId}`,
              source: prereq,
              target: topicId,
              style: {
                stroke: prereqMastery > 0.5 ? getMasteryColor(prereqMastery) : 'rgba(108,99,255,0.2)',
                strokeDasharray: prereqMastery > 0.5 ? undefined : '4 4',
                strokeWidth: 1,
                opacity: 0.7,
              },
            })
          }
        }
      })
    }
  })

  return { nodes, edges }
}

function buildL2Graph(masteryMap: Record<string, number>, confidenceMap: Record<string, number>): { nodes: Node[], edges: Edge[] } {
  const phases: Record<string, string[]> = { foundation: [], intermediate: [], advanced: [], expert: [] }
  for (const [id, meta] of Object.entries(TOPIC_GRAPH)) {
    phases[meta.category]?.push(id)
  }

  const phaseOrder = ['foundation', 'intermediate', 'advanced', 'expert']
  const nodes: Node[] = []
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
          confidence: confidenceMap[id] ?? 0,
          locked,
          recommended: false,
          category: phase,
        },
      })
    })
  }

  const edges: Edge[] = []
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
}

export default function Roadmap() {
  const navigate = useNavigate()
  const model = useKnowledgeModel()
  const [disclosureLevel, setDisclosureLevel] = useState<'L0' | 'L2'>('L0')
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())

  const masteryMap = useMemo(() => {
    if (!model) return {}
    const m: Record<string, number> = {}
    for (const [k, v] of Object.entries(model.topics)) m[k] = v.mastery
    return m
  }, [model])

  const confidenceMap = useMemo(() => {
    if (!model) return {}
    const c: Record<string, number> = {}
    for (const [k, v] of Object.entries(model.topics)) c[k] = v.confidence
    return c
  }, [model])

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    if (disclosureLevel === 'L0') {
      return buildL0Graph(masteryMap, expandedDomains, confidenceMap)
    }
    return buildL2Graph(masteryMap, confidenceMap)
  }, [masteryMap, disclosureLevel, expandedDomains, confidenceMap])

  const [nodes, setNodes, onNodesChange] = useNodesState(rawNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges)

  useEffect(() => { setNodes(rawNodes) }, [rawNodes, setNodes])
  useEffect(() => { setEdges(rawEdges) }, [rawEdges, setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string; type?: string; data: Record<string, unknown> }) => {
    if (node.type === 'domainGroup') {
      const domainId = node.data.domainId as string
      setExpandedDomains(prev => {
        const next = new Set(prev)
        if (next.has(domainId)) next.delete(domainId)
        else next.add(domainId)
        return next
      })
      return
    }
    if (!node.data.locked) navigate(`/solve/${node.id}`)
  }, [navigate])

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
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-text-secondary hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-display font-bold text-text-primary">Roadmap</span>
        </div>

        <div className="flex items-center gap-1 bg-bg-elevated border border-border rounded-md p-0.5">
          {(['L0', 'L2'] as const).map(level => (
            <button
              key={level}
              onClick={() => setDisclosureLevel(level)}
              className="font-body text-xs px-3 py-1.5 rounded transition-colors"
              style={
                disclosureLevel === level
                  ? { background: '#6c63ff', color: '#fff' }
                  : { color: '#8888aa' }
              }
            >
              {level === 'L0' ? 'domains' : 'all topics'}
            </button>
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
          fitViewOptions={{ padding: 0.12 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="rgba(108,99,255,0.1)" />
          <Controls />
        </ReactFlow>
      </div>

      <div className="px-6 py-3 border-t border-border flex items-center gap-6 text-xs font-body text-text-secondary">
        {disclosureLevel === 'L0' && (
          <span>Click a domain to expand its topics. Click a topic to start a session.</span>
        )}
        {disclosureLevel === 'L2' && (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
