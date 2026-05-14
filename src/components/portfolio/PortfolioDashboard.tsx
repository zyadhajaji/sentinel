import { useState, useMemo, useRef } from 'react'
import type { Position, Strategy, StrategyStats } from '../../types/backtest'
import { useWalletBalance } from '../../hooks/useWalletBalance'
import { useAdmin } from '../../contexts/AdminContext'
import { useWallet } from '@solana/wallet-adapter-react'

interface Props {
  strategies: Strategy[]
  positions: Position[]
  stats: Record<string, StrategyStats>
  solPrice: number
  onClear: () => void
  onProfileOpen: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function fmtSol(n: number): string {
  return Math.abs(n) >= 1 ? n.toFixed(3) : n.toFixed(4)
}

function fmtUSD(usd: number): string {
  if (Math.abs(usd) >= 1000) return `$${(usd / 1000).toFixed(1)}K`
  return `$${usd.toFixed(2)}`
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  open:           { label: 'LIVE',    color: '#00d4ff' },
  closed_tp:      { label: 'TP',      color: '#00ff88' },
  closed_sl:      { label: 'SL',      color: '#ff3355' },
  closed_timeout: { label: 'TIME',    color: '#ffcc00' },
  closed_rug:     { label: 'RUG',     color: '#ff3355' },
}

// ── PortfolioDonut ─────────────────────────────────────────────────────────────
function PortfolioDonut({
  solBalance, usdBalance, winRate, pnlSol, showUsd, onToggle,
}: {
  solBalance: number; usdBalance: number; winRate: number; pnlSol: number;
  showUsd: boolean; onToggle: () => void;
}) {
  const SIZE = 210, R = 82, CX = SIZE / 2, CY = SIZE / 2, SW = 13
  const C = 2 * Math.PI * R
  const filled = (Math.min(100, Math.max(0, winRate)) / 100) * C * 0.85 // 85% max arc
  const pnlColor = pnlSol >= 0 ? '#00ff88' : '#ff3355'

  return (
    <button
      onClick={onToggle}
      className="relative cursor-pointer select-none active:scale-95 transition-transform"
      style={{ width: SIZE, height: SIZE }}
      aria-label="Toggle SOL / USD"
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <linearGradient id="dGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="60%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="dGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1e1e1e" strokeWidth={SW} />
        {/* Progress arc */}
        <circle
          cx={CX} cy={CY} r={R} fill="none"
          stroke="url(#dGrad)" strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${C - filled}`}
          transform={`rotate(-90 ${CX} ${CY})`}
          filter="url(#dGlow)"
        />
        {/* Win rate dot */}
        {winRate > 0 && (
          <circle
            cx={CX + R * Math.cos((-90 + (winRate / 100) * 0.85 * 360) * Math.PI / 180)}
            cy={CY + R * Math.sin((-90 + (winRate / 100) * 0.85 * 360) * Math.PI / 180)}
            r="4" fill="#fff" opacity="0.9"
          />
        )}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-[9px] font-mono text-[#444] uppercase tracking-widest mb-1">
          {showUsd ? 'USD value' : 'Solana balance'}
        </p>
        <p className="text-[26px] font-bold tabular-nums leading-none" style={{ color: '#f0f0f0', fontFamily: "'Inter', sans-serif" }}>
          {showUsd
            ? fmtUSD(usdBalance)
            : `${fmtSol(solBalance)}`
          }
        </p>
        <p className="text-[10px] font-mono text-[#444] mt-0.5">
          {showUsd ? `${fmtSol(solBalance)} SOL` : fmtUSD(usdBalance)}
        </p>
        {pnlSol !== 0 && (
          <p className="text-[10px] font-mono mt-1.5 font-bold" style={{ color: pnlColor }}>
            {pnlSol >= 0 ? '+' : ''}{fmtSol(pnlSol)} SOL paper
          </p>
        )}
        <p className="text-[8px] font-mono text-[#2a2a2a] mt-1">tap to switch</p>
      </div>
    </button>
  )
}

// ── Area Chart ────────────────────────────────────────────────────────────────
type TimeRange = '1D' | '1W' | '1M' | 'ALL'

function PortfolioChart({ positions }: { positions: Position[] }) {
  const [range, setRange] = useState<TimeRange>('ALL')

  const allPoints = useMemo(() => {
    const closed = positions
      .filter(p => p.exitTime)
      .sort((a, b) => new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime())

    if (closed.length === 0) return null

    let running = 0
    const pts: { t: number; v: number }[] = [
      { t: new Date(closed[0].exitTime!).getTime() - 60_000, v: 0 },
    ]
    for (const pos of closed) {
      running += pos.totalPnlSol
      pts.push({ t: new Date(pos.exitTime!).getTime(), v: running })
    }
    // ensure we have current time at end
    if (pts[pts.length - 1].t < Date.now() - 60_000) {
      pts.push({ t: Date.now(), v: running })
    }
    return pts
  }, [positions])

  const points = useMemo(() => {
    if (!allPoints) return null
    const now = Date.now()
    const cutoff = range === '1D' ? now - 86_400_000
      : range === '1W' ? now - 7 * 86_400_000
      : range === '1M' ? now - 30 * 86_400_000
      : 0
    const f = allPoints.filter(p => p.t >= cutoff)
    return f.length >= 2 ? f : allPoints
  }, [allPoints, range])

  const currentPnl = points ? points[points.length - 1].v : 0
  const isUp = currentPnl >= 0
  const lineColor = isUp ? '#a78bfa' : '#f87171'
  const fillColor = isUp ? '#7c3aed' : '#dc2626'

  function buildPath(pts: { t: number; v: number }[], W: number, H: number) {
    const minV = Math.min(...pts.map(p => p.v))
    const maxV = Math.max(...pts.map(p => p.v))
    const vRange = maxV - minV || 0.0001
    const pad = 12
    const toX = (i: number) => (i / (pts.length - 1)) * W
    const toY = (v: number) => H - pad - ((v - minV) / vRange) * (H - pad * 2)

    // Smooth bezier
    let d = `M ${toX(0).toFixed(1)} ${toY(pts[0].v).toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const px = toX(i - 1), py = toY(pts[i - 1].v)
      const cx = toX(i), cy = toY(pts[i].v)
      const cpx = (px + cx) / 2
      d += ` C ${cpx.toFixed(1)} ${py.toFixed(1)} ${cpx.toFixed(1)} ${cy.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}`
    }

    const lastX = toX(pts.length - 1).toFixed(1)
    const area = d + ` L ${lastX} ${H} L 0 ${H} Z`
    const lastY = toY(pts[pts.length - 1].v)
    return { line: d, area, lastX: parseFloat(lastX), lastY }
  }

  const W = 320, H = 130
  const chartData = points ? buildPath(points, W, H) : null

  return (
    <div className="bg-[#111111] rounded-2xl border border-[#1a1a1a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <p className="text-[11px] font-mono text-[#444] uppercase tracking-wider">Performance</p>
          <p className="text-[20px] font-bold tabular-nums mt-0.5" style={{ color: isUp ? '#a78bfa' : '#f87171', fontFamily: "'Inter', sans-serif" }}>
            {currentPnl >= 0 ? '+' : ''}{fmtSol(currentPnl)} SOL
          </p>
        </div>
        {/* Time range */}
        <div className="flex gap-1 bg-[#0d0d0d] rounded-xl p-1">
          {(['1D', '1W', '1M', 'ALL'] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="text-[10px] font-mono px-2 py-1 rounded-lg transition-all cursor-pointer"
              style={{
                background: range === r ? '#1e1e1e' : 'transparent',
                color: range === r ? '#e6e6e6' : '#444',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-3">
        {!chartData ? (
          <div className="flex items-center justify-center h-[130px]">
            <p className="text-[11px] font-mono text-[#2a2a2a]">No closed trades yet</p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ height: H, display: 'block' }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillColor} stopOpacity="0.35" />
                <stop offset="75%" stopColor={fillColor} stopOpacity="0.06" />
                <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Subtle horizontal grid lines */}
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1="0" y1={H * f} x2={W} y2={H * f}
                stroke="#1a1a1a" strokeWidth="1" />
            ))}
            {/* Fill */}
            <path d={chartData.area} fill="url(#chartFill)" />
            {/* Line */}
            <path d={chartData.line} fill="none" stroke={lineColor} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
            {/* End dot */}
            <circle cx={chartData.lastX} cy={chartData.lastY} r="4" fill={lineColor} />
            <circle cx={chartData.lastX} cy={chartData.lastY} r="7" fill={lineColor} opacity="0.25" />
          </svg>
        )}
      </div>
    </div>
  )
}

// ── Allocation Donut ──────────────────────────────────────────────────────────
function AllocationDonut({ strategies, stats }: { strategies: Strategy[]; stats: Record<string, StrategyStats> }) {
  const SIZE = 140, R = 52, CX = SIZE / 2, CY = SIZE / 2, SW = 14
  const GAP = 0.06 // radians gap between segments

  const segments = strategies
    .map(s => ({
      id: s.id, name: s.name, color: s.color,
      trades: stats[s.id]?.totalTrades ?? 0,
      pnl: stats[s.id]?.totalPnlSol ?? 0,
    }))
    .filter(s => s.trades > 0)

  const total = segments.reduce((s, seg) => s + seg.trades, 0)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
        <div className="text-center">
          <p className="text-[10px] font-mono text-[#2a2a2a]">No trades</p>
        </div>
      </div>
    )
  }

  // Build arc paths
  let angle = -Math.PI / 2
  const arcs = segments.map(seg => {
    const frac = seg.trades / total
    const sweep = frac * Math.PI * 2 - GAP
    const start = angle + GAP / 2
    const end = start + sweep
    angle += frac * Math.PI * 2

    const x1 = CX + R * Math.cos(start), y1 = CY + R * Math.sin(start)
    const x2 = CX + R * Math.cos(end),   y2 = CY + R * Math.sin(end)
    const large = sweep > Math.PI ? 1 : 0
    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`

    return { ...seg, d, pct: Math.round(frac * 100) }
  })

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1a1a1a" strokeWidth={SW} />
          {arcs.map(arc => (
            <path key={arc.id} d={arc.d} fill="none"
              stroke={arc.color} strokeWidth={SW} strokeLinecap="round" />
          ))}
        </svg>
        {/* Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[16px] font-bold text-[#e6e6e6]" style={{ fontFamily: "'Inter', sans-serif" }}>{total}</p>
          <p className="text-[8px] font-mono text-[#444] uppercase tracking-wider">trades</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 min-w-0 space-y-2">
        {arcs.slice(0, 5).map(arc => (
          <div key={arc.id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: arc.color }} />
            <span className="text-[10px] font-mono text-[#666] flex-1 truncate">{arc.name}</span>
            <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color: arc.pnl >= 0 ? '#00ff88' : '#ff3355' }}>
              {arc.pnl >= 0 ? '+' : ''}{fmtSol(arc.pnl)}
            </span>
            <span className="text-[9px] font-mono text-[#333] shrink-0 w-7 text-right">{arc.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────
function ActionBtn({
  icon, label, color, onClick,
}: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 cursor-pointer group"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-active:scale-95"
        style={{ background: `${color}15`, border: `1px solid ${color}25` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <span className="text-[10px] font-mono" style={{ color: '#555' }}>{label}</span>
    </button>
  )
}

// ── Deposit Modal ─────────────────────────────────────────────────────────────
function DepositModal({ walletPk, onClose }: { walletPk?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    if (!walletPk) return
    navigator.clipboard.writeText(walletPk).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full sm:w-96 bg-[#0d0d0d] border border-[#1e1e1e] rounded-t-3xl sm:rounded-3xl p-6 z-10 space-y-5">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#444] hover:text-[#888] cursor-pointer rounded-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {/* Icon */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[#7c3aed15] border border-[#7c3aed25]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v16M5 9l7-7 7 7"/>
              <path d="M5 22h14"/>
            </svg>
          </div>
          <h2 className="text-[15px] font-bold text-[#e6e6e6]">Deposit SOL</h2>
          <p className="text-[11px] font-mono text-[#444] text-center">
            Send SOL to your connected wallet address below
          </p>
        </div>

        {/* Address */}
        <div className="bg-[#080808] border border-[#1e1e1e] rounded-2xl p-4 space-y-2">
          <p className="text-[9px] font-mono text-[#333] uppercase tracking-widest">Your Solana address</p>
          {walletPk ? (
            <>
              <p className="text-[11px] font-mono text-[#888] break-all leading-relaxed">{walletPk}</p>
              <button
                onClick={copy}
                className="w-full min-h-[44px] rounded-xl text-[12px] font-mono font-bold transition-all cursor-pointer mt-1"
                style={{
                  background: copied ? '#00ff8815' : '#7c3aed18',
                  border: copied ? '1px solid #00ff8840' : '1px solid #7c3aed40',
                  color: copied ? '#00ff88' : '#a78bfa',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy Address'}
              </button>
            </>
          ) : (
            <p className="text-[11px] font-mono text-[#444] py-2">Connect wallet to show address</p>
          )}
        </div>

        <p className="text-[9px] font-mono text-[#2a2a2a] text-center">
          Only send SOL and SPL tokens on Solana network
        </p>
      </div>
    </div>
  )
}

// ── Withdraw Modal ────────────────────────────────────────────────────────────
function WithdrawModal({ onClose, solBalance, solPrice }: { onClose: () => void; solBalance: number; solPrice: number }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full sm:w-96 bg-[#0d0d0d] border border-[#1e1e1e] rounded-t-3xl sm:rounded-3xl p-6 z-10 space-y-5">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#444] hover:text-[#888] cursor-pointer rounded-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[#ff355515] border border-[#ff355525]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff3355" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22V6M5 15l7 7 7-7"/>
              <path d="M5 2h14"/>
            </svg>
          </div>
          <h2 className="text-[15px] font-bold text-[#e6e6e6]">Withdraw SOL</h2>
        </div>

        {/* Balance */}
        <div className="bg-[#080808] border border-[#1e1e1e] rounded-2xl p-4">
          <p className="text-[9px] font-mono text-[#333] uppercase tracking-widest mb-2">Available</p>
          <p className="text-[24px] font-bold tabular-nums text-[#e6e6e6]" style={{ fontFamily: "'Inter', sans-serif" }}>
            {fmtSol(solBalance)} <span className="text-[14px] text-[#444]">SOL</span>
          </p>
          <p className="text-[12px] font-mono text-[#555]">{fmtUSD(solBalance * solPrice)} USD</p>
        </div>

        {/* Guidance */}
        <div className="bg-[#0f0a00] border border-[#ffcc0020] rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffcc00" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-[11px] font-mono text-[#ffcc00] font-bold">Use your wallet app</p>
          </div>
          <p className="text-[10px] font-mono text-[#555] leading-relaxed">
            To withdraw SOL, open Phantom or Solflare, select Send, and enter the destination address. Sentinel Terminal does not execute transactions on your behalf.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full min-h-[44px] rounded-2xl text-[12px] font-mono font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-[#555] hover:text-[#888] transition-all cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

// ── Transaction Row ───────────────────────────────────────────────────────────
function TransactionRow({ pos, strategy }: { pos: Position; strategy?: Strategy }) {
  const pct = pnlPct(pos)
  const pnlColor = pos.totalPnlSol >= 0 ? '#00ff88' : '#ff3355'
  const strColor = strategy?.color ?? '#555'
  const status = STATUS_CFG[pos.status] ?? { label: pos.status.toUpperCase(), color: '#888' }
  const isOpen = pos.status === 'open'

  return (
    <div className="flex items-center gap-3 px-4 py-3 active:bg-[#0f0f0f] transition-colors">
      {/* Token circle */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
        style={{ background: `${strColor}18`, border: `1.5px solid ${strColor}30`, color: strColor }}
      >
        {pos.tokenSymbol.slice(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-[#e6e6e6] truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
            {pos.tokenSymbol}
          </span>
          <span
            className="text-[8px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
            style={{ color: status.color, background: `${status.color}15` }}
          >
            {status.label}
          </span>
        </div>
        <p className="text-[10px] font-mono text-[#444]">
          {strategy?.name ?? 'Unknown'} · {isOpen ? `${holdTime(pos.entryTime, null)} open` : holdTime(pos.entryTime, pos.exitTime)}
        </p>
      </div>

      {/* PnL */}
      <div className="text-right shrink-0">
        <p className="text-[13px] font-mono font-bold tabular-nums" style={{ color: pnlColor }}>
          {isOpen
            ? `${pos.unrealizedPnlSol >= 0 ? '+' : ''}${pos.unrealizedPnlSol.toFixed(4)}`
            : `${pos.totalPnlSol >= 0 ? '+' : ''}${pos.totalPnlSol.toFixed(4)}`
          }
        </p>
        <p className="text-[10px] font-mono tabular-nums" style={{ color: pnlColor }}>
          {isOpen ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
        </p>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
type SubTab = 'overview' | 'chart' | 'positions' | 'history'

export function PortfolioDashboard({ strategies, positions, stats, solPrice, onClear, onProfileOpen }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('overview')
  const [showUsd, setShowUsd] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [balanceEditOpen, setBalanceEditOpen] = useState(false)
  const [fakeBalanceInput, setFakeBalanceInput] = useState('')
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { balance } = useWalletBalance()
  const { profile, fakeBalance, setFakeBalance } = useAdmin()
  const { publicKey } = useWallet()
  const walletPk = publicKey?.toBase58()

  const displayBalance = fakeBalance !== null ? fakeBalance : (balance ?? 0)
  const displayUsd = displayBalance * solPrice

  const allOpen   = positions.filter(p => p.status === 'open')
  const allClosed = positions.filter(p => p.status !== 'open')
  const winners   = allClosed.filter(p => p.totalPnlSol > 0)

  const totalPnlSol    = positions.reduce((s, p) => s + p.totalPnlSol, 0)
  const winRate        = allClosed.length > 0 ? (winners.length / allClosed.length) * 100 : 0
  const capitalAtRisk  = allOpen.reduce((s, p) => s + p.positionSizeSol * (p.remainingPct / 100), 0)

  const pnlColor = totalPnlSol >= 0 ? '#00ff88' : '#ff3355'

  // Long-press on balance area to set fake balance
  function handleBalancePressStart() {
    pressTimer.current = setTimeout(() => {
      setFakeBalanceInput(fakeBalance !== null ? String(fakeBalance) : balance !== null ? balance.toFixed(4) : '')
      setBalanceEditOpen(true)
    }, 500)
  }
  function handleBalancePressEnd() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }
  function commitFakeBalance() {
    const val = parseFloat(fakeBalanceInput)
    setFakeBalance(!isNaN(val) && val > 0 ? val : null)
    setBalanceEditOpen(false)
  }

  const recentTransactions = [...positions]
    .sort((a, b) => {
      const ta = new Date(a.exitTime ?? a.entryTime).getTime()
      const tb = new Date(b.exitTime ?? b.entryTime).getTime()
      return tb - ta
    })
    .slice(0, 25)

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-[#080808]">
      {/* ── Hero section ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0f0820 0%, #090c1a 45%, #070809 100%)' }}
      >
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />

        <div className="relative px-4 pt-4 pb-6">
          {/* Profile row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <button onClick={onProfileOpen} aria-label="Edit profile"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold cursor-pointer transition-all hover:opacity-80 active:scale-95 select-none"
                style={{ background: `${profile.avatarColor}20`, border: `2px solid ${profile.avatarColor}50`, color: profile.avatarColor }}>
                {profile.username.slice(0, 2)}
              </button>
              <div>
                <p className="text-[12px] font-bold text-[#e6e6e6]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {profile.username}
                </p>
                {walletPk && (
                  <p className="text-[9px] font-mono text-[#333]">{walletPk.slice(0, 4)}…{walletPk.slice(-4)}</p>
                )}
              </div>
            </div>
            <button onClick={onClear}
              className="text-[10px] font-mono px-2.5 py-1.5 rounded-xl border border-[#1e1e1e] text-[#333] hover:text-[#666] transition-all cursor-pointer">
              Clear
            </button>
          </div>

          {/* Donut + balance (centered) */}
          <div className="flex flex-col items-center">
            {balanceEditOpen ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-[10px] font-mono text-[#444] uppercase tracking-widest">Set balance</p>
                <input
                  type="number"
                  value={fakeBalanceInput}
                  onChange={e => setFakeBalanceInput(e.target.value)}
                  onBlur={commitFakeBalance}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setBalanceEditOpen(false) }}
                  className="bg-transparent border-b border-[#2a2a2a] text-[32px] font-bold tabular-nums text-[#f0f0f0] outline-none text-center w-48"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                  autoFocus
                />
                <p className="text-[9px] font-mono text-[#2a2a2a]">SOL · press Enter to confirm</p>
              </div>
            ) : (
              <div
                onMouseDown={handleBalancePressStart}
                onMouseUp={handleBalancePressEnd}
                onMouseLeave={handleBalancePressEnd}
                onTouchStart={handleBalancePressStart}
                onTouchEnd={handleBalancePressEnd}
                onContextMenu={e => e.preventDefault()}
              >
                <PortfolioDonut
                  solBalance={displayBalance}
                  usdBalance={displayUsd}
                  winRate={winRate}
                  pnlSol={totalPnlSol}
                  showUsd={showUsd}
                  onToggle={() => setShowUsd(v => !v)}
                />
              </div>
            )}

            {/* Stat chips */}
            <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
              {fakeBalance !== null && (
                <span className="text-[9px] font-mono px-2 py-1 rounded-full"
                  style={{ color: '#00d4ff', background: '#00d4ff0d', border: '1px solid #00d4ff20' }}>
                  {Math.max(0, fakeBalance - capitalAtRisk).toFixed(3)} avail
                </span>
              )}
              {capitalAtRisk > 0 && (
                <span className="text-[9px] font-mono px-2 py-1 rounded-full"
                  style={{ color: '#ffcc00', background: '#ffcc000d', border: '1px solid #ffcc0020' }}>
                  {capitalAtRisk.toFixed(3)} at risk
                </span>
              )}
              {allClosed.length > 0 && (
                <span className="text-[9px] font-mono px-2 py-1 rounded-full"
                  style={{ color: pnlColor, background: `${pnlColor}0d`, border: `1px solid ${pnlColor}20` }}>
                  {winRate.toFixed(0)}% win rate
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-6 mt-6">
            <ActionBtn
              onClick={() => setShowDeposit(true)}
              color="#7c3aed"
              label="Deposit"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v16M5 9l7-7 7 7"/><path d="M5 22h14"/>
                </svg>
              }
            />
            <ActionBtn
              onClick={() => setShowWithdraw(true)}
              color="#ff3355"
              label="Withdraw"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22V6M5 15l7 7 7-7"/><path d="M5 2h14"/>
                </svg>
              }
            />
            <ActionBtn
              onClick={() => {}}
              color="#00d4ff"
              label="Send"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              }
            />
            <ActionBtn
              onClick={() => {}}
              color="#00ff88"
              label="Receive"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
                </svg>
              }
            />
          </div>
        </div>
      </div>

      {/* ── Sub-tab nav ───────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#1a1a1a] bg-[#080808] sticky top-0 z-10">
        {([
          { id: 'overview'  as const, label: 'Overview' },
          { id: 'chart'     as const, label: 'Chart' },
          { id: 'positions' as const, label: `Open${allOpen.length > 0 ? ` (${allOpen.length})` : ''}` },
          { id: 'history'   as const, label: 'History' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className="flex-1 py-3 text-[10px] font-mono tracking-wider transition-all cursor-pointer border-b-2"
            style={{
              color: subTab === t.id ? '#e6e6e6' : '#444',
              borderBottomColor: subTab === t.id ? '#7c3aed' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className="p-4 space-y-4">

        {/* OVERVIEW */}
        {subTab === 'overview' && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Trades',   value: positions.length.toString(),       color: '#e6e6e6' },
                { label: 'Win Rate',       value: allClosed.length > 0 ? `${winRate.toFixed(1)}%` : '—', color: winRate >= 60 ? '#00ff88' : '#ff3355' },
                { label: 'Paper P&L',      value: `${totalPnlSol >= 0 ? '+' : ''}${fmtSol(totalPnlSol)} SOL`, color: pnlColor },
                { label: 'Open',           value: allOpen.length.toString(),          color: allOpen.length > 0 ? '#00d4ff' : '#444' },
              ].map(stat => (
                <div key={stat.label} className="bg-[#111] border border-[#1a1a1a] rounded-2xl px-4 py-3">
                  <p className="text-[9px] font-mono text-[#333] uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-[18px] font-bold tabular-nums" style={{ color: stat.color, fontFamily: "'Inter', sans-serif" }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Allocation donut */}
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
              <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest mb-4">Strategy Allocation</p>
              <AllocationDonut strategies={strategies} stats={stats} />
            </div>

            {/* Recent transactions */}
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest">Recent</p>
                <button onClick={() => setSubTab('history')}
                  className="text-[10px] font-mono text-[#444] hover:text-[#777] transition-colors cursor-pointer">
                  See all →
                </button>
              </div>
              {recentTransactions.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[11px] font-mono text-[#2a2a2a]">No trades yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[#111]">
                  {recentTransactions.slice(0, 6).map(pos => (
                    <TransactionRow key={pos.id} pos={pos}
                      strategy={strategies.find(s => s.id === pos.strategyId)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* CHART */}
        {subTab === 'chart' && (
          <PortfolioChart positions={positions} />
        )}

        {/* OPEN POSITIONS */}
        {subTab === 'positions' && (
          <>
            {allOpen.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
                <p className="text-[#333] font-mono text-sm">No open positions</p>
              </div>
            ) : (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden divide-y divide-[#111]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                  <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest">{allOpen.length} open</p>
                  <p className="text-[10px] font-mono text-[#444]">{capitalAtRisk.toFixed(3)} SOL at risk</p>
                </div>
                {allOpen.map(pos => (
                  <TransactionRow key={pos.id} pos={pos}
                    strategy={strategies.find(s => s.id === pos.strategyId)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* HISTORY */}
        {subTab === 'history' && (
          <>
            {allClosed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <p className="text-[#333] font-mono text-sm">No closed trades yet</p>
              </div>
            ) : (
              <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                  <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest">{allClosed.length} trades</p>
                  <p className="text-[10px] font-mono" style={{ color: pnlColor }}>
                    {totalPnlSol >= 0 ? '+' : ''}{fmtSol(totalPnlSol)} SOL total
                  </p>
                </div>
                <div className="divide-y divide-[#111]">
                  {[...allClosed]
                    .sort((a, b) => new Date(b.exitTime ?? b.entryTime).getTime() - new Date(a.exitTime ?? a.entryTime).getTime())
                    .map(pos => (
                      <TransactionRow key={pos.id} pos={pos}
                        strategy={strategies.find(s => s.id === pos.strategyId)} />
                    ))
                  }
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showDeposit && (
        <DepositModal walletPk={walletPk} onClose={() => setShowDeposit(false)} />
      )}
      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          solBalance={displayBalance}
          solPrice={solPrice}
        />
      )}
    </div>
  )
}
