import { useState } from 'react'
import type { Position, Strategy, StrategyStats } from '../../types/backtest'
import { formatUSD } from '../../lib/mockData'
import { useWalletBalance } from '../../hooks/useWalletBalance'
import { useAdmin } from '../../contexts/AdminContext'
import { useWallet } from '@solana/wallet-adapter-react'

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

// ── WinRateBar ────────────────────────────────────────────────────────────────
function WinRateBar({ rate, color }: { rate: number; color: string }) {
  return (
    <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, rate)}%`, background: color }} />
    </div>
  )
}

// ── Open Position Card (Phantom token row style) ──────────────────────────────
function OpenPositionCard({ pos, strategy }: { pos: Position; strategy: Strategy | undefined }) {
  const pct = pos.unrealizedPnlPct
  const pnlColor = pct >= 0 ? '#00ff88' : '#ff3355'
  const strColor = strategy?.color ?? '#888888'
  const mcapProgress = pos.entryMcap > 0 ? Math.min(100, (pos.currentMcap / pos.entryMcap) * 50) : 50

  return (
    <div
      className="bg-[#111] border rounded-2xl overflow-hidden relative"
      style={{
        borderColor: pct >= 5 ? `${pnlColor}40` : '#1e1e1e',
        boxShadow: pct >= 5 ? `0 0 20px ${pnlColor}08` : undefined,
      }}
    >
      <div className="h-0.5 w-full" style={{ background: strColor }} />
      <div className="p-4">
        {/* Big PnL */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[32px] font-bold tabular-nums leading-none" style={{ color: pnlColor, fontFamily: "'Inter', sans-serif" }}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
            </p>
            <p className="text-[12px] font-mono mt-0.5" style={{ color: pnlColor }}>
              {pos.unrealizedPnlSol >= 0 ? '+' : ''}{pos.unrealizedPnlSol.toFixed(4)} SOL
            </p>
          </div>
          <span className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded-full bg-[#00d4ff10] text-[#00d4ff] border border-[#00d4ff25] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]" style={{ animation: 'pill-dot-pulse 1.5s ease-in-out infinite' }} />
            LIVE
          </span>
        </div>

        {/* Token row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: strColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
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
          <div className="text-right shrink-0">
            <p className="text-[12px] font-mono text-[#888888]">{pos.positionSizeSol.toFixed(2)} SOL</p>
            <p className="text-[9px] font-mono text-[#444444]">size</p>
          </div>
        </div>

        {/* Progress bar: entry → current */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] font-mono text-[#444444]">
            <span>ENTRY {formatUSD(pos.entryMcap)}</span>
            <span>NOW {formatUSD(pos.currentMcap)}</span>
          </div>
          <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${mcapProgress}%`, background: pnlColor, opacity: 0.7 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Best Trade Card (leaderboard style) ───────────────────────────────────────
function BestTradeCard({ pos, rank, strategy }: { pos: Position; rank: number; strategy: Strategy | undefined }) {
  const pct = pnlPct(pos)
  const pnlColor = pct >= 0 ? '#00ff88' : '#ff3355'
  const strColor = strategy?.color ?? '#888888'
  const status = STATUS_CFG[pos.status] ?? { label: pos.status, color: '#888888' }
  const hold = holdTime(pos.entryTime, pos.exitTime)
  const exitMcap = pos.currentMcap > 0 ? pos.currentMcap : pos.entryMcap
  const multiplier = pos.entryMcap > 0 ? exitMcap / pos.entryMcap : 1

  const rankBadgeStyle =
    rank === 1
      ? { color: '#0d0d0d', background: '#ffd700', border: '1px solid #ffd700' }
      : rank === 2
      ? { color: '#0d0d0d', background: '#c0c0c0', border: '1px solid #c0c0c0' }
      : rank === 3
      ? { color: '#0d0d0d', background: '#cd7f32', border: '1px solid #cd7f32' }
      : { color: '#888888', background: '#1a1a1a', border: '1px solid #2a2a2a' }

  return (
    <div
      className="bg-[#111] border rounded-2xl overflow-hidden relative"
      style={{
        borderColor: rank <= 3 ? `${pnlColor}50` : rank <= 10 ? `${pnlColor}25` : '#1e1e1e',
        boxShadow: rank === 1 ? `0 0 32px ${pnlColor}15` : rank <= 3 ? `0 0 16px ${pnlColor}08` : undefined,
      }}
    >
      <div className="h-0.5" style={{ background: rank <= 3 ? pnlColor : strColor }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          <span
            className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg shrink-0"
            style={rankBadgeStyle}
          >
            #{rank}
          </span>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
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
                <p className="text-[10px] font-mono text-[#444444] mt-0.5">{hold} hold</p>
              </div>
              <span className="text-[9px] font-mono px-2 py-1 rounded-full shrink-0"
                style={{ color: status.color, background: `${status.color}15`, border: `1px solid ${status.color}25` }}>
                {status.label}
              </span>
            </div>

            {/* PnL row */}
            <div className="flex items-end justify-between mt-2">
              <div>
                <p className="text-[28px] font-bold tabular-nums leading-none" style={{ color: pnlColor, fontFamily: "'Inter', sans-serif" }}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                </p>
                <p className="text-[11px] font-mono mt-0.5" style={{ color: pnlColor }}>
                  {pos.totalPnlSol >= 0 ? '+' : ''}{pos.totalPnlSol.toFixed(4)} SOL
                </p>
              </div>
              <div className="text-right">
                <p className="text-[20px] font-bold tabular-nums" style={{ color: multiplier >= 2 ? '#ffd700' : '#888888', fontFamily: "'Inter', sans-serif" }}>
                  {multiplier.toFixed(1)}×
                </p>
                <p className="text-[9px] font-mono text-[#444444]">mcap mult</p>
              </div>
            </div>

            {/* MCap journey */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-[#0d0d0d] rounded-lg p-1.5 text-center">
                <p className="text-[9px] font-mono text-[#444444]">ENTRY</p>
                <p className="text-[10px] font-mono text-[#888888]">{formatUSD(pos.entryMcap)}</p>
              </div>
              <svg width="16" height="10" viewBox="0 0 20 12" fill="none">
                <path d="M0 6h16m0 0l-5-5m5 5l-5 5" stroke={pnlColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="flex-1 bg-[#0d0d0d] rounded-lg p-1.5 text-center">
                <p className="text-[9px] font-mono text-[#444444]">EXIT</p>
                <p className="text-[10px] font-mono text-[#888888]">{formatUSD(exitMcap)}</p>
              </div>
            </div>

            {pos.partialExits.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {pos.partialExits.map((pe, i) => (
                  <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{ color: '#00ff88', background: '#00ff8810', border: '1px solid #00ff8825' }}>
                    TP{i + 1} +{pe.pnlPct.toFixed(0)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Circular balance gauge ────────────────────────────────────────────────────
function BalanceRing({ winRate, size = 160 }: { winRate: number; size?: number }) {
  const R = size / 2 - 12
  const C = 2 * Math.PI * R
  const filled = (Math.min(100, winRate) / 100) * C
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="#1a1a1a" strokeWidth="10"/>
      {/* Win rate arc */}
      <circle cx={size/2} cy={size/2} r={R} fill="none"
        stroke="url(#balGrad)" strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${C - filled}`}
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <defs>
        <linearGradient id="balGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00d4ff"/>
          <stop offset="100%" stopColor="#00ff88"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
type SubTab = 'overview' | 'open' | 'best'

export function PortfolioDashboard({ strategies, positions, stats, solPrice, onClear }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('overview')
  const { balance } = useWalletBalance()
  const { profile } = useAdmin()
  const { publicKey } = useWallet()

  const walletPk = publicKey?.toBase58()

  const allClosed = positions.filter(p => p.status !== 'open')
  const allOpen   = positions.filter(p => p.status === 'open')
  const winners   = allClosed.filter(p => p.totalPnlSol > 0)

  const totalPnlSol    = positions.reduce((s, p) => s + p.totalPnlSol, 0)
  const totalPnlUsd    = totalPnlSol * solPrice
  const winRate        = allClosed.length > 0 ? (winners.length / allClosed.length) * 100 : 0
  const capitalAtRisk  = allOpen.reduce((s, p) => s + p.positionSizeSol * (p.remainingPct / 100), 0)

  const bestStrategy = strategies.reduce<Strategy | null>((best, s) => {
    const st = stats[s.id]
    if (!st || st.totalTrades === 0) return best
    if (!best || (stats[best.id]?.winRate ?? 0) < st.winRate) return s
    return best
  }, null)

  const pnlColor     = totalPnlSol >= 0 ? '#00ff88' : '#ff3355'
  const winRateColor = winRate >= 80 ? '#00ff88' : winRate >= 60 ? '#ffcc00' : '#ff3355'

  const bestTrades = [...allClosed].sort((a, b) => pnlPct(b) - pnlPct(a)).slice(0, 20)

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="max-w-4xl mx-auto">

        {/* ── Figma-inspired balance header ─────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl mx-4 mt-4 mb-2"
          style={{ background: 'linear-gradient(135deg, #0d1117 0%, #0a0f1a 50%, #0d0d1a 100%)' }}>
          {/* Subtle radial glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.06) 0%, transparent 70%)' }}/>

          <div className="relative p-5">
            {/* Profile row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                  style={{ background: `${profile.avatarColor}20`, border: `2px solid ${profile.avatarColor}40`, color: profile.avatarColor }}>
                  {profile.username.slice(0, 2)}
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#e6e6e6]" style={{ fontFamily: "'Inter', sans-serif" }}>{profile.username}</p>
                  {walletPk && (
                    <p className="text-[10px] font-mono text-[#444]">{walletPk.slice(0,4)}...{walletPk.slice(-4)}</p>
                  )}
                </div>
              </div>
              {/* Clear button */}
              <button onClick={onClear}
                className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg border border-[#1e1e1e] text-[#444444] hover:text-[#888888] transition-all cursor-pointer">
                Clear
              </button>
            </div>

            {/* Balance + ring */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-[#555555] mb-1 uppercase tracking-wider">SOL Balance</p>
                <p className="text-[32px] font-bold tabular-nums text-[#f0f0f0] leading-none" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {balance !== null ? balance.toFixed(4) : '-.----'}
                </p>
                <p className="text-[14px] font-mono text-[#555555] mt-1">
                  ${balance !== null ? (balance * solPrice).toFixed(2) : '--.--'}
                </p>
                {/* Paper PnL chip */}
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold"
                  style={{
                    color: pnlColor,
                    background: `${pnlColor}12`,
                    border: `1px solid ${pnlColor}25`
                  }}>
                  <span>{totalPnlSol >= 0 ? '+' : ''}{totalPnlSol.toFixed(3)} SOL</span>
                  <span style={{ color: `${pnlColor}80` }}>paper</span>
                </div>
              </div>
              {/* Circular gauge */}
              <div className="relative shrink-0">
                <BalanceRing winRate={winRate} size={130}/>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[20px] font-bold tabular-nums" style={{ color: winRateColor, fontFamily: "'Inter', sans-serif" }}>
                    {allClosed.length > 0 ? `${winRate.toFixed(0)}%` : '—'}
                  </p>
                  <p className="text-[9px] font-mono text-[#444]">WIN RATE</p>
                </div>
              </div>
            </div>

            {/* Action buttons row — also serve as tab switcher */}
            <div className="flex gap-3 mt-4">
              {([
                { label: 'Positions', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, tab: 'open' as const },
                { label: 'Best', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, tab: 'best' as const },
                { label: 'Overview', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, tab: 'overview' as const },
              ] as const).map(btn => (
                <button key={btn.tab} onClick={() => setSubTab(btn.tab)}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all cursor-pointer"
                  style={{
                    borderColor: subTab === btn.tab ? '#00d4ff30' : '#1e1e1e',
                    background: subTab === btn.tab ? '#00d4ff0a' : '#0d0d0d',
                    color: subTab === btn.tab ? '#00d4ff' : '#444444',
                  }}>
                  {btn.icon}
                  <span className="text-[9px] font-mono">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* ═══════════════════════════════════════════ OVERVIEW ════════ */}
          {subTab === 'overview' && (
            <>
              {/* POSITIONS section */}
              <div>
                <p className="text-[10px] font-mono text-[#333333] uppercase tracking-widest mb-2 px-1">Positions</p>
                <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden divide-y divide-[#1a1a1a]">
                  {/* Paper Portfolio row */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#1a1a1a] shrink-0 text-[16px]">
                      ◎
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#e6e6e6]" style={{ fontFamily: "'Inter', sans-serif" }}>
                        Paper Portfolio
                      </p>
                      <p className="text-[10px] font-mono text-[#444444]">{positions.length} trades</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-mono font-bold tabular-nums" style={{ color: pnlColor }}>
                        {totalPnlSol >= 0 ? '+' : ''}{totalPnlSol.toFixed(4)} SOL
                      </p>
                      <p className="text-[10px] font-mono text-[#444444]">
                        {totalPnlUsd >= 0 ? '+' : ''}${Math.abs(totalPnlUsd).toFixed(2)} USD
                      </p>
                    </div>
                  </div>
                  {/* Win Rate row */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${winRateColor}15` }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: winRateColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#e6e6e6]" style={{ fontFamily: "'Inter', sans-serif" }}>
                        Win Rate
                      </p>
                      <p className="text-[10px] font-mono text-[#444444]">
                        {winners.length}W / {allClosed.length - winners.length}L
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-mono font-bold tabular-nums" style={{ color: winRateColor }}>
                        {allClosed.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                  </div>
                  {/* Open Positions row */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(0,212,255,0.1)' }}>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00d4ff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#e6e6e6]" style={{ fontFamily: "'Inter', sans-serif" }}>
                        Open Positions
                      </p>
                      <p className="text-[10px] font-mono text-[#444444]">
                        {capitalAtRisk.toFixed(3)} SOL at risk
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-mono font-bold text-[#00d4ff] tabular-nums">
                        {allOpen.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* STRATEGIES section */}
              <div>
                <p className="text-[10px] font-mono text-[#333333] uppercase tracking-widest mb-2 px-1">Strategies</p>
                <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                  <div className="divide-y divide-[#1a1a1a]">
                    {strategies.map(strategy => {
                      const st = stats[strategy.id]
                      if (!st) return null
                      const wr = st.winRate
                      const wrColor = wr >= 80 ? '#00ff88' : wr >= 60 ? '#ffcc00' : '#ff3355'
                      const pnl = st.totalPnlSol
                      const isBest = bestStrategy?.id === strategy.id && st.totalTrades > 0
                      return (
                        <div key={strategy.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: `${strategy.color}18` }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: strategy.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[12px] font-bold truncate" style={{ color: strategy.enabled ? '#e6e6e6' : '#444444', fontFamily: "'Inter', sans-serif" }}>
                                {strategy.name}
                              </span>
                              {isBest && (
                                <span className="text-[8px] font-mono px-1.5 rounded-full" style={{ color: '#ffd700', background: '#ffd70015' }}>
                                  BEST
                                </span>
                              )}
                            </div>
                            <WinRateBar rate={wr} color={wrColor} />
                            <div className="flex justify-between mt-0.5">
                              <span className="text-[9px] font-mono" style={{ color: wrColor }}>
                                {st.totalTrades > 0 ? `${wr.toFixed(0)}% WR` : '—'}
                              </span>
                              <span className="text-[9px] font-mono text-[#444444]">{st.totalTrades} trades</span>
                            </div>
                          </div>
                          <div className="w-20 text-right shrink-0">
                            <span className="text-[12px] font-mono tabular-nums font-bold" style={{ color: pnl >= 0 ? '#00ff88' : '#ff3355' }}>
                              {pnl >= 0 ? '+' : ''}{pnl.toFixed(3)}
                            </span>
                            <p className="text-[9px] font-mono text-[#444444]">SOL</p>
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
              </div>

              {/* Recent closed trades */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-mono text-[#333333] uppercase tracking-widest">Recent Trades</p>
                  {allClosed.length > 0 && (
                    <button onClick={() => setSubTab('best')}
                      className="text-[10px] font-mono text-[#444444] hover:text-[#888888] transition-colors cursor-pointer">
                      See best →
                    </button>
                  )}
                </div>
                {allClosed.length === 0 ? (
                  <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl px-4 py-8 text-center">
                    <p className="text-[#333333] font-mono text-sm">No closed trades yet</p>
                  </div>
                ) : (
                  <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden divide-y divide-[#1a1a1a]">
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

          {/* ═══════════════════════════════════════════ OPEN ════════════ */}
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

          {/* ═══════════════════════════════════════════ BEST TRADES ═════ */}
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
                  <div className="text-center py-1">
                    <p className="text-[10px] font-mono text-[#333333] uppercase tracking-widest">Hall of Fame · Top {bestTrades.length} Trades</p>
                  </div>
                  {bestTrades.slice(0, Math.min(3, bestTrades.length)).map((pos, i) => (
                    <BestTradeCard key={pos.id} pos={pos} rank={i + 1} strategy={strategies.find(s => s.id === pos.strategyId)} />
                  ))}
                  {bestTrades.length > 3 && (
                    <>
                      <div className="flex items-center gap-3">
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
    </div>
  )
}
