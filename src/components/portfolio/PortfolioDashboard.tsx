import { useState } from 'react'
import type { Position, Strategy, StrategyStats } from '../../types/backtest'
import { formatUSD } from '../../lib/mockData'

interface Props {
  strategies: Strategy[]
  positions: Position[]
  stats: Record<string, StrategyStats>
  solPrice: number
  onClear: () => void
}

// ── helpers ───────────────────────────────────────────────────────────────────
function holdTime(entry: string, exit: string | null): string {
  const ms = new Date(exit ?? new Date().toISOString()).getTime() - new Date(entry).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function pnlPct(pos: Position): number {
  if (pos.status === 'open') return pos.unrealizedPnlPct
  return pos.positionSizeSol > 0 ? (pos.totalPnlSol / pos.positionSizeSol) * 100 : 0
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  open:           { label: 'LIVE',    color: '#00d4ff' },
  closed_tp:      { label: 'TP HIT',  color: '#00ff88' },
  closed_sl:      { label: 'SL HIT',  color: '#ff3355' },
  closed_timeout: { label: 'TIMEOUT', color: '#ffcc00' },
  closed_rug:     { label: 'RUGGED',  color: '#ff3355' },
}

// ── MetricCard ────────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, glow }: {
  label: string; value: string; sub?: string; color?: string; glow?: boolean
}) {
  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 relative overflow-hidden">
      {glow && color && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top left, ${color}10 0%, transparent 60%)` }} />
      )}
      <p className="text-[10px] font-mono text-[#555555] uppercase tracking-wider mb-2">{label}</p>
      <p className="text-[22px] font-bold tabular-nums" style={{ color: color ?? '#e6e6e6', fontFamily: "'Inter', sans-serif" }}>
        {value}
      </p>
      {sub && <p className="text-[11px] font-mono text-[#555555] mt-1">{sub}</p>}
    </div>
  )
}

// ── WinRateBar ────────────────────────────────────────────────────────────────
function WinRateBar({ rate, color }: { rate: number; color: string }) {
  return (
    <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, rate)}%`, background: color }} />
    </div>
  )
}

// ── PnL Card (open position) ──────────────────────────────────────────────────
function OpenPositionCard({ pos, strategy }: { pos: Position; strategy: Strategy | undefined }) {
  const pct = pos.unrealizedPnlPct
  const pnlColor = pct >= 0 ? '#00ff88' : '#ff3355'
  const strColor = strategy?.color ?? '#888888'

  return (
    <div className="bg-[#141414] border rounded-2xl overflow-hidden relative"
      style={{ borderColor: pct >= 5 ? `${pnlColor}40` : '#1e1e1e', boxShadow: pct >= 5 ? `0 0 20px ${pnlColor}08` : undefined }}>
      {/* Strategy color strip */}
      <div className="h-0.5 w-full" style={{ background: strColor }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[15px] font-bold text-[#e8e8e8]" style={{ fontFamily: "'Inter', sans-serif" }}>
                {pos.tokenSymbol}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ color: strColor, background: `${strColor}18`, border: `1px solid ${strColor}30` }}>
                {pos.strategyName}
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#444444]">{pos.source} · {holdTime(pos.entryTime, null)} in trade</p>
          </div>
          {/* Live badge */}
          <span className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded-full bg-[#00d4ff10] text-[#00d4ff] border border-[#00d4ff25]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]" style={{ animation: 'pill-dot-pulse 1.5s ease-in-out infinite' }} />
            LIVE
          </span>
        </div>

        {/* Big PnL number */}
        <div className="text-center py-3 mb-3 rounded-xl" style={{ background: `${pnlColor}08` }}>
          <p className="text-[32px] font-bold tabular-nums leading-none" style={{ color: pnlColor, fontFamily: "'Inter', sans-serif" }}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
          </p>
          <p className="text-[12px] font-mono mt-1" style={{ color: pnlColor }}>
            {pos.unrealizedPnlSol >= 0 ? '+' : ''}{pos.unrealizedPnlSol.toFixed(4)} SOL
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[9px] font-mono text-[#444444] mb-0.5">ENTRY MCAP</p>
            <p className="text-[11px] font-mono text-[#888888]">{formatUSD(pos.entryMcap)}</p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-[#444444] mb-0.5">CURRENT</p>
            <p className="text-[11px] font-mono text-[#888888]">{formatUSD(pos.currentMcap)}</p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-[#444444] mb-0.5">SIZE</p>
            <p className="text-[11px] font-mono text-[#888888]">{pos.positionSizeSol.toFixed(2)} SOL</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Best Trade Card ────────────────────────────────────────────────────────────
function BestTradeCard({ pos, rank, strategy }: { pos: Position; rank: number; strategy: Strategy | undefined }) {
  const pct = pnlPct(pos)
  const pnlColor = pct >= 0 ? '#00ff88' : '#ff3355'
  const strColor = strategy?.color ?? '#888888'
  const status = STATUS_CFG[pos.status] ?? { label: pos.status, color: '#888888' }
  const hold = holdTime(pos.entryTime, pos.exitTime)

  const medals = ['🥇', '🥈', '🥉']
  const rankLabel = rank <= 3 ? medals[rank - 1] : `#${rank}`

  // Mcap multiplier
  const exitMcap = pos.currentMcap > 0 ? pos.currentMcap : pos.entryMcap
  const multiplier = pos.entryMcap > 0 ? exitMcap / pos.entryMcap : 1

  return (
    <div className="bg-[#141414] border rounded-2xl overflow-hidden relative"
      style={{
        borderColor: rank <= 3 ? `${pnlColor}50` : rank <= 10 ? `${pnlColor}25` : '#1e1e1e',
        boxShadow: rank === 1 ? `0 0 32px ${pnlColor}15` : rank <= 3 ? `0 0 16px ${pnlColor}08` : undefined,
      }}>
      {/* Rank color strip */}
      <div className="h-0.5" style={{ background: rank <= 3 ? pnlColor : strColor }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[18px] leading-none">{rankLabel}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold text-[#e8e8e8]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {pos.tokenSymbol}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ color: strColor, background: `${strColor}18`, border: `1px solid ${strColor}30` }}>
                  {pos.strategyName}
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#444444]">{hold} hold · {status.label}</p>
            </div>
          </div>
          {/* Status badge */}
          <span className="text-[9px] font-mono px-2 py-1 rounded-full shrink-0"
            style={{ color: status.color, background: `${status.color}15`, border: `1px solid ${status.color}25` }}>
            {status.label}
          </span>
        </div>

        {/* Big PnL */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[36px] font-bold tabular-nums leading-none" style={{ color: pnlColor, fontFamily: "'Inter', sans-serif" }}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
            </p>
            <p className="text-[13px] font-mono mt-1" style={{ color: pnlColor }}>
              {pos.totalPnlSol >= 0 ? '+' : ''}{pos.totalPnlSol.toFixed(4)} SOL
            </p>
          </div>
          {/* Mcap multiplier */}
          <div className="text-right">
            <p className="text-[22px] font-bold tabular-nums" style={{ color: multiplier >= 2 ? '#ffd700' : '#888888', fontFamily: "'Inter', sans-serif" }}>
              {multiplier.toFixed(1)}×
            </p>
            <p className="text-[9px] font-mono text-[#444444]">MCap mult</p>
          </div>
        </div>

        {/* MCap journey */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 bg-[#0d0d0d] rounded-lg p-2 text-center">
            <p className="text-[9px] font-mono text-[#444444] mb-0.5">ENTRY</p>
            <p className="text-[11px] font-mono text-[#888888]">{formatUSD(pos.entryMcap)}</p>
          </div>
          <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
            <path d="M0 6h16m0 0l-5-5m5 5l-5 5" stroke={pnlColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="flex-1 bg-[#0d0d0d] rounded-lg p-2 text-center">
            <p className="text-[9px] font-mono text-[#444444] mb-0.5">EXIT</p>
            <p className="text-[11px] font-mono text-[#888888]">{formatUSD(exitMcap)}</p>
          </div>
        </div>

        {/* Partial exits */}
        {pos.partialExits.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pos.partialExits.map((pe, i) => (
              <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ color: '#00ff88', background: '#00ff8810', border: '1px solid #00ff8825' }}>
                TP{i + 1} +{pe.pnlPct.toFixed(0)}%
              </span>
            ))}
          </div>
        )}

        {/* DexScreener link */}
        {pos.dexUrl && (
          <a href={pos.dexUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-[#333333] hover:text-[#666666] transition-colors mt-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            View on DexScreener
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
type SubTab = 'overview' | 'open' | 'best'

export function PortfolioDashboard({ strategies, positions, stats, solPrice, onClear }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('overview')

  const allClosed = positions.filter(p => p.status !== 'open')
  const allOpen   = positions.filter(p => p.status === 'open')
  const winners   = allClosed.filter(p => p.totalPnlSol > 0)

  const totalPnlSol = positions.reduce((s, p) => s + p.totalPnlSol, 0)
  const totalPnlUsd = totalPnlSol * solPrice
  const winRate     = allClosed.length > 0 ? (winners.length / allClosed.length) * 100 : 0
  const capitalAtRisk = allOpen.reduce((s, p) => s + p.positionSizeSol * (p.remainingPct / 100), 0)

  const bestStrategy = strategies.reduce<Strategy | null>((best, s) => {
    const st = stats[s.id]
    if (!st || st.totalTrades === 0) return best
    if (!best || (stats[best.id]?.winRate ?? 0) < st.winRate) return s
    return best
  }, null)

  const pnlColor    = totalPnlSol >= 0 ? '#00ff88' : '#ff3355'
  const winRateColor = winRate >= 80 ? '#00ff88' : winRate >= 60 ? '#ffcc00' : '#ff3355'

  // Best trades sorted by PnL%
  const bestTrades = [...allClosed]
    .sort((a, b) => pnlPct(b) - pnlPct(a))
    .slice(0, 20)

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="p-4 space-y-4 max-w-4xl mx-auto">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[14px] text-[#e6e6e6] tracking-wider" style={{ fontFamily: "'Inter', sans-serif" }}>
              PORTFOLIO
            </h2>
            <p className="text-[11px] font-mono text-[#555555] mt-0.5">
              {positions.length} trades · SOL ${solPrice.toFixed(0)}
            </p>
          </div>
          <button onClick={onClear}
            className="text-[11px] font-mono px-3 min-h-[36px] rounded-xl border border-[#1e1e1e] text-[#444444] hover:text-[#888888] hover:border-[#2a2a2a] transition-all cursor-pointer">
            Clear All
          </button>
        </div>

        {/* ── Sub-tab bar ───────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-[#111111] rounded-xl border border-[#1a1a1a]">
          {([
            { id: 'overview' as const, label: 'OVERVIEW' },
            { id: 'open'     as const, label: `OPEN${allOpen.length > 0 ? ` · ${allOpen.length}` : ''}` },
            { id: 'best'     as const, label: `BEST TRADES${winners.length > 0 ? ` · ${Math.min(winners.length, 20)}` : ''}` },
          ]).map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`flex-1 text-[11px] font-mono py-2 rounded-lg transition-all cursor-pointer ${
                subTab === t.id
                  ? 'bg-[#1e1e1e] text-[#e6e6e6] shadow-sm'
                  : 'text-[#444444] hover:text-[#777777]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════ OVERVIEW ═══ */}
        {subTab === 'overview' && (
          <>
            {/* Top metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Total P&L"
                value={`${totalPnlSol >= 0 ? '+' : ''}${totalPnlSol.toFixed(3)} SOL`}
                sub={`${totalPnlUsd >= 0 ? '+' : ''}${formatUSD(Math.abs(totalPnlUsd))}`}
                color={pnlColor} glow />
              <MetricCard label="Win Rate"
                value={allClosed.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
                sub={`${winners.length}W / ${allClosed.length - winners.length}L`}
                color={winRateColor} glow />
              <MetricCard label="Open Trades"
                value={`${allOpen.length}`}
                sub={`${capitalAtRisk.toFixed(3)} SOL at risk`}
                color="#00d4ff" />
              <MetricCard label="Total Trades"
                value={`${positions.length}`}
                sub={bestStrategy ? `Best: ${bestStrategy.name}` : 'No trades yet'} />
            </div>

            {/* Strategy breakdown */}
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
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: strategy.color }} />
                        <span className="text-[12px] font-mono truncate" style={{ color: strategy.enabled ? '#e6e6e6' : '#444444' }}>
                          {strategy.name}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono" style={{ color: wrColor }}>
                            {st.totalTrades > 0 ? `${wr.toFixed(0)}% WR` : '—'}
                          </span>
                          <span className="text-[10px] font-mono text-[#444444]">{st.totalTrades} trades</span>
                        </div>
                        <WinRateBar rate={wr} color={wrColor} />
                      </div>
                      <div className="w-20 text-right shrink-0">
                        <span className="text-[12px] font-mono tabular-nums" style={{ color: pnl >= 0 ? '#00ff88' : '#ff3355' }}>
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

            {/* Recent closed trades list */}
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#888888] uppercase tracking-wider">Recent Trades</span>
                {allClosed.length > 0 && (
                  <button onClick={() => setSubTab('best')}
                    className="text-[10px] font-mono text-[#444444] hover:text-[#888888] transition-colors cursor-pointer">
                    See best →
                  </button>
                )}
              </div>
              {allClosed.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[#333333] font-mono text-sm">No closed trades yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[#1a1a1a]">
                  {[...allClosed]
                    .sort((a, b) => new Date(b.exitTime ?? b.entryTime).getTime() - new Date(a.exitTime ?? a.entryTime).getTime())
                    .slice(0, 10)
                    .map(pos => {
                      const pct = pnlPct(pos)
                      const pnlC = pct >= 0 ? '#00ff88' : '#ff3355'
                      const st = strategies.find(s => s.id === pos.strategyId)
                      const status = STATUS_CFG[pos.status] ?? { label: pos.status, color: '#888888' }
                      return (
                        <div key={pos.id} className="px-4 py-3 flex items-center gap-3">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
                            style={{ color: status.color, background: status.color + '15', border: `1px solid ${status.color}25` }}>
                            {status.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-mono text-[#e6e6e6] font-bold truncate">{pos.tokenSymbol}</span>
                              {st && <span className="text-[9px] font-mono shrink-0" style={{ color: st.color }}>{st.name}</span>}
                            </div>
                            <p className="text-[10px] font-mono text-[#444444]">{holdTime(pos.entryTime, pos.exitTime)} hold</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[13px] font-mono font-bold tabular-nums" style={{ color: pnlC }}>
                              {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                            </p>
                            <p className="text-[10px] font-mono tabular-nums" style={{ color: pnlC }}>
                              {pos.totalPnlSol >= 0 ? '+' : ''}{pos.totalPnlSol.toFixed(4)} SOL
                            </p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════ OPEN ════════ */}
        {subTab === 'open' && (
          <>
            {allOpen.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
                <p className="text-[#444444] font-mono text-sm">No open positions</p>
                <p className="text-[#2a2a2a] font-mono text-[11px]">Enable a strategy to start tracking</p>
              </div>
            ) : (
              <>
                {/* Capital at risk banner */}
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#00d4ff08] border border-[#00d4ff20]">
                  <span className="text-[11px] font-mono text-[#00d4ff]">{allOpen.length} open positions</span>
                  <span className="text-[11px] font-mono text-[#00d4ff] tabular-nums">{capitalAtRisk.toFixed(3)} SOL at risk</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allOpen.map(pos => (
                    <OpenPositionCard key={pos.id} pos={pos} strategy={strategies.find(s => s.id === pos.strategyId)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════ BEST TRADES ═ */}
        {subTab === 'best' && (
          <>
            {bestTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="text-[48px]">🏆</span>
                <p className="text-[#444444] font-mono text-sm">No winning trades yet</p>
                <p className="text-[#2a2a2a] font-mono text-[11px]">Your hall of fame will appear here</p>
              </div>
            ) : (
              <>
                {/* Hall of fame header */}
                <div className="text-center py-2">
                  <p className="text-[11px] font-mono text-[#555555] uppercase tracking-widest">🏆 Hall of Fame · Top {bestTrades.length} Trades</p>
                </div>

                {/* Top 3 podium - full width */}
                {bestTrades.slice(0, Math.min(3, bestTrades.length)).map((pos, i) => (
                  <BestTradeCard key={pos.id} pos={pos} rank={i + 1} strategy={strategies.find(s => s.id === pos.strategyId)} />
                ))}

                {/* Remaining in 2-col grid */}
                {bestTrades.length > 3 && (
                  <>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="h-px flex-1 bg-[#1a1a1a]" />
                      <span className="text-[10px] font-mono text-[#333333] uppercase tracking-widest">More Winners</span>
                      <div className="h-px flex-1 bg-[#1a1a1a]" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {bestTrades.slice(3).map((pos, i) => (
                        <BestTradeCard key={pos.id} pos={pos} rank={i + 4} strategy={strategies.find(s => s.id === pos.strategyId)} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}
