interface Props {
  sessionDates: string[]
}

export default function SessionHeatmap({ sessionDates }: Props) {
  const today = new Date()
  const weeks = 10
  const totalDays = weeks * 7

  const dateSet = new Set(
    sessionDates.map(d => d.split('T')[0])
  )

  const cells = []
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    cells.push({ key, active: dateSet.has(key) })
  }

  const grid: typeof cells[] = []
  for (let i = 0; i < weeks; i++) {
    grid.push(cells.slice(i * 7, (i + 1) * 7))
  }

  return (
    <div>
      <p className="font-body text-text-secondary text-xs mb-2">Activity — last {weeks} weeks</p>
      <div className="flex gap-1">
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.key}
                title={day.key}
                className={`w-3 h-3 rounded-sm transition-colors ${
                  day.active
                    ? 'bg-accent-primary'
                    : 'bg-bg-elevated'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
