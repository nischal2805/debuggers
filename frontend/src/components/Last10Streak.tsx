import { useStore } from '../store/useStore'

export default function Last10Streak() {
  const streak = useStore(s => s.answerStreak)

  // Pad to 10 slots so the visual width is stable
  const slots: ({ correct: boolean } | null)[] = Array(10).fill(null)
  streak.slice(-10).forEach((entry, i) => {
    slots[10 - streak.slice(-10).length + i] = { correct: entry.correct }
  })

  const correctCount = streak.filter(s => s.correct).length
  const denom = streak.length || 1
  const accuracy = Math.round((correctCount / denom) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-body text-text-secondary text-xs uppercase tracking-wider">last 10</p>
        <p className="font-body text-text-secondary text-xs">{accuracy}%</p>
      </div>
      <div className="flex gap-1">
        {slots.map((slot, i) => (
          <div
            key={i}
            className="flex-1 h-2 rounded-sm transition-colors"
            style={{
              background: slot
                ? slot.correct ? '#00e676' : '#ff4757'
                : 'rgba(255,255,255,0.06)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
