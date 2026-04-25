import { motion } from 'framer-motion'
import type { ReportCard } from '../lib/types'

interface ReportCardPanelProps {
  report: ReportCard
}

export default function ReportCardPanel({ report }: ReportCardPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-surface border border-border rounded-lg p-6 max-w-xl w-full"
    >
      <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-2">session report</p>
      <h3 className="font-display text-lg font-bold text-text-primary mb-5">{report.headline}</h3>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <Card label="Strongest" value={report.strongest_concept} accent="success" />
        <Card label="Biggest gap" value={report.biggest_gap} accent="danger" />
        <Card label="Recurring miss" value={report.recurring_misconception} accent="warn" />
        <Card label="Readiness Δ" value={report.readiness_change} accent="primary" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <Detail label="speed" text={report.speed_assessment} />
        <Detail label="effort" text={report.effort_assessment} />
        <Detail label="interview likelihood" text={report.interview_likelihood} />
      </div>

      {report.next_focus?.length > 0 && (
        <div>
          <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-2">next focus</p>
          <ul className="space-y-1">
            {report.next_focus.map((item, i) => (
              <li key={i} className="font-body text-sm text-text-primary">— {item}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}

function Card({ label, value, accent }: { label: string; value: string; accent: 'success' | 'danger' | 'warn' | 'primary' }) {
  const colors: Record<string, string> = {
    success: '#00e676',
    danger:  '#ff4757',
    warn:    '#ffb300',
    primary: '#6c63ff',
  }
  const c = colors[accent]
  return (
    <div className="rounded-md p-3" style={{ background: `${c}10`, border: `1px solid ${c}30` }}>
      <p className="font-body text-[10px] uppercase tracking-wider mb-1" style={{ color: c }}>{label}</p>
      <p className="font-body text-sm text-text-primary leading-snug">{value}</p>
    </div>
  )
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-1">{label}</p>
      <p className="font-body text-sm text-text-primary">{text}</p>
    </div>
  )
}
