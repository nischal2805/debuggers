import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ReactFlow, Background, BackgroundVariant, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../store/useStore'
import { getMasteryColor } from '../lib/topics'

const DEMO_NODES = [
  { id: 'arrays', position: { x: 100, y: 150 }, data: { label: 'Arrays', mastery: 0.85 }, style: { background: getMasteryColor(0.85), border: 'none', color: '#0a0a0f', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12, padding: '6px 12px' } },
  { id: 'sorting', position: { x: 280, y: 80 }, data: { label: 'Sorting', mastery: 0.7 }, style: { background: getMasteryColor(0.7), border: 'none', color: '#0a0a0f', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12, padding: '6px 12px' } },
  { id: 'two_pointers', position: { x: 460, y: 150 }, data: { label: 'Two Pointers', mastery: 0.55 }, style: { background: getMasteryColor(0.55), border: 'none', color: '#0a0a0f', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12, padding: '6px 12px' } },
  { id: 'sliding_window', position: { x: 640, y: 80 }, data: { label: 'Sliding Window', mastery: 0.4 }, style: { background: getMasteryColor(0.4), border: 'none', color: '#0a0a0f', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12, padding: '6px 12px' } },
  { id: 'graphs', position: { x: 320, y: 260 }, data: { label: 'Graphs', mastery: 0.2 }, style: { background: getMasteryColor(0.2), border: 'none', color: '#f0f0ff', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12, padding: '6px 12px' } },
  { id: 'dp', position: { x: 540, y: 300 }, data: { label: 'DP', mastery: 0.1 }, style: { background: getMasteryColor(0.1), border: 'none', color: '#f0f0ff', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12, padding: '6px 12px' } },
]

const DEMO_EDGES = [
  { id: 'a-s', source: 'arrays', target: 'sorting', style: { stroke: 'rgba(108,99,255,0.4)' } },
  { id: 's-tp', source: 'sorting', target: 'two_pointers', style: { stroke: 'rgba(108,99,255,0.4)' } },
  { id: 'tp-sw', source: 'two_pointers', target: 'sliding_window', style: { stroke: 'rgba(108,99,255,0.4)' } },
  { id: 'a-g', source: 'arrays', target: 'graphs', style: { stroke: 'rgba(108,99,255,0.2)', strokeDasharray: '4 4' } },
  { id: 'g-dp', source: 'graphs', target: 'dp', style: { stroke: 'rgba(108,99,255,0.2)', strokeDasharray: '4 4' } },
]

export default function Landing() {
  const { signIn } = useAuth()
  const { user, loading } = useStore()
  const navigate = useNavigate()
  const [nodes] = useNodesState(DEMO_NODES)
  const [edges] = useEdgesState(DEMO_EDGES)

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard')
    }
  }, [user, loading, navigate])

  const handleSignIn = async () => {
    try {
      const userData = await signIn()
      if (userData && !userData.onboarded) {
        navigate('/onboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnDrag={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="rgba(108,99,255,0.15)" />
        </ReactFlow>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-accent-primary font-body text-sm tracking-widest uppercase mb-6">
            NeuralDSA
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold text-text-primary leading-tight mb-4">
            DSA that learns<br />you back.
          </h1>
          <p className="font-body text-text-secondary text-lg max-w-md mx-auto mb-12">
            Not a question bank. A brain model. Every answer updates what the tutor knows about you.
          </p>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSignIn}
            className="inline-flex items-center gap-3 bg-bg-elevated border border-accent-primary/30 text-text-primary font-body px-8 py-4 rounded-lg text-sm hover:border-accent-primary/60 hover:bg-accent-primary/10 transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 text-xs text-text-secondary font-body"
        >
          <span>40+ DSA topics</span>
          <span>·</span>
          <span>Adaptive difficulty</span>
          <span>·</span>
          <span>Real-time brain model</span>
        </motion.div>
      </div>
    </div>
  )
}
