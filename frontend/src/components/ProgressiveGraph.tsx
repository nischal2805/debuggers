import React, { useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow'
import type { Node, Edge, NodeProps } from 'reactflow'
import 'reactflow/dist/style.css'
import { motion } from 'framer-motion'

interface Topic {
  id: string
  name: string
  mastery: number
  children: string[]
}

const DOMAIN_NODES: Record<string, Topic> = {
  'arrays': {
    id: 'arrays',
    name: 'Arrays & Basics',
    mastery: 0.7,
    children: ['strings', 'hashing', 'two_pointers', 'sliding_window', 'prefix_sum', 'binary_search'],
  },
  'sorting': {
    id: 'sorting',
    name: 'Sorting',
    mastery: 0.6,
    children: ['merge_sort', 'quick_sort'],
  },
  'recursion': {
    id: 'recursion',
    name: 'Recursion & Backtracking',
    mastery: 0.4,
    children: ['backtracking'],
  },
  'linked_list': {
    id: 'linked_list',
    name: 'Linked Lists',
    mastery: 0.5,
    children: ['doubly_linked_list', 'fast_slow_pointers'],
  },
  'trees': {
    id: 'trees',
    name: 'Trees & Tries',
    mastery: 0.3,
    children: ['binary_tree', 'bst', 'tree_traversal', 'heap', 'segment_tree', 'trie'],
  },
  'graphs': {
    id: 'graphs',
    name: 'Graphs',
    mastery: 0.2,
    children: ['graph_basics', 'bfs', 'dfs', 'topological_sort', 'union_find', 'shortest_path_dijkstra', 'minimum_spanning_tree'],
  },
  'dp': {
    id: 'dp',
    name: 'Dynamic Programming',
    mastery: 0.1,
    children: ['dp_intro', 'dp_1d', 'dp_2d', 'dp_knapsack', 'dp_lcs', 'dp_trees', 'dp_graphs'],
  },
  'advanced': {
    id: 'advanced',
    name: 'Advanced Topics',
    mastery: 0.05,
    children: ['bit_manipulation', 'intervals', 'greedy', 'divide_conquer', 'string_matching'],
  },
}

interface MasteryNodeProps extends NodeProps {
  data: {
    label: string
    mastery: number
    isExpanded: boolean
    onToggle: () => void
    hasChildren: boolean
  }
}

function MasteryNode({ data }: MasteryNodeProps) {
  const masterColor = data.mastery > 0.7 ? '#00e676' : data.mastery > 0.4 ? '#ffb300' : '#ff4757'

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="px-4 py-3 rounded-lg border-2 cursor-pointer transition-all"
      style={{
        borderColor: masterColor,
        backgroundColor: 'var(--bg-elevated)',
        boxShadow: `0 0 8px ${masterColor}40`,
      }}
      onClick={data.onToggle}
      whileHover={{ scale: 1.05 }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="text-center">
        <div className="font-display font-bold text-sm text-text-primary">
          {data.label}
        </div>
        <div
          className="font-body text-xs mt-1"
          style={{ color: masterColor }}
        >
          {Math.round(data.mastery * 100)}%
        </div>
      </div>
      {data.hasChildren && (
        <div className="text-center mt-1.5 font-body text-[10px] text-text-secondary">
          {data.isExpanded ? '▼ collapse' : '▶ expand'}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </motion.div>
  )
}

interface ProgressiveGraphProps {
  model: any
}

export default function ProgressiveGraph({ model }: ProgressiveGraphProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  // Build nodes and edges
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Add domain nodes (always visible)
    const ySpacing = 250
    const xSpacing = 300
    const domainEntries = Object.entries(DOMAIN_NODES)

    domainEntries.forEach((_, i) => {
      const x = (i % 3) * xSpacing
      const y = Math.floor(i / 3) * ySpacing

      const key = Object.keys(DOMAIN_NODES)[i]
      const domain = DOMAIN_NODES[key]

      nodes.push({
        id: key,
        data: {
          label: domain.name,
          mastery: model?.topics?.[key]?.mastery ?? domain.mastery,
          isExpanded: expandedNodes.has(key),
          onToggle: () => toggleNode(key),
          hasChildren: domain.children.length > 0,
        },
        position: { x, y },
        type: 'mastery',
      })
    })

    // Add child nodes if domain is expanded
    expandedNodes.forEach((domainId) => {
      const domain = DOMAIN_NODES[domainId]
      if (!domain || !domain.children) return

      const domainNodeIdx = Object.keys(DOMAIN_NODES).indexOf(domainId)
      const baseX = (domainNodeIdx % 3) * xSpacing
      const baseY = Math.floor(domainNodeIdx / 3) * ySpacing

      domain.children.forEach((childId, idx) => {
        const offsetX = (idx - domain.children.length / 2) * 120
        const offsetY = 150

        nodes.push({
          id: childId,
          data: {
            label: childId.replace(/_/g, ' '),
            mastery: model?.topics?.[childId]?.mastery ?? 0.2,
            isExpanded: false,
            onToggle: () => {},
            hasChildren: false,
          },
          position: { x: baseX + offsetX, y: baseY + offsetY },
          type: 'mastery',
        })

        edges.push({
          id: `${domainId}-${childId}`,
          source: domainId,
          target: childId,
          animated: expandedNodes.has(domainId),
        })
      })
    })

    return { nodes, edges }
  }, [expandedNodes, model?.topics, toggleNode])

  const [flowNodes, setFlowNodes] = useNodesState(nodes)
  const [flowEdges, setFlowEdges] = useEdgesState(edges)

  React.useEffect(() => {
    setFlowNodes(nodes)
  }, [nodes, setFlowNodes])

  React.useEffect(() => {
    setFlowEdges(edges)
  }, [edges, setFlowEdges])

  return (
    <div className="w-full h-full bg-bg-primary rounded-lg border border-border overflow-hidden">
      <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={{ mastery: MasteryNode as any }}>
        <Background color="var(--border)" gap={16} size={1} />
        <Controls />
      </ReactFlow>
      
      <div className="absolute bottom-4 left-4 bg-bg-elevated border border-border rounded p-3 z-10">
        <p className="font-body text-[10px] text-text-secondary">
          Click any domain to expand and see sub-topics
        </p>
      </div>
    </div>
  )
}
