interface Props {
  level: number
}

export default function DifficultyBadge({ level }: Props) {
  const color =
    level <= 3 ? 'text-accent-success border-accent-success/30' :
    level <= 6 ? 'text-accent-warn border-accent-warn/30' :
    'text-accent-danger border-accent-danger/30'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-body border ${color}`}>
      D{level}
    </span>
  )
}
