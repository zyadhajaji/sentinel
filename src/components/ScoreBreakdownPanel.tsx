import type { ScoreBreakdown, ScoreGrade } from '../types'

interface Props {
  breakdown: ScoreBreakdown
  grade: ScoreGrade
}

const LABELS: Record<keyof ScoreBreakdown, { label: string; max: number }> = {
  activity:     { label: 'Buy Pressure', max: 20 },
  distribution: { label: 'Momentum',     max: 10 },
  liquidity:    { label: 'Liquidity',    max: 20 },
  authority:    { label: 'Safety',       max: 20 },
  age:          { label: 'Age Window',   max: 15 },
  socials:      { label: 'Socials',      max: 15 },
}

export function ScoreBreakdownPanel({ breakdown }: Props) {
  return (
    <div className="mt-3 pt-3 border-t border-[#222222]">
      <p className="text-[10px] text-[#555555] font-mono mb-2 uppercase tracking-wider">Score Breakdown</p>
      <div className="space-y-1.5">
        {(Object.keys(LABELS) as (keyof ScoreBreakdown)[]).map((key) => {
          const { label, max } = LABELS[key]
          const val = breakdown[key]
          const pct = (val / max) * 100
          const barColor = pct >= 70 ? '#00ff88' : pct >= 40 ? '#ffcc00' : '#ff3355'
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-[#555555] w-20 shrink-0">{label}</span>
              <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
              <span className="text-[10px] font-mono" style={{ color: barColor }}>
                {val}/{max}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
