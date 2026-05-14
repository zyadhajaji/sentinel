import type { Strategy, StrategyStats } from '../../types/backtest'

interface Props {
  strategy: Strategy
  stats: StrategyStats
  onToggle: (id: string) => void
  onEdit: (id: string) => void
  onToggleAutoTrade: (id: string) => void
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0d0d0d] rounded-lg p-2.5">
      <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[13px] font-mono font-bold tabular-nums" style={{ color: color ?? '#e6e6e6' }}>{value}</p>
    </div>
  )
}

export function StrategyCard({ strategy, stats, onToggle, onEdit, onToggleAutoTrade }: Props) {
  const pnlColor = stats.totalPnlSol >= 0 ? '#00ff88' : '#ff3355'
  const winColor = stats.winRate >= 60 ? '#00ff88' : stats.winRate >= 40 ? '#ffcc00' : '#ff3355'
  const activeProtocols = Object.entries(strategy.filters.protocols).filter(([, v]) => v).map(([k]) => k)
  const isAnakin = strategy.id === 'anakin'

  return (
    <div
      className="bg-[#111111] rounded-xl border p-4 transition-all relative overflow-hidden"
      style={{ borderColor: strategy.enabled ? strategy.color + '35' : '#1e1e1e' }}
    >
      {isAnakin && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top left, #ffd70008 0%, transparent 60%)' }} />
      )}

      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: strategy.color }} />
          <span className="font-display font-bold text-[13px] truncate" style={{ color: strategy.enabled ? strategy.color : '#555555' }}>
            {strategy.name}
          </span>
          {strategy.locked && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
              style={{ color: strategy.color, background: strategy.color + '15', border: `1px solid ${strategy.color}25` }}>
              {isAnakin ? 'PRESET' : 'PRESET'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-[#444444]">{stats.openTrades} open</span>
          {!strategy.locked && (
            <button
              onClick={() => onEdit(strategy.id)}
              className="min-h-[36px] min-w-[44px] text-[11px] font-mono px-2 rounded border border-[#1e1e1e] text-[#555555] hover:text-[#888888] active:bg-[#1a1a1a] hover:border-[#2a2a2a] transition-all cursor-pointer"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => onToggle(strategy.id)}
            className={`min-h-[36px] min-w-[44px] text-[11px] font-mono px-2.5 rounded border transition-all cursor-pointer ${
              strategy.enabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#555555]'
            }`}
          >
            {strategy.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {strategy.description && (
        <p className="text-[10px] font-mono text-[#555555] mb-3">{strategy.description}</p>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <StatBox label="Total PnL" value={`${stats.totalPnlSol >= 0 ? '+' : ''}${stats.totalPnlSol.toFixed(3)}`} color={pnlColor} />
        <StatBox label="Win Rate" value={stats.winRate > 0 ? `${stats.winRate.toFixed(0)}%` : '—'} color={stats.winRate > 0 ? winColor : '#444444'} />
        <StatBox label="Trades" value={`${stats.totalTrades}`} />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatBox label="Avg Win" value={stats.wins > 0 ? `+${stats.avgWinPct.toFixed(1)}%` : '—'} color="#00ff88" />
        <StatBox label="Avg Loss" value={stats.losses > 0 ? `${stats.avgLossPct.toFixed(1)}%` : '—'} color="#ff3355" />
        <StatBox label="Best" value={stats.best > 0 ? `+${stats.best.toFixed(0)}%` : '—'} color="#00d4ff" />
      </div>

      {/* Filter + exit tags */}
      <div className="border-t border-[#1a1a1a] pt-3 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {activeProtocols.slice(0, 3).map(p => (
            <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#888888] border border-[#222]">{p}</span>
          ))}
          {activeProtocols.length > 3 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#444444]">+{activeProtocols.length - 3}</span>
          )}
          {strategy.filters.buyPressure.min !== null && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#888888]">BP ≥{strategy.filters.buyPressure.min}%</span>
          )}
          {strategy.filters.liquidity.min !== null && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#888888]">
              Liq ${(strategy.filters.liquidity.min / 1000).toFixed(0)}k+
            </span>
          )}
          {strategy.exit.takeProfitLevels.map((tp, i) => (
            <span key={tp.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#888888]">
              TP{i + 1}: {tp.type === 'percent' ? `+${tp.value}%` : `$${(tp.value / 1000).toFixed(0)}K`}
            </span>
          ))}
          {strategy.exit.stopLossPct !== null && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#ff3355]">
              SL {strategy.exit.stopLossPct}%
            </span>
          )}
        </div>
      </div>

      {/* Auto-trade toggle */}
      <button
        onClick={() => onToggleAutoTrade(strategy.id)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer text-[11px] font-mono ${
          strategy.autoTrade
            ? 'border-[#ffd70040] bg-[#ffd70008] text-[#ffd700]'
            : 'border-[#1e1e1e] bg-[#0d0d0d] text-[#444444] hover:text-[#666666]'
        }`}
      >
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span>Auto-Trade</span>
          {strategy.autoTrade && <span className="text-[9px] opacity-70">(paper mode)</span>}
        </div>
        <div className={`w-8 h-4 rounded-full border transition-all relative ${
          strategy.autoTrade ? 'bg-[#ffd700] border-[#ffd70060]' : 'bg-[#1a1a1a] border-[#2a2a2a]'
        }`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
            strategy.autoTrade ? 'left-4 bg-[#080808]' : 'left-0.5 bg-[#444444]'
          }`} />
        </div>
      </button>
    </div>
  )
}
