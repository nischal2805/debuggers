import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('neuraldsa_theme')
    if (stored === 'light') {
      document.documentElement.classList.add('light')
      setIsDark(false)
    }
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.remove('light')
      localStorage.setItem('neuraldsa_theme', 'dark')
    } else {
      document.documentElement.classList.add('light')
      localStorage.setItem('neuraldsa_theme', 'light')
    }
  }

  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative w-11 h-6 rounded-full border border-border bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-accent-primary/30 overflow-hidden transition-colors"
      style={{ boxShadow: isDark ? '0 0 8px rgba(108,99,255,0.2)' : '0 0 8px rgba(255,179,0,0.2)' }}
    >
      {/* Track icons */}
      <span className="absolute left-1 top-0.5 text-[10px] leading-5 select-none pointer-events-none">
        {isDark ? '🌙' : ''}
      </span>
      <span className="absolute right-1 top-0.5 text-[10px] leading-5 select-none pointer-events-none">
        {isDark ? '' : '☀️'}
      </span>

      {/* Thumb */}
      <motion.div
        className="absolute top-1 w-4 h-4 rounded-full shadow-md"
        style={{ background: isDark ? '#6c63ff' : '#ffb300' }}
        animate={{ x: isDark ? 1 : 21 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      />
    </motion.button>
  )
}
