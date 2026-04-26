import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import TrajectorySparkline from '../components/TrajectorySparkline'
import { motion } from 'framer-motion'
import NavBar from '../components/NavBar'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function JudgeDashboard() {
  const navigate = useNavigate()
  const { user, readiness, lastReport, setReadiness, isDemoMode, demoToken } = useStore()
  const model = useKnowledgeModel()

  useEffect(() => {
    if (!user) return
    const tokenPromise = isDemoMode && demoToken
      ? Promise.resolve(demoToken)
      : auth?.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)
    tokenPromise.then(token => {
      if (!token) return
      fetch(`${BACKEND_URL}/user/readiness`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.snapshot) setReadiness(data.snapshot, data.calibration_gap ?? 0)
        })
        .catch(() => {})
    })
  }, [user, isDemoMode, demoToken, setReadiness])

  if (!user || !model) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    )
  }

  // Compute top misconceptions
  const miscHistogram: Record<string, number> = {}
  if (model) {
    for (const stat of Object.values(model.topics)) {
      for (const [type, count] of Object.entries(stat.misconceptionHistogram ?? {})) {
        miscHistogram[type] = (miscHistogram[type] ?? 0) + count
      }
    }
  }
  const miscSorted = Object.entries(miscHistogram)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // Compute category strengths (arrays, strings, trees, graphs, dp, sorting)
  const categoryMastery: Record<string, number[]> = {
    'Arrays': [],
    'Strings': [],
    'Trees': [],
    'Graphs': [],
    'DP': [],
    'Sorting': [],
  }

  Object.entries(model.topics).forEach(([topicId, stat]) => {
    const mastery = stat.mastery ?? 0
    if (['arrays', 'two_pointers', 'sliding_window', 'prefix_sum'].includes(topicId)) {
      categoryMastery['Arrays'].push(mastery)
    } else if (['strings', 'trie'].includes(topicId)) {
      categoryMastery['Strings'].push(mastery)
    } else if (['binary_tree', 'bst', 'tree_traversal', 'segment_tree'].includes(topicId)) {
      categoryMastery['Trees'].push(mastery)
    } else if (['graph_basics', 'bfs', 'dfs', 'shortest_path_dijkstra', 'union_find'].includes(topicId)) {
      categoryMastery['Graphs'].push(mastery)
    } else if (topicId.includes('dp')) {
      categoryMastery['DP'].push(mastery)
    } else if (['sorting', 'merge_sort', 'quick_sort'].includes(topicId)) {
      categoryMastery['Sorting'].push(mastery)
    }
  })

  const categoryScores = Object.entries(categoryMastery)
    .map(([cat, scores]) => ({
      name: cat,
      avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)

  // Top mastered concepts
  const masteredConcepts = Object.entries(model.topics)
    .filter(([, v]) => v.mastery >= 0.80)
    .map(([k, v]) => ({ topic: k, mastery: v.mastery }))
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 5)

  // Readiness interpretation
  const readinessLevel =
    readiness.total < 20 ? 'Beginner' :
    readiness.total < 40 ? 'Intermediate' :
    readiness.total < 70 ? 'Advanced' :
    'Expert'

  const readinessColor =
    readiness.total < 20 ? 'text-accent-danger' :
    readiness.total < 40 ? 'text-accent-warn' :
    readiness.total < 70 ? 'text-accent-success' :
    'text-accent-secondary'

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar active="/judge" />
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-bg-surface/60">
        <span className="font-display font-bold text-text-primary text-sm">Judge Dashboard</span>
        <span className="font-body text-xs text-text-secondary">— {user?.name}'s real-time state</span>
      </div>

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-12 gap-6">
          {/* Large readiness card (left) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-12 lg:col-span-5"
          >
            <div className="bg-bg-elevated border border-border rounded-lg p-8">
              <h2 className="font-display font-bold text-lg text-text-primary mb-6">
                Interview Readiness
              </h2>

              {/* Big score */}
              <div className="text-center mb-8">
                <div className={`font-display text-5xl font-bold ${readinessColor}`}>
                  {Math.round(readiness.total)}
                </div>
                <p className={`font-body text-sm mt-2 ${readinessColor}`}>
                  {readinessLevel}
                </p>
              </div>

              {/* Subscores */}
              <div className="space-y-3 mb-8">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-body text-xs text-text-secondary">Knowledge Coverage</span>
                    <span className="font-body text-xs font-bold text-text-primary">
                      {Math.round(readiness.coverage)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-success"
                      style={{ width: `${readiness.coverage}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-body text-xs text-text-secondary">Accuracy</span>
                    <span className="font-body text-xs font-bold text-text-primary">
                      {Math.round(readiness.accuracy)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-secondary"
                      style={{ width: `${readiness.accuracy}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-body text-xs text-text-secondary">Speed</span>
                    <span className="font-body text-xs font-bold text-text-primary">
                      {Math.round(readiness.speed)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-warn"
                      style={{ width: `${readiness.speed}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-body text-xs text-text-secondary">Consistency</span>
                    <span className="font-body text-xs font-bold text-text-primary">
                      {Math.round(readiness.consistency)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-secondary"
                      style={{ width: `${readiness.consistency}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Interpretation */}
              <div className="bg-bg-primary rounded p-4 border border-border">
                <p className="font-body text-xs text-text-secondary">
                  {readiness.total < 20 ? 'New to DSA. Focus on foundations: arrays, strings, basic trees.' :
                   readiness.total < 40 ? 'Intermediate. Solidify core concepts before tackling advanced DP.' :
                   readiness.total < 70 ? 'Advanced. Ready for FAANG-style interviews with more practice on hard DP and graphs.' :
                   'Expert level. Ready for final-round interview simulation.'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right column stack */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            {/* Top misconceptions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-bg-elevated border border-border rounded-lg p-6"
            >
              <h3 className="font-display font-bold text-sm text-text-primary mb-4">
                Top Error Patterns
              </h3>
              {miscSorted.length > 0 ? (
                <div className="space-y-3">
                  {miscSorted.map(([type, count], i) => (
                    <div key={type} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-bg-primary flex items-center justify-center">
                        <span className="font-body text-[10px] font-bold text-text-secondary">
                          {i + 1}
                        </span>
                      </div>
                      <span className="font-body text-xs text-text-primary flex-1">
                        {type.replace(/_/g, ' ')}
                      </span>
                      <span className="font-body text-[10px] text-text-secondary bg-bg-primary rounded px-2 py-1">
                        {count}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-xs text-text-secondary">No errors yet — keep practicing.</p>
              )}
            </motion.div>

            {/* Category strength */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-bg-elevated border border-border rounded-lg p-6"
            >
              <h3 className="font-display font-bold text-sm text-text-primary mb-4">
                Strength by Category
              </h3>
              <div className="space-y-2.5">
                {categoryScores.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-body text-xs text-text-secondary">
                        {cat.name} ({cat.count})
                      </span>
                      <span className="font-body text-xs font-bold text-text-primary">
                        {Math.round(cat.avg * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${cat.avg * 100}%`,
                          background: cat.avg > 0.7 ? '#00e676' : cat.avg > 0.4 ? '#ffb300' : '#ff4757',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Mastered concepts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-bg-elevated border border-border rounded-lg p-6"
            >
              <h3 className="font-display font-bold text-sm text-text-primary mb-4">
                Mastered Concepts
              </h3>
              {masteredConcepts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {masteredConcepts.map((c) => (
                    <div key={c.topic} className="bg-bg-primary rounded px-3 py-1.5 border border-accent-success/30">
                      <span className="font-body text-[10px] text-accent-success uppercase tracking-wider">
                        {c.topic.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-xs text-text-secondary">Complete 3+ practice sessions to unlock mastery badges.</p>
              )}
            </motion.div>

            {/* Trajectory */}
            {model?.readinessHistory && model.readinessHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-bg-elevated border border-border rounded-lg p-6"
              >
                <h3 className="font-display font-bold text-sm text-text-primary mb-4">
                  Readiness Trajectory
                </h3>
                <TrajectorySparkline points={model.readinessHistory} width={300} height={80} />
              </motion.div>
            )}
          </div>
        </div>

        {/* Session summary */}
        {lastReport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 bg-bg-elevated border border-border rounded-lg p-8"
          >
            <h2 className="font-display font-bold text-lg text-text-primary mb-6">
              Last Session Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-2">
                  Strongest
                </p>
                <p className="font-body text-sm text-accent-success">
                  {lastReport.strongest_concept}
                </p>
              </div>
              <div>
                <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-2">
                  Gap to Close
                </p>
                <p className="font-body text-sm text-accent-warn">
                  {lastReport.biggest_gap}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-2">
                  Next Focus
                </p>
                <ul className="space-y-1">
                  {lastReport.next_focus?.map((item: string, i: number) => (
                    <li key={i} className="font-body text-sm text-text-primary">— {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="font-body text-xs text-text-secondary hover:text-accent-secondary transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
