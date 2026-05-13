import type { Strategy, StrategyStats } from '../../types/backtest'

interface Props {
  strategy: Strategy
  stats: StrategyStats
  onToggle: (id: string) => void
  onEdit: (id: string) => void
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0f0f0f] rounded-lg p-2.5">
      <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[13px] font-mono font-bold" style={{ color: color ?? '#e6e6e6' }}>{value}</p>
    </div>
  )
}

export function StrategyCard({ strategy, stats, onToggle, onEdit }: Props) {
  const pnlColor = stats.totalPnlSol >= 0 ? '#00ff88' : '#ff3355'
  const winColor = stats.winRate >= 60 ? '#00ff88' : stats.winRate >= 40 ? '#ffcc00' : '#ff3355'
  const activeProtocols = Object.entries(strategy.filters.protocols).filter(([, v]) => v).map(([k]) => k)

  return (
    <div
      className="bg-[#141414] rounded-xl border p-4 transition-all"
      style={{ borderColor: strategy.enabled ? strategy.color + '35' : '#1e1e1e' }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: strategy.color }} />
          <span className="font-display font-bold text-[13px] truncate" style={{ color: strategy.enabled ? strategy.color : '#555555' }}>
            {strategy.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-[#444444]">{stats.openTrades} open</span>
          <button onClick={() => onEdit(strategy.id)}
            className="min-h-[36px] min-w-[44px] text-[11px] font-mono px-2 rounded border border-[#1e1e1e] text-[#555555] hover:text-[#888888] active:bg-[#1a1a1a] hover:border-[#2a2a2a] transition-all">
            Edit
          </button>
          <button onClick={() => onToggle(strategy.id)}
            className={`min-h-[36px] min-w-[44px] text-[11px] font-mono px-2.5 rounded border transition-all ${
              strategy.enabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#555555]'
            }`}>
            {strategy.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <StatBox label="Total PnL" value={`${stats.totalPnlSol >= 0 ? '+' : ''}${stats.totalPnlSol.toFixed(3)}`} color={pnlColor} />
        <StatBox label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} color={winColor} />
        <StatBox label="Trades" value={`${stats.totalTrades}`} />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatBox label="Avg Win" value={stats.avgWinPct ? `+${stats.avgWinPct.toFixed(1)}%` : '—'} color="#00ff88" />
        <StatBox label="Avg Loss" value={stats.avgLossPct ? `${stats.avgLossPct.toFixed(1)}%` : '—'} color="#ff3355" />
        <StatBox label="Best" value={stats.best ? `+${stats.best.toFixed(0)}%` : '—'} color="#00d4ff" />
      </div>

      {/* Tags */}
      <div className="border-t border-[#1a1a1a] pt-3">
        <div className="flex flex-wrap gap-1.5">
          {activeProtocols.length > 0
            ? activeProtocols.slice(0, 3).map(p => (
                <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#888888] border border-[#222]">{p}</span>
              ))
            : <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#555555]">all protocols</span>
          }
          {activeProtocols.length > 3 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#444444]">+{activeProtocols.length - 3}</span>
          )}
          {strategy.exit.takeProfitLevels.map((tp, i) => (
            <span key={tp.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#888888]">
              TP{i+1}: {tp.type === 'percent' ? `+${tp.value}%` : `$${(tp.value/1000).toFixed(0)}K`}
            </span>
          ))}
          {strategy.exit.stopLossPct !== null && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#ff3355]">
              SL {strategy.exit.stopLossPct}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
