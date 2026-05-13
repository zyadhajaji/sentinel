import { useState } from 'react'
import type { Signal } from '../types'
import { TokenCard } from './TokenCard'

interface Props {
  signals: Signal[]
  newSignalId: string | null
  onTrade: (signal: Signal) => void
}

const GRADE_FILTER_OPTIONS = ['ALL', 'SAFE', 'WATCH', 'RISK'] as const
type GradeFilter = typeof GRADE_FILTER_OPTIONS[number]

const GRADE_COLORS: Record<string, string> = {
  SAFE: '#00ff88',
  WATCH: '#ffcc00',
  RISK: '#ff3355',
}

export function SignalFeed({ signals, newSignalId, onTrade }: Props) {
  const [filter, setFilter] = useState<GradeFilter>('ALL')

  const filtered = filter === 'ALL'
    ? signals
    : signals.filter(s => s.score_grade === filter)

  const counts = {
    SAFE: signals.filter(s => s.score_grade === 'SAFE').length,
    WATCH: signals.filter(s => s.score_grade === 'WATCH').length,
    RISK: signals.filter(s => s.score_grade === 'RISK').length,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Feed header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse-green" />
          <span className="text-[11px] font-mono text-[#888888] tracking-wider">LIVE FEED</span>
          <span className="text-[11px] font-mono text-[#333333]">·</span>
          <span className="text-[11px] font-mono text-[#555555]">{signals.length} signals</span>
        </div>
        <div className="flex items-center gap-1">
          {GRADE_FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`text-[11px] font-mono px-2.5 py-1.5 rounded min-h-[36px] transition-all ${
                filter === opt
                  ? 'bg-[#141414] text-[#e6e6e6] border border-[#2a2a2a]'
                  : 'text-[#444444] hover:text-[#888888] border border-transparent'
              }`}
              style={filter === opt && opt !== 'ALL' ? { color: GRADE_COLORS[opt] } : undefined}
            >
              {opt}
              {opt !== 'ALL' && counts[opt as keyof typeof counts] > 0 && (
                <span className="ml-1 opacity-60">{counts[opt as keyof typeof counts]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable signal list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-3 space-y-2.5">
          {filtered.map(signal => (
            <TokenCard
              key={signal.id}
              signal={signal}
              isNew={signal.id === newSignalId}
              onTrade={onTrade}
            />
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <span className="text-[#333333] text-2xl">◈</span>
              <span className="text-[#444444] text-sm font-mono">No {filter} signals yet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
