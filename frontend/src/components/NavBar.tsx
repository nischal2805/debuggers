import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { normalizePct } from '../lib/utils'
import ThemeToggle from './ThemeToggle'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Solve',     path: '/solve' },
  { label: 'Session',   path: '/session' },
  { label: 'Roadmap',   path: '/roadmap' },
  { label: 'T-Minus',   path: '/tminus' },
  { label: 'Profile',   path: '/profile' },
  { label: 'Judge',     path: '/judge' },
]

interface NavBarProps {
  /** Override active item. Auto-detected from URL if omitted. */
  active?: string
  /** Topic ID for interview mode button. Defaults to 'arrays'. */
  interviewTopic?: string
}

export default function NavBar({ active, interviewTopic = 'arrays' }: NavBarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, readiness, isDemoMode } = useStore()

  const activePath = active ?? pathname
  const readinessPct = normalizePct(readiness?.total ?? 0)

  return (
    <header
      style={{
        height: 52,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}
    >
      {/* ── Left: Logo ── */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
        onClick={() => navigate('/dashboard')}
      >
        <div
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6c63ff, #00d4ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(108,99,255,0.5)',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" fill="white" stroke="none" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </div>
        <span
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          NeuralDSA
        </span>
        {isDemoMode && (
          <span
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 9,
              color: '#ffb300',
              border: '1px solid rgba(255,179,0,0.3)',
              borderRadius: 20,
              padding: '1px 6px',
            }}
          >
            demo
          </span>
        )}
      </div>

      {/* ── Center: Nav links ── */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {NAV_ITEMS.map(item => {
          const isActive = activePath.startsWith(item.path)
          return (
            <motion.button
              key={item.path}
              whileHover={{ backgroundColor: 'rgba(108,99,255,0.08)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (item.path === '/solve') navigate('/solve/arrays')
                else if (item.path === '/session') navigate('/session/arrays')
                else navigate(item.path)
              }}
              style={{
                padding: '5px 14px',
                borderRadius: 8,
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#6c63ff' : 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 0.15s',
              }}
            >
              {item.label}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 10,
                    right: 10,
                    height: 2,
                    borderRadius: 1,
                    background: '#6c63ff',
                    boxShadow: '0 0 6px rgba(108,99,255,0.6)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* ── Right: Interview + Readiness + ThemeToggle + Avatar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Interview mode */}
        <motion.button
          whileHover={{ boxShadow: '0 0 12px rgba(255,71,87,0.35)', backgroundColor: 'rgba(255,71,87,0.08)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(`/interview/${interviewTopic}`)}
          style={{
            padding: '4px 12px',
            border: '1px solid rgba(255,71,87,0.55)',
            borderRadius: 8,
            background: 'transparent',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            color: '#ff4757',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          interview mode
        </motion.button>

        {/* Readiness badge */}
        <motion.button
          whileHover={{ backgroundColor: 'rgba(255,179,0,0.1)' }}
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            border: '1px solid rgba(255,179,0,0.3)',
            borderRadius: 8,
            background: 'transparent',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: readinessPct >= 70 ? '#00e676' : readinessPct >= 40 ? '#ffb300' : '#ff4757',
              boxShadow: `0 0 5px ${readinessPct >= 70 ? '#00e67680' : readinessPct >= 40 ? '#ffb30080' : '#ff475780'}`,
            }}
          />
          {readinessPct}% ready
        </motion.button>

        <ThemeToggle />

        {/* Avatar */}
        <motion.button
          whileHover={{ scale: 1.08, boxShadow: '0 0 14px rgba(108,99,255,0.5)' }}
          whileTap={{ scale: 0.94 }}
          onClick={() => navigate('/profile')}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6c63ff, #00d4ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Syne, sans-serif',
            fontSize: 13, fontWeight: 700,
            color: 'white',
            border: 'none', cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {user?.name?.[0]?.toUpperCase() ?? 'N'}
        </motion.button>
      </div>
    </header>
  )
}
