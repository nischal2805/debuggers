import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { TOPIC_GRAPH, getMasteryColor } from '../lib/topics'
import SkillRadar from '../components/SkillRadar'

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useStore()
  const model = useKnowledgeModel()

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/')
  }

  const topTopics = model
    ? Object.entries(model.topics)
        .filter(([, v]) => v.mastery > 0)
        .sort((a, b) => b[1].mastery - a[1].mastery)
        .slice(0, 10)
    : []

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
        </div>
        <button
          onClick={handleLogout}
          className="font-body text-sm text-text-secondary hover:text-accent-danger transition-colors"
        >
          sign out
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-5 mb-10">
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

        {model && (
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <div className="font-display text-3xl font-bold text-text-primary">{model.sessionCount}</div>
              <div className="font-body text-xs text-text-secondary mt-1">sessions completed</div>
            </div>
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <div className="font-display text-3xl font-bold text-text-primary">{Math.round(model.totalMinutes / 60)}h</div>
              <div className="font-body text-xs text-text-secondary mt-1">total study time</div>
            </div>
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <div className="font-display text-3xl font-bold text-text-primary">
                {Object.values(model.topics).filter(v => v.mastery > 0.85).length}
              </div>
              <div className="font-body text-xs text-text-secondary mt-1">topics mastered</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {model && (
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Skill radar</p>
              <SkillRadar model={model} />
            </div>
          )}

          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Topic mastery</p>
            <div className="space-y-2.5">
              {topTopics.map(([id, stat]) => (
                <div key={id} className="flex items-center gap-3">
                  <div className="w-28 font-body text-xs text-text-secondary truncate">
                    {TOPIC_GRAPH[id]?.label ?? id}
                  </div>
                  <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${stat.mastery * 100}%`,
                        background: getMasteryColor(stat.mastery),
                      }}
                    />
                  </div>
                  <div className="w-8 text-right font-body text-xs text-text-secondary">
                    {Math.round(stat.mastery * 100)}%
                  </div>
                </div>
              ))}
              {topTopics.length === 0 && (
                <p className="font-body text-text-secondary text-sm">No sessions yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
