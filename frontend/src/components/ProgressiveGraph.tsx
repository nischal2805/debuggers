import React, { useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'

// ── mastery → color (hsl red→yellow→green) ──────────────────────────────────
function mColor(m: number) {
  return `hsl(${Math.round(m * 120)}, 72%, 50%)`
}

// ── Topic map (condensed for the graph) ─────────────────────────────────────
interface GraphTopic {
  id: string
  label: string
  x: number
  y: number
  group: string
}

// Roughly mirrors Image 1 layout: arrays center-left, branching right/up/down
const GRAPH_TOPICS: GraphTopic[] = [
  // Foundation cluster
  { id: 'arrays',        label: 'Arrays',       x: 100,  y: 380,  group: 'foundation' },
  { id: 'strings',       label: 'Strings',      x: 60,   y: 260,  group: 'foundation' },
  { id: 'sorting',       label: 'Sorting',      x: 230,  y: 295,  group: 'foundation' },
  { id: 'hashing',       label: 'Hashing',      x: 245,  y: 480,  group: 'foundation' },
  { id: 'recursion',     label: 'Recurse',      x: 195,  y: 615,  group: 'foundation' },
  { id: 'bit_manipulation', label: 'Bit Manip', x: 185,  y: 700,  group: 'advanced' },

  // Middle cluster
  { id: 'two_pointers',  label: '2 Ptrs',       x: 385,  y: 210,  group: 'foundation' },
  { id: 'prefix_sum',    label: 'Prefix',       x: 390,  y: 445,  group: 'foundation' },
  { id: 'linked_list',   label: 'LinkedList',   x: 360,  y: 580,  group: 'intermediate' },
  { id: 'backtracking',  label: 'Backtrack',    x: 345,  y: 700,  group: 'advanced' },

  // Right-center cluster
  { id: 'sliding_window',label: 'Slide Win',    x: 545,  y: 160,  group: 'intermediate' },
  { id: 'binary_search', label: 'Bin Srch',     x: 550,  y: 295,  group: 'intermediate' },
  { id: 'stack',         label: 'Stack',        x: 510,  y: 465,  group: 'intermediate' },
  { id: 'queue',         label: 'Queue',        x: 510,  y: 590,  group: 'intermediate' },
  { id: 'dp_intro',      label: 'DP Intro',     x: 490,  y: 755,  group: 'dp' },

  // Trees cluster
  { id: 'binary_tree',   label: 'BinTree',      x: 680,  y: 325,  group: 'trees' },
  { id: 'heap',          label: 'Heap',         x: 675,  y: 500,  group: 'trees' },
  { id: 'bst',           label: 'BST',          x: 825,  y: 248,  group: 'trees' },
  { id: 'tree_traversal',label: 'Traversal',    x: 820,  y: 390,  group: 'trees' },
  { id: 'segment_tree',  label: 'Seg Tree',     x: 975,  y: 295,  group: 'trees' },
  { id: 'trie',          label: 'Trie',         x: 970,  y: 200,  group: 'trees' },

  // Graphs cluster
  { id: 'graph_basics',  label: 'Graphs',       x: 680,  y: 625,  group: 'graphs' },
  { id: 'bfs',           label: 'BFS',          x: 820,  y: 580,  group: 'graphs' },
  { id: 'dfs',           label: 'DFS',          x: 820,  y: 690,  group: 'graphs' },
  { id: 'shortest_path_dijkstra', label: 'Dijkstra', x: 970, y: 640, group: 'graphs' },
  { id: 'topological_sort', label: 'Topo Sort', x: 965, y: 545,  group: 'graphs' },

  // DP
  { id: 'dp_1d',         label: 'DP 1D',        x: 640,  y: 770,  group: 'dp' },
  { id: 'dp_knapsack',   label: 'Knapsack',     x: 775,  y: 780,  group: 'dp' },
]

// edges: [source, target]
const GRAPH_EDGES: [string, string][] = [
  ['arrays', 'strings'],
  ['arrays', 'sorting'],
  ['arrays', 'hashing'],
  ['arrays', 'recursion'],
  ['arrays', 'bit_manipulation'],
  ['arrays', 'two_pointers'],
  ['arrays', 'prefix_sum'],
  ['sorting', 'two_pointers'],
  ['two_pointers', 'sliding_window'],
  ['arrays', 'binary_search'],
  ['sorting', 'binary_search'],
  ['arrays', 'linked_list'],
  ['recursion', 'backtracking'],
  ['arrays', 'stack'],
  ['arrays', 'queue'],
  ['recursion', 'binary_tree'],
  ['binary_tree', 'bst'],
  ['binary_tree', 'tree_traversal'],
  ['binary_tree', 'heap'],
  ['binary_tree', 'segment_tree'],
  ['strings', 'trie'],
  ['hashing', 'trie'],
  ['hashing', 'graph_basics'],
  ['arrays', 'graph_basics'],
  ['graph_basics', 'bfs'],
  ['graph_basics', 'dfs'],
  ['heap', 'shortest_path_dijkstra'],
  ['bfs', 'topological_sort'],
  ['dfs', 'topological_sort'],
  ['recursion', 'dp_intro'],
  ['dp_intro', 'dp_1d'],
  ['dp_1d', 'dp_knapsack'],
]

// Group label positions
const GROUP_LABELS: { label: string; x: number; y: number }[] = [
  { label: 'FOUNDATION', x: 55,  y: 148 },
  { label: 'TREES',      x: 785, y: 148 },
  { label: 'GRAPHS',     x: 785, y: 510 },
  { label: 'DP',         x: 435, y: 710 },
]

// ── Node component ────────────────────────────────────────────────────────────

interface TopicNodeData {
  label: string
  mastery: number
  recommended: boolean
  locked: boolean
  onClick?: () => void
}

function TopicNode({ data }: NodeProps) {
  const d = data as TopicNodeData
  const color = mColor(d.mastery)
  const pct = Math.round(d.mastery * 100)
  const W = 82
  const H = 42
  const CIRC = 2 * Math.PI * 16

  return (
    <div
      style={{
        width: W,
        height: H,
        position: 'relative',
        cursor: d.locked ? 'not-allowed' : 'pointer',
        opacity: d.locked ? 0.4 : 1,
      }}
      onClick={d.onClick}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      {/* Card body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          background: 'var(--bg-elevated)',
          border: `1px solid ${d.recommended ? '#ffb300' : `${color}35`}`,
          boxShadow: d.recommended
            ? '0 0 10px rgba(255,179,0,0.3)'
            : `0 2px 10px rgba(0,0,0,0.35)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Tinted mastery fill */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: color,
            opacity: 0.06 + d.mastery * 0.08,
            borderRadius: 8,
          }}
        />

        {/* Text + arc row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 3px', flex: 1 }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
                letterSpacing: '0.005em',
              }}
            >
              {d.label}
            </div>
            <div
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 8.5,
                color,
                marginTop: 1,
                fontWeight: 500,
              }}
            >
              {pct}%
            </div>
          </div>

          {/* Mini arc ring */}
          <svg width={22} height={22} style={{ flexShrink: 0 }}>
            <circle cx={11} cy={11} r={8} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
            <circle
              cx={11} cy={11} r={8}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={`${d.mastery * (2 * Math.PI * 8)} ${2 * Math.PI * 8}`}
              strokeDashoffset={(2 * Math.PI * 8) * 0.25}
              transform="rotate(-90 11 11)"
              style={{ opacity: 0.9 }}
            />
          </svg>
        </div>

        {/* Bottom progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: color,
              transition: 'width 0.5s ease',
              boxShadow: `0 0 4px ${color}80`,
            }}
          />
        </div>
      </div>

      {/* Recommended dot */}
      {d.recommended && (
        <div
          style={{
            position: 'absolute',
            top: 4, right: 4,
            width: 5, height: 5, borderRadius: '50%',
            background: '#ffb300',
            boxShadow: '0 0 5px #ffb300aa',
            zIndex: 2,
          }}
        />
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

const NODE_TYPES = { topic: TopicNode }

// ── Main component ────────────────────────────────────────────────────────────

interface ProgressiveGraphProps {
  model: any
  recommended?: string | null
  onTopicClick?: (topicId: string) => void
}

export default function ProgressiveGraph({ model, recommended, onTopicClick }: ProgressiveGraphProps) {
  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    const nodes: Node[] = GRAPH_TOPICS.map(t => {
      const mastery = model?.topics?.[t.id]?.mastery ?? 0
      return {
        id: t.id,
        type: 'topic',
        position: { x: t.x, y: t.y },
        data: {
          label: t.label,
          mastery,
          recommended: t.id === recommended,
          locked: false,
          onClick: onTopicClick ? () => onTopicClick(t.id) : undefined,
        },
      }
    })

    const edges: Edge[] = GRAPH_EDGES.map(([src, tgt]) => {
      const srcMastery = model?.topics?.[src]?.mastery ?? 0
      const met = srcMastery > 0.5
      return {
        id: `${src}-${tgt}`,
        source: src,
        target: tgt,
        animated: met,
        style: {
          stroke: met ? mColor(srcMastery) : 'rgba(108,99,255,0.22)',
          strokeWidth: met ? 1.8 : 1.2,
          strokeDasharray: met ? undefined : '5 5',
          opacity: met ? 0.75 : 0.4,
        },
      }
    })

    return { nodes, edges }
  }, [model?.topics, recommended, onTopicClick])

  const [flowNodes, setFlowNodes] = useNodesState(rawNodes)
  const [flowEdges, setFlowEdges] = useEdgesState(rawEdges)

  React.useEffect(() => { setFlowNodes(rawNodes) }, [rawNodes, setFlowNodes])
  React.useEffect(() => { setFlowEdges(rawEdges) }, [rawEdges, setFlowEdges])

  // Legend
  const legendItems = [
    { color: '#ff4757', label: '< 30%' },
    { color: '#ffb300', label: '30-60%' },
    { color: '#00e676', label: '> 60%' },
  ]

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--bg-primary)' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES as any}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.35}
        maxZoom={2.5}
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        {/* Group label overlays */}
        {GROUP_LABELS.map(g => (
          <div
            key={g.label}
            style={{
              position: 'absolute',
              left: g.x,
              top: g.y,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(136,136,170,0.45)',
              letterSpacing: '0.15em',
              userSelect: 'none',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            {g.label}
          </div>
        ))}

        <Background
          color="rgba(108,99,255,0.06)"
          gap={28}
          size={1.5}
          variant={BackgroundVariant.Dots}
        />
        <Controls
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
          }}
        />
      </ReactFlow>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {legendItems.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: l.color, boxShadow: `0 0 5px ${l.color}88` }} />
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'var(--text-secondary)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
