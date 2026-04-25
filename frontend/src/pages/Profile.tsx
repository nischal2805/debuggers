import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { TOPIC_GRAPH, getMasteryColor } from '../lib/topics'
import SkillRadar from '../components/SkillRadar'
import ReadinessCard from '../components/ReadinessCard'
import TrajectorySparkline from '../components/TrajectorySparkline'
import AssessmentLevelBadge from '../components/AssessmentLevelBadge'
import ReportCardPanel from '../components/ReportCardPanel'
import type { ReportCard } from '../lib/types'

export default function Profile() {
  const navigate = useNavigate()
  const { user, isDemoMode, exitDemoMode, readiness, calibrationGap, lastReport } = useStore()
  const model = useKnowledgeModel()

  const handleLogout = async () => {
    if (isDemoMode) {
      sessionStorage.removeItem('neuraldsa_demo_token')
      exitDemoMode()
      navigate('/')
      return
    }
    await signOut(auth)
    navigate('/')
  }

  const topTopics = model
    ? Object.entries(model.topics)
        .filter(([, v]) => v.mastery > 0 || v.attempts > 0)
        .sort((a, b) => b[1].mastery - a[1].mastery)
        .slice(0, 15)
    : []

  // Misconception histogram across all topics
  const miscHistogram: Record<string, number> = {}
  if (model) {
    for (const stat of Object.values(model.topics)) {
      for (const [type, count] of Object.entries(stat.misconceptionHistogram ?? {})) {
        miscHistogram[type] = (miscHistogram[type] ?? 0) + count
      }
    }
  }
  const miscSorted = Object.entries(miscHistogram).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const miscMax = miscSorted[0]?.[1] ?? 1

  const readinessHistory = model?.readinessHistory ?? []

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-text-secondary hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-display font-bold text-text-primary">Profile</span>
          {isDemoMode && (
            <span className="font-body text-[10px] text-accent-warn border border-accent-warn/30 rounded px-1.5 py-0.5">
              demo
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="font-body text-sm text-text-secondary hover:text-accent-danger transition-colors"
        >
          {isDemoMode ? 'exit demo' : 'sign out'}
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* User header */}
        <div className="flex items-center gap-5">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center text-xl font-display text-accent-primary">
              {user?.name?.[0] ?? 'U'}
            </div>
          )}
          <div>
            <div className="font-display text-xl font-bold text-text-primary">{user?.name}</div>
            <div className="font-body text-sm text-text-secondary">{user?.email}</div>
          </div>
        </div>

        {/* Stats row */}
        {model && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <div className="font-display text-3xl font-bold text-text-primary">{model.sessionCount}</div>
              <div className="font-body text-xs text-text-secondary mt-1">sessions</div>
            </div>
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <div className="font-display text-3xl font-bold text-text-primary">{Math.round(model.totalMinutes / 60)}h</div>
              <div className="font-body text-xs text-text-secondary mt-1">study time</div>
            </div>
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <div className="font-display text-3xl font-bold text-text-primary">
                {Object.values(model.topics).filter(v => v.mastery > 0.85).length}
              </div>
              <div className="font-body text-xs text-text-secondary mt-1">mastered topics</div>
            </div>
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <div className="font-display text-3xl font-bold" style={{ color: readiness.total >= 70 ? '#00e676' : readiness.total >= 40 ? '#ffb300' : '#ff4757' }}>
                {Math.round(readiness.total)}
              </div>
              <div className="font-body text-xs text-text-secondary mt-1">readiness score</div>
            </div>
          </div>
        )}

        {/* Readiness + trajectory */}
        <div className="grid grid-cols-2 gap-6">
          <ReadinessCard snapshot={readiness} calibrationGap={calibrationGap} />

          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-4">Readiness trajectory</p>
            {readinessHistory.length >= 2 ? (
              <TrajectorySparkline points={readinessHistory} width={280} height={80} />
            ) : (
              <p className="font-body text-xs text-text-secondary">Complete sessions to build a trajectory.</p>
            )}
          </div>
        </div>

        {/* Skill radar + topic mastery */}
        <div className="grid grid-cols-2 gap-6">
          {model && (
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Skill radar</p>
              <SkillRadar model={model} />
            </div>
          )}

          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Topic breakdown</p>
            <div className="space-y-2.5 max-h-80 overflow-y-auto scrollbar-thin pr-1">
              {topTopics.map(([id, stat]) => (
                <div key={id} className="flex items-center gap-3">
                  <div className="w-24 font-body text-xs text-text-secondary truncate flex-shrink-0">
                    {TOPIC_GRAPH[id]?.label ?? id}
                  </div>
                  <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${stat.mastery * 100}%`, background: getMasteryColor(stat.mastery) }}
                    />
                  </div>
                  <AssessmentLevelBadge knowledge={stat.mastery} compact />
                </div>
              ))}
              {topTopics.length === 0 && (
                <p className="font-body text-text-secondary text-sm">No sessions yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Misconception histogram */}
        {miscSorted.length > 0 && (
          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Recurring error patterns</p>
            <div className="space-y-2.5">
              {miscSorted.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-48 font-body text-xs text-text-secondary truncate flex-shrink-0">
                    {type.replace(/_/g, ' ')}
                  </div>
                  <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(count / miscMax) * 100}%`, background: '#ff4757' }}
                    />
                  </div>
                  <div className="font-body text-xs text-text-secondary w-6 text-right">{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last session report */}
        {lastReport && (
          <div>
            <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-3">Last session report</p>
            <ReportCardPanel report={lastReport as ReportCard} />
          </div>
        )}
      </div>
    </div>
  )
}
