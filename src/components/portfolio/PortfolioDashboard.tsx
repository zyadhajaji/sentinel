import type { Position, Strategy, StrategyStats } from '../../types/backtest'
import { formatUSD } from '../../lib/mockData'

interface Props {
  strategies: Strategy[]
  positions: Position[]
  stats: Record<string, StrategyStats>
  solPrice: number
  onClear: () => void
}

function MetricCard({
  label, value, sub, color, glow,
}: { label: string; value: string; sub?: string; color?: string; glow?: boolean }) {
  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 relative overflow-hidden">
      {glow && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top left, ${color}08 0%, transparent 60%)` }} />
      )}
      <p className="text-[10px] font-mono text-[#555555] uppercase tracking-wider mb-2">{label}</p>
      <p className="text-[22px] font-display font-bold" style={{ color: color ?? '#e6e6e6' }}>{value}</p>
      {sub && <p className="text-[11px] font-mono text-[#555555] mt-1">{sub}</p>}
    </div>
  )
}

function WinRateBar({ rate, color }: { rate: number; color: string }) {
  return (
    <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, rate)}%`, background: color }} />
    </div>
  )
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'OPEN', color: '#00d4ff' },
  closed_tp: { label: 'TP', color: '#00ff88' },
  closed_sl: { label: 'SL', color: '#ff3355' },
  closed_timeout: { label: 'TIMEOUT', color: '#888888' },
  closed_rug: { label: 'RUG', color: '#ff3355' },
}

export function PortfolioDashboard({ strategies, positions, stats, solPrice, onClear }: Props) {
  // ── Aggregate metrics ────────────────────────────────────────────────────
  const allClosed = positions.filter(p => p.status !== 'open')
  const allOpen = positions.filter(p => p.status === 'open')
  const totalPnlSol = positions.reduce((s, p) => s + p.totalPnlSol, 0)
  const totalPnlUsd = totalPnlSol * solPrice
  const wins = allClosed.filter(p => p.totalPnlSol > 0)
  const winRate = allClosed.length > 0 ? (wins.length / allClosed.length) * 100 : 0
  const capitalAtRisk = allOpen.reduce((s, p) => s + p.positionSizeSol * (p.remainingPct / 100), 0)
  const bestStrategy = strategies.reduce<Strategy | null>((best, s) => {
    const st = stats[s.id]
    if (!st || st.totalTrades === 0) return best
    if (!best || (stats[best.id]?.winRate ?? 0) < st.winRate) return s
    return best
  }, null)

  // ── Recent closed trades ─────────────────────────────────────────────────
  const recentClosed = [...allClosed]
    .sort((a, b) => new Date(b.exitTime ?? b.entryTime).getTime() - new Date(a.exitTime ?? a.entryTime).getTime())
    .slice(0, 12)

  const pnlColor = totalPnlSol >= 0 ? '#00ff88' : '#ff3355'
  const winRateColor = winRate >= 80 ? '#00ff88' : winRate >= 60 ? '#ffcc00' : '#ff3355'

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="p-4 space-y-4 max-w-4xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-[14px] text-[#e6e6e6] tracking-wider">PORTFOLIO</h2>
            <p className="text-[11px] font-mono text-[#555555] mt-0.5">
              {positions.length} trades tracked · SOL ${solPrice.toFixed(0)}
            </p>
          </div>
          <button
            onClick={onClear}
            className="text-[11px] font-mono px-3 min-h-[36px] rounded border border-[#1e1e1e] text-[#444444] hover:text-[#888888] hover:border-[#2a2a2a] transition-all"
          >
            Clear All
          </button>
        </div>

        {/* ── Top metrics ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Total P&L"
            value={`${totalPnlSol >= 0 ? '+' : ''}${totalPnlSol.toFixed(3)} SOL`}
            sub={`${totalPnlUsd >= 0 ? '+' : ''}${formatUSD(Math.abs(totalPnlUsd))}`}
            color={pnlColor}
            glow
          />
          <MetricCard
            label="Win Rate"
            value={allClosed.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
            sub={`${wins.length}W / ${allClosed.length - wins.length}L`}
            color={winRateColor}
            glow
          />
          <MetricCard
            label="Open Trades"
            value={`${allOpen.length}`}
            sub={`${capitalAtRisk.toFixed(3)} SOL at risk`}
            color="#00d4ff"
          />
          <MetricCard
            label="Total Trades"
            value={`${positions.length}`}
            sub={bestStrategy ? `Best: ${bestStrategy.name}` : 'No trades yet'}
          />
        </div>

        {/* ── Per-strategy breakdown ───────────────────────────────────── */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e]">
            <span className="text-[11px] font-mono text-[#888888] uppercase tracking-wider">Strategy Breakdown</span>
          </div>
          <div className="divide-y divide-[#1a1a1a]">
            {strategies.map(strategy => {
              const st = stats[strategy.id]
              if (!st) return null
              const wr = st.winRate
              const wrColor = wr >= 80 ? '#00ff88' : wr >= 60 ? '#ffcc00' : '#ff3355'
              const pnl = st.totalPnlSol
              return (
                <div key={strategy.id} className="px-4 py-3 flex items-center gap-3">
                  {/* Color dot + name */}
                  <div className="flex items-center gap-2 w-32 shrink-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: strategy.color }} />
                    <span className="text-[12px] font-mono truncate" style={{ color: strategy.enabled ? '#e6e6e6' : '#444444' }}>
                      {strategy.name}
                    </span>
                  </div>
                  {/* Win rate bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono" style={{ color: wrColor }}>
                        {st.totalTrades > 0 ? `${wr.toFixed(0)}% WR` : '—'}
                      </span>
                      <span className="text-[10px] font-mono text-[#444444]">{st.totalTrades} trades</span>
                    </div>
                    <WinRateBar rate={wr} color={wrColor} />
                  </div>
                  {/* P&L */}
                  <div className="w-20 text-right shrink-0">
                    <span className="text-[12px] font-mono" style={{ color: pnl >= 0 ? '#00ff88' : '#ff3355' }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(3)}
                    </span>
                    <p className="text-[10px] font-mono text-[#444444]">SOL</p>
                  </div>
                </div>
              )
            })}
            {strategies.every(s => (stats[s.id]?.totalTrades ?? 0) === 0) && (
              <div className="px-4 py-8 text-center">
                <p className="text-[#333333] font-mono text-sm">Waiting for qualifying signals…</p>
                <p className="text-[#2a2a2a] font-mono text-[11px] mt-1">Enable a strategy to start tracking</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent closed trades ─────────────────────────────────────── */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e]">
            <span className="text-[11px] font-mono text-[#888888] uppercase tracking-wider">Recent Trades</span>
          </div>
          {recentClosed.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[#333333] font-mono text-sm">No closed trades yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {recentClosed.map(pos => {
                const status = STATUS_LABELS[pos.status] ?? { label: pos.status, color: '#888888' }
                const pnl = pos.totalPnlSol
                const pnlPct = pos.partialExits.length > 0
                  ? pos.partialExits.reduce((s, e) => s + e.pnlPct * (e.sizePct / 100), 0) / Math.max(1, pos.partialExits.reduce((s, e) => s + e.sizePct / 100, 0))
                  : 0
                const strategy = strategies.find(s => s.id === pos.strategyId)

                return (
                  <div key={pos.id} className="px-4 py-3 flex items-center gap-3">
                    {/* Status badge */}
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: status.color, background: status.color + '15', border: `1px solid ${status.color}25` }}
                    >
                      {status.label}
                    </span>
                    {/* Token */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-mono text-[#e6e6e6] font-bold truncate">{pos.tokenSymbol}</span>
                        {strategy && (
                          <span className="text-[9px] font-mono shrink-0" style={{ color: strategy.color }}>
                            {strategy.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-[#444444]">
                        {pos.exitTime ? new Date(pos.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                    {/* P&L */}
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-mono font-bold" style={{ color: pnl >= 0 ? '#00ff88' : '#ff3355' }}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)} SOL
                      </p>
                      <p className="text-[10px] font-mono" style={{ color: pnlPct >= 0 ? '#00ff88' : '#ff3355' }}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
