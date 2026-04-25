export interface TopicMeta {
  prereqs: string[]
  difficulty: number
  label: string
  category: 'foundation' | 'intermediate' | 'advanced' | 'expert'
}

export const TOPIC_GRAPH: Record<string, TopicMeta> = {
  arrays:                { prereqs: [],                              difficulty: 1, label: 'Arrays',              category: 'foundation' },
  strings:               { prereqs: ['arrays'],                     difficulty: 1, label: 'Strings',             category: 'foundation' },
  sorting:               { prereqs: ['arrays'],                     difficulty: 1, label: 'Sorting',             category: 'foundation' },
  recursion:             { prereqs: [],                              difficulty: 2, label: 'Recursion',           category: 'foundation' },
  hashing:               { prereqs: ['arrays'],                     difficulty: 2, label: 'Hashing',             category: 'foundation' },
  two_pointers:          { prereqs: ['arrays', 'sorting'],          difficulty: 2, label: 'Two Pointers',        category: 'intermediate' },
  sliding_window:        { prereqs: ['arrays', 'two_pointers'],     difficulty: 2, label: 'Sliding Window',      category: 'intermediate' },
  prefix_sum:            { prereqs: ['arrays'],                     difficulty: 2, label: 'Prefix Sum',          category: 'intermediate' },
  binary_search:         { prereqs: ['arrays', 'sorting'],          difficulty: 2, label: 'Binary Search',       category: 'intermediate' },
  linked_list:           { prereqs: ['arrays'],                     difficulty: 2, label: 'Linked List',         category: 'intermediate' },
  stack:                 { prereqs: ['arrays'],                     difficulty: 2, label: 'Stack',               category: 'intermediate' },
  queue:                 { prereqs: ['arrays'],                     difficulty: 2, label: 'Queue',               category: 'intermediate' },
  doubly_linked_list:    { prereqs: ['linked_list'],                difficulty: 2, label: 'Doubly Linked List',  category: 'intermediate' },
  merge_sort:            { prereqs: ['sorting', 'recursion'],       difficulty: 3, label: 'Merge Sort',          category: 'intermediate' },
  quick_sort:            { prereqs: ['sorting', 'recursion'],       difficulty: 3, label: 'Quick Sort',          category: 'intermediate' },
  backtracking:          { prereqs: ['recursion'],                  difficulty: 3, label: 'Backtracking',        category: 'intermediate' },
  fast_slow_pointers:    { prereqs: ['linked_list'],                difficulty: 3, label: 'Fast & Slow Ptrs',   category: 'intermediate' },
  monotonic_stack:       { prereqs: ['stack'],                      difficulty: 3, label: 'Monotonic Stack',     category: 'intermediate' },
  deque:                 { prereqs: ['queue'],                      difficulty: 3, label: 'Deque',               category: 'intermediate' },
  binary_tree:           { prereqs: ['recursion'],                  difficulty: 3, label: 'Binary Tree',         category: 'intermediate' },
  bst:                   { prereqs: ['binary_tree'],                difficulty: 3, label: 'BST',                 category: 'intermediate' },
  tree_traversal:        { prereqs: ['binary_tree'],                difficulty: 2, label: 'Tree Traversal',      category: 'intermediate' },
  heap:                  { prereqs: ['binary_tree'],                difficulty: 3, label: 'Heap',                category: 'intermediate' },
  bit_manipulation:      { prereqs: ['arrays'],                     difficulty: 3, label: 'Bit Manipulation',    category: 'intermediate' },
  intervals:             { prereqs: ['sorting'],                    difficulty: 3, label: 'Intervals',           category: 'intermediate' },
  greedy:                { prereqs: ['sorting'],                    difficulty: 3, label: 'Greedy',              category: 'intermediate' },
  graph_basics:          { prereqs: ['arrays', 'hashing'],          difficulty: 3, label: 'Graph Basics',        category: 'advanced' },
  bfs:                   { prereqs: ['graph_basics', 'queue'],      difficulty: 3, label: 'BFS',                 category: 'advanced' },
  dfs:                   { prereqs: ['graph_basics', 'recursion'],  difficulty: 3, label: 'DFS',                 category: 'advanced' },
  lowest_common_ancestor:{ prereqs: ['binary_tree'],                difficulty: 4, label: 'LCA',                 category: 'advanced' },
  trie:                  { prereqs: ['strings', 'hashing'],         difficulty: 4, label: 'Trie',                category: 'advanced' },
  topological_sort:      { prereqs: ['dfs', 'bfs'],                 difficulty: 4, label: 'Topological Sort',    category: 'advanced' },
  union_find:            { prereqs: ['graph_basics'],               difficulty: 4, label: 'Union Find',          category: 'advanced' },
  shortest_path_dijkstra:{ prereqs: ['graph_basics', 'heap'],       difficulty: 4, label: 'Dijkstra',            category: 'advanced' },
  shortest_path_bellman: { prereqs: ['graph_basics'],               difficulty: 4, label: 'Bellman-Ford',        category: 'advanced' },
  minimum_spanning_tree: { prereqs: ['union_find', 'heap'],         difficulty: 4, label: 'MST',                 category: 'advanced' },
  dp_intro:              { prereqs: ['recursion'],                  difficulty: 4, label: 'DP Intro',            category: 'advanced' },
  dp_1d:                 { prereqs: ['dp_intro'],                   difficulty: 4, label: '1D DP',               category: 'advanced' },
  divide_conquer:        { prereqs: ['recursion', 'merge_sort'],    difficulty: 4, label: 'Divide & Conquer',    category: 'advanced' },
  string_matching:       { prereqs: ['strings'],                    difficulty: 4, label: 'String Matching',     category: 'advanced' },
  dp_2d:                 { prereqs: ['dp_1d'],                      difficulty: 5, label: '2D DP',               category: 'expert' },
  dp_knapsack:           { prereqs: ['dp_1d'],                      difficulty: 5, label: 'Knapsack DP',         category: 'expert' },
  dp_lcs:                { prereqs: ['dp_2d'],                      difficulty: 5, label: 'LCS DP',              category: 'expert' },
  dp_trees:              { prereqs: ['dp_intro', 'binary_tree'],    difficulty: 5, label: 'Tree DP',             category: 'expert' },
  segment_tree:          { prereqs: ['binary_tree', 'prefix_sum'],  difficulty: 5, label: 'Segment Tree',        category: 'expert' },
  fenwick_tree:          { prereqs: ['prefix_sum'],                 difficulty: 5, label: 'Fenwick Tree',        category: 'expert' },
  dp_graphs:             { prereqs: ['dp_intro', 'graph_basics'],   difficulty: 6, label: 'Graph DP',            category: 'expert' },
}

export const DSA_CATEGORIES = {
  foundation: ['arrays', 'strings', 'sorting', 'recursion', 'hashing'],
  intermediate: ['two_pointers', 'sliding_window', 'prefix_sum', 'binary_search', 'linked_list', 'stack', 'queue', 'binary_tree', 'heap', 'bit_manipulation', 'intervals', 'greedy'],
  advanced: ['graph_basics', 'bfs', 'dfs', 'topological_sort', 'union_find', 'dp_intro', 'dp_1d', 'trie'],
  expert: ['dp_2d', 'dp_knapsack', 'dp_lcs', 'segment_tree', 'fenwick_tree', 'dp_graphs'],
}

export function getMasteryColor(mastery: number): string {
  return `hsl(${mastery * 120}, 70%, 50%)`
}

export function getTopicLabel(topicId: string): string {
  return TOPIC_GRAPH[topicId]?.label ?? topicId
}

export function arePrereqsMet(topicId: string, masteryMap: Record<string, number>): boolean {
  const prereqs = TOPIC_GRAPH[topicId]?.prereqs ?? []
  return prereqs.every(p => (masteryMap[p] ?? 0) > 0.5)
}
