import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import type { KnowledgeModel } from '../lib/types'

interface Props {
  model: KnowledgeModel
}

const CATEGORIES = [
  { key: 'Arrays/Strings', topics: ['arrays', 'strings', 'hashing', 'two_pointers', 'sliding_window'] },
  { key: 'Trees', topics: ['binary_tree', 'bst', 'tree_traversal', 'heap', 'trie'] },
  { key: 'Graphs', topics: ['graph_basics', 'bfs', 'dfs', 'topological_sort', 'union_find'] },
  { key: 'DP', topics: ['dp_intro', 'dp_1d', 'dp_2d', 'dp_knapsack', 'dp_lcs'] },
  { key: 'Sorting/Search', topics: ['sorting', 'binary_search', 'merge_sort', 'quick_sort'] },
  { key: 'Linked List', topics: ['linked_list', 'fast_slow_pointers', 'doubly_linked_list'] },
]

export default function SkillRadar({ model }: Props) {
  const data = CATEGORIES.map(cat => {
    const scores = cat.topics.map(t => model.topics[t]?.mastery ?? 0)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    return { subject: cat.key, value: Math.round(avg * 100) }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke="rgba(108,99,255,0.15)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#8888aa', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
        />
        <Radar
          name="Mastery"
          dataKey="value"
          stroke="#6c63ff"
          fill="#6c63ff"
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
