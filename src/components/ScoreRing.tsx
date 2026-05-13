import type { ScoreGrade } from '../types'

interface Props {
  score: number
  grade: ScoreGrade
  size?: 'sm' | 'md' | 'lg'
}

const GRADE_COLORS: Record<ScoreGrade, string> = {
  SAFE: '#00ff88',
  WATCH: '#ffcc00',
  RISK: '#ff3355',
}

const GRADE_BG: Record<ScoreGrade, string> = {
  SAFE: 'rgba(0,255,136,0.08)',
  WATCH: 'rgba(255,204,0,0.08)',
  RISK: 'rgba(255,51,85,0.08)',
}

const SIZES = {
  sm: { outer: 44, stroke: 3, fontSize: 10 },
  md: { outer: 60, stroke: 4, fontSize: 14 },
  lg: { outer: 80, stroke: 5, fontSize: 18 },
}

export function ScoreRing({ score, grade, size = 'md' }: Props) {
  const { outer, stroke, fontSize } = SIZES[size]
  const radius = (outer - stroke * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = GRADE_COLORS[grade]
  const center = outer / 2

  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{ width: outer, height: outer, background: GRADE_BG[grade] }}
    >
      <svg width={outer} height={outer} className="absolute" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#222222"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span
        className="relative z-10 font-display font-bold"
        style={{ fontSize, color, lineHeight: 1 }}
      >
        {score}
      </span>
    </div>
  )
}
