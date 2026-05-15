import { useState, useRef, useEffect } from 'react'
import type { Strategy, StrategyStats } from '../../types/backtest'

interface Props {
  strategy: Strategy
  stats: StrategyStats
  onToggle: (id: string) => void
  onEdit: (id: string) => void
  onToggleAutoTrade: (id: string) => void
  onUpdateSize: (id: string, size: number) => void
}

// ── Mini sparkline SVG from equity curve ─────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[10px] font-mono text-[#2a2a2a]">no data yet</span>
      </div>
    )
  }

  const W = 200
  const H = 36
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polyline = pts.join(' ')
  const lastPt = pts[pts.length - 1]!.split(',')
  const isPositive = data[data.length - 1]! >= data[0]!

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
      {/* Zero line */}
      {min < 0 && max > 0 && (
        <line
          x1={0} x2={W}
          y1={H - ((0 - min) / range) * H}
          y2={H - ((0 - min) / range) * H}
          stroke="#333333" strokeWidth="0.5" strokeDasharray="2,2"
        />
      )}
      {/* Area fill */}
      <polygon
        points={`0,${H} ${polyline} ${W},${H}`}
        fill={color}
        opacity="0.06"
      />
      {/* Line */}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.2" opacity="0.7" />
      {/* Last dot */}
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2" fill={isPositive ? color : '#ff3355'} />
    </svg>
  )
}

// ── Win rate bar ─────────────────────────────────────────────────────────────
function WinRateBar({ rate, wins, losses }: { rate: number; wins: number; losses: number }) {
  const color = rate >= 60 ? '#00ff88' : rate >= 40 ? '#ffcc00' : '#ff3355'
  const total = wins + losses
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] font-mono text-[#444444]">Win Rate</span>
        <span className="text-[10px] font-mono tabular-nums" style={{ color: total > 0 ? color : '#333333' }}>
          {total > 0 ? `${rate.toFixed(0)}%` : '—'}
          {total > 0 && <span className="text-[#333333] ml-1">({wins}W / {losses}L)</span>}
        </span>
      </div>
      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        {total > 0 && (
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rate}%`, background: color, opacity: 0.7 }} />
        )}
      </div>
    </div>
  )
}

export function StrategyCard({ strategy, stats, onToggle, onEdit, onToggleAutoTrade, onUpdateSize }: Props) {
  const pnlColor = stats.totalPnlSol >= 0 ? '#00ff88' : '#ff3355'
  const [editingSize, setEditingSize] = useState(false)
  const [sizeInput, setSizeInput] = useState(strategy.positionSizeSol.toFixed(2))
  const sizeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingSize) sizeRef.current?.select()
  }, [editingSize])

  function commitSize() {
    const v = parseFloat(sizeInput)
    if (!isNaN(v) && v > 0) onUpdateSize(strategy.id, v)
    else setSizeInput(strategy.positionSizeSol.toFixed(2))
    setEditingSize(false)
  }
  const isAnakin = strategy.id === 'anakin'
  const hasData = stats.totalTrades > 0
  const activeProtocols = Object.entries(strategy.filters.protocols).filter(([, v]) => v).map(([k]) => k)

  const tpTags = strategy.exit.takeProfitLevels.map((tp, i) =>
    `TP${i + 1}:${tp.type === 'percent' ? `+${tp.value}%` : `$${(tp.value / 1000).toFixed(0)}K`}`
  )
  const slTag = strategy.exit.stopLossPct !== null ? `SL:${strategy.exit.stopLossPct}%` : null

  return (
    <div
      className="bg-[#111111] rounded-xl border transition-all relative overflow-hidden flex flex-col"
      style={{ borderColor: strategy.enabled ? strategy.color + '40' : '#1e1e1e' }}
    >
      {/* Anakin glow */}
      {isAnakin && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top left, #ffd70010 0%, transparent 55%)' }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#161616]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: strategy.color,
            boxShadow: strategy.enabled ? `0 0 6px ${strategy.color}80` : 'none' }} />
          <span className="font-display font-bold text-[13px] truncate" style={{ color: strategy.enabled ? strategy.color : '#555555' }}>
            {strategy.name}
          </span>
          {strategy.locked && (
            <span className="text-[9px] font-mono px-1 py-0.5 rounded shrink-0 uppercase tracking-wider"
              style={{ color: strategy.color + 'aa', background: strategy.color + '10', border: `1px solid ${strategy.color}20` }}>
              preset
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* PAPER / LIVE badge */}
          {strategy.autoTrade ? (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
              style={{ color: '#00ff88', borderColor: '#00ff8840', background: '#00ff8810', boxShadow: '0 0 4px #00ff8830' }}>
              LIVE
            </span>
          ) : (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
              style={{ color: '#666666', borderColor: '#2a2a2a', background: '#1a1a1a' }}>
              PAPER
            </span>
          )}
          {!strategy.locked && (
            <button onClick={() => onEdit(strategy.id)}
              className="min-h-[32px] px-2 text-[10px] font-mono rounded border border-[#1e1e1e] text-[#555555] hover:text-[#888888] hover:border-[#2a2a2a] transition-all cursor-pointer">
              Edit
            </button>
          )}
          <button onClick={() => onToggle(strategy.id)}
            className={`min-h-[32px] px-2.5 text-[10px] font-mono rounded border transition-all cursor-pointer font-bold ${
              strategy.enabled ? 'border-[#00ff8835] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#444444] hover:text-[#666666]'
            }`}>
            {strategy.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Description */}
      {strategy.description && (
        <p className="px-4 pt-2.5 text-[10px] font-mono text-[#555555] leading-relaxed">{strategy.description}</p>
      )}

      {/* Equity sparkline */}
      <div className="px-4 pt-3 pb-1 h-12">
        <Sparkline data={hasData ? stats.equityCurve.map(p => p.value) : []} color={pnlColor} />
      </div>

      {/* PnL headline */}
      <div className="px-4 pb-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-mono text-[#444444] mb-0.5">Total P&L</p>
          <p className="text-[18px] font-mono font-bold tabular-nums leading-none" style={{ color: hasData ? pnlColor : '#333333' }}>
            {hasData ? `${stats.totalPnlSol >= 0 ? '+' : ''}${stats.totalPnlSol.toFixed(3)}` : '—'}
            {hasData && <span className="text-[11px] ml-1 opacity-60">SOL</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-[#444444] mb-0.5">Trades</p>
          <p className="text-[16px] font-mono font-bold tabular-nums text-[#e6e6e6] leading-none">
            {stats.totalTrades}
            {stats.openTrades > 0 && (
              <span className="text-[11px] ml-1 font-normal" style={{ color: '#00d4ff' }}>
                {stats.openTrades} open
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Win rate bar */}
      <div className="px-4 pb-3">
        <WinRateBar rate={stats.winRate} wins={stats.wins} losses={stats.losses} />
      </div>

      {/* Best / Worst row */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <div className="bg-[#0d0d0d] rounded-lg p-2">
          <p className="text-[10px] font-mono text-[#444444] mb-0.5">Best trade</p>
          <p className="text-[12px] font-mono font-bold tabular-nums" style={{ color: stats.best > 0 ? '#00ff88' : '#333333' }}>
            {stats.best > 0 ? `+${stats.best.toFixed(0)}%` : '—'}
          </p>
        </div>
        <button
          onClick={() => { setSizeInput(strategy.positionSizeSol.toFixed(2)); setEditingSize(true) }}
          className="bg-[#0d0d0d] rounded-lg p-2 text-left w-full hover:bg-[#141414] transition-colors cursor-pointer border border-transparent hover:border-[#00d4ff20] group"
        >
          <p className="text-[10px] font-mono text-[#444444] mb-0.5 flex items-center gap-1">
            Size / trade
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" className="group-hover:stroke-[#00d4ff] transition-colors">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </p>
          {editingSize ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input
                ref={sizeRef}
                type="number" step="0.01" min="0.001" max="100"
                value={sizeInput}
                onChange={e => setSizeInput(e.target.value)}
                onBlur={commitSize}
                onKeyDown={e => { if (e.key === 'Enter') commitSize(); if (e.key === 'Escape') { setEditingSize(false) } }}
                className="w-16 bg-[#1a1a1a] border border-[#00d4ff40] rounded px-1 py-0.5 text-[11px] font-mono text-[#e6e6e6] outline-none"
              />
              <span className="text-[10px] font-mono text-[#555]">SOL</span>
            </div>
          ) : (
            <p className="text-[12px] font-mono font-bold tabular-nums text-[#e6e6e6]">
              {strategy.positionSizeSol.toFixed(2)} SOL
            </p>
          )}
        </button>
      </div>

      {/* Filter / exit tags */}
      <div className="px-4 pb-3 flex flex-wrap gap-1">
        {activeProtocols.slice(0, 2).map(p => (
          <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#666666] border border-[#222]">{p}</span>
        ))}
        {tpTags.map((t, i) => (
          <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#00ff8808] text-[#00ff8888] border border-[#00ff8818]">{t}</span>
        ))}
        {slTag && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#ff335508] text-[#ff335588] border border-[#ff335518]">{slTag}</span>
        )}
      </div>

      {/* Auto-trade toggle */}
      <div className="px-4 pb-4 mt-auto">
        <button
          onClick={() => onToggleAutoTrade(strategy.id)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
            strategy.autoTrade
              ? 'border-[#ffd70040] bg-[#ffd70008]'
              : 'border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#2a2a2a]'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={strategy.autoTrade ? '#ffd700' : '#444444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="text-[11px] font-mono font-bold" style={{ color: strategy.autoTrade ? '#ffd700' : '#555555' }}>
              Auto-Trade
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={strategy.autoTrade
                ? { color: '#ffd700', background: '#ffd70015', border: '1px solid #ffd70025' }
                : { color: '#333333', border: '1px solid #222' }
              }>
              {strategy.autoTrade ? 'PAPER MODE' : 'DISABLED'}
            </span>
          </div>
          {/* Toggle switch */}
          <div className={`w-9 h-5 rounded-full border relative transition-all ${
            strategy.autoTrade ? 'bg-[#ffd700] border-[#ffd70060]' : 'bg-[#1a1a1a] border-[#252525]'
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
              strategy.autoTrade ? 'left-[18px] bg-[#080808]' : 'left-0.5 bg-[#444444]'
            }`} />
          </div>
        </button>
        {strategy.autoTrade && (
          <p className="text-[9px] font-mono text-[#555555] mt-1.5 text-center">
            Simulating entries at live prices · no real transactions sent
          </p>
        )}
      </div>
    </div>
  )
}
