import { useState } from 'react'
import type { Signal } from '../../types'
import type { Strategy, StrategyStats, Position } from '../../types/backtest'
import { StrategyCard } from './StrategyCard'
import { PositionTable } from './PositionTable'
import { StrategyEditor } from './StrategyEditor'
import { PatternIntelPanel } from './PatternIntelPanel'
import { makeNewStrategy } from '../../lib/strategyEngine'

interface Props {
  signals: Signal[]
  strategies: Strategy[]
  positions: Position[]
  stats: Record<string, StrategyStats>
  onSaveStrategy: (s: Strategy) => void
  onAddStrategy: (s: Strategy) => void
  onDeleteStrategy: (id: string) => void
  onClear: () => void
}

type TableFilter = 'all' | 'open' | 'closed'

const EMPTY_STATS = (id: string): StrategyStats => ({
  strategyId: id, totalTrades: 0, openTrades: 0,
  wins: 0, losses: 0, winRate: 0, totalPnlSol: 0,
  avgWinPct: 0, avgLossPct: 0, best: 0, worst: 0, equityCurve: [],
})

export function BacktestPage({ signals, strategies, positions, stats, onSaveStrategy, onAddStrategy, onDeleteStrategy, onClear }: Props) {
  const [tableFilter, setTableFilter] = useState<TableFilter>('all')
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [isNew, setIsNew] = useState(false)

  const totalPnl = strategies.reduce((sum, s) => sum + (stats[s.id]?.totalPnlSol ?? 0), 0)
  const totalTrades = strategies.reduce((sum, s) => sum + (stats[s.id]?.totalTrades ?? 0), 0)
  const openCount = positions.filter(p => p.status === 'open').length

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* Page header */}
      <div className="px-4 py-4 border-b border-[#1e1e1e] shrink-0 bg-[#0a0a0a]">
        {/* Top row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="font-display font-bold text-[15px] text-[#e6e6e6]">Strategy Backtester</h1>
            <p className="text-[11px] text-[#444444] font-mono mt-0.5">
              {signals.length} signals · {totalTrades} trades
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditing(makeNewStrategy()); setIsNew(true) }}
              className="min-h-[44px] px-3 text-[11px] font-mono rounded border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] active:bg-[#00d4ff25] transition-all">
              + New
            </button>
            <button onClick={onClear}
              className="min-h-[44px] px-3 text-[11px] font-mono rounded border border-[#1e1e1e] text-[#444444] hover:text-[#888888] active:bg-[#141414] transition-all">
              Clear
            </button>
          </div>
        </div>
        {/* Stats row */}
        <div className="flex items-center gap-4 text-[12px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[#444444]">PnL</span>
            <span className="font-bold" style={{ color: totalPnl >= 0 ? '#00ff88' : '#ff3355' }}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(4)} SOL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#444444]">Open</span>
            <span className="text-[#00d4ff] font-bold">{openCount}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Strategy cards — 1 col mobile, 2 sm, 4 xl */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {strategies.map(strategy => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              stats={stats[strategy.id] ?? EMPTY_STATS(strategy.id)}
              onToggle={(id) => {
                const s = strategies.find(s => s.id === id)
                if (s) onSaveStrategy({ ...s, enabled: !s.enabled })
              }}
              onEdit={(id) => {
                const s = strategies.find(s => s.id === id)
                if (s) { setEditing(s); setIsNew(false) }
              }}
            />
          ))}
        </div>

        <PatternIntelPanel positions={positions} />

        {/* Positions table */}
        <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-[13px] text-[#e6e6e6]">Positions</h2>
            <div className="flex gap-1">
              {(['all', 'open', 'closed'] as TableFilter[]).map(f => (
                <button key={f} onClick={() => setTableFilter(f)}
                  className={`text-[11px] font-mono px-2.5 py-1.5 min-h-[36px] rounded border transition-all ${
                    tableFilter === f ? 'border-[#2a2a2a] text-[#e6e6e6] bg-[#1a1a1a]' : 'border-transparent text-[#444444] hover:text-[#888888]'
                  }`}>
                  {f.toUpperCase()}
                  {f === 'open' && openCount > 0 && <span className="ml-1 text-[#00d4ff]">({openCount})</span>}
                </button>
              ))}
            </div>
          </div>
          <PositionTable positions={positions} strategies={strategies} filter={tableFilter} />
        </div>
      </div>

      {editing && (
        <StrategyEditor
          strategy={editing}
          isNew={isNew}
          onSave={isNew ? onAddStrategy : onSaveStrategy}
          onDelete={!isNew ? onDeleteStrategy : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
