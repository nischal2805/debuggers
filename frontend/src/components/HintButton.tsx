import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  onHint: () => void
  lastActivityTime: number
  disabled?: boolean
}

export default function HintButton({ onHint, lastActivityTime, disabled }: Props) {
  const [glowing, setGlowing] = useState(false)

  useEffect(() => {
    const check = () => {
      const elapsed = Date.now() - lastActivityTime
      setGlowing(elapsed > 60000)
    }
    check()
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [lastActivityTime])

  return (
    <motion.button
      onClick={onHint}
      disabled={disabled}
      animate={glowing ? { boxShadow: ['0 0 0 0 rgba(255,179,0,0)', '0 0 12px 3px rgba(255,179,0,0.4)', '0 0 0 0 rgba(255,179,0,0)'] } : {}}
      transition={glowing ? { duration: 2, repeat: Infinity } : {}}
      className={`px-4 py-2 rounded-lg border font-body text-xs transition-all ${
        glowing
          ? 'border-accent-warn/60 text-accent-warn bg-accent-warn/10 hover:bg-accent-warn/20'
          : 'border-border text-text-secondary hover:border-accent-warn/40 hover:text-accent-warn'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      hint
    </motion.button>
  )
}
