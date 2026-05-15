import { useState, useRef, useEffect } from 'react'
import type { Signal } from '../../types'
import type { Strategy, StrategyStats, Position } from '../../types/backtest'
import type { BotActivity } from '../../hooks/useBacktest'
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
  botActivity: BotActivity
  watchedCAs: string[]
  onAddWatchedCA: (ca: string) => void
  onRemoveWatchedCA: (ca: string) => void
  onSaveStrategy: (s: Strategy) => void
  onAddStrategy: (s: Strategy) => void
  onDeleteStrategy: (id: string) => void
  onToggleAutoTrade: (id: string) => void
  onUpdateSize: (id: string, size: number) => void
  onClear: () => void
}

type TableFilter = 'all' | 'open' | 'closed'

const EMPTY_STATS = (id: string): StrategyStats => ({
  strategyId: id, totalTrades: 0, openTrades: 0,
  wins: 0, losses: 0, winRate: 0, totalPnlSol: 0,
  avgWinPct: 0, avgLossPct: 0, best: 0, worst: 0, equityCurve: [],
})

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function BotStatusBar({ botActivity, openCount, totalPnl, totalTrades, positions }: {
  botActivity: BotActivity; openCount: number; totalPnl: number; totalTrades: number; positions: Position[]
}) {
  const pnlColor = totalPnl >= 0 ? '#00ff88' : '#ff3355'

  // Live "last scan Xs ago" counter
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const lastScanLabel = botActivity.lastTickTime == null
    ? 'scanning...'
    : `last scan ${timeAgo(botActivity.lastTickTime)}`

  // Win Rate & Best across all closed positions
  const closedPositions = positions.filter(p => p.status !== 'open')
  const wins = closedPositions.filter(p => p.totalPnlSol > 0).length
  const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : null
  const bestPnl = closedPositions.length > 0 ? Math.max(...closedPositions.map(p => p.totalPnlSol)) : null

  return (
    <div className="shrink-0 bg-[#0a0a0a] border-b border-[#1a1a1a]">
      {/* ANAKIN ONLINE row */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#141414]">
        <div className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: '#ffd700', animation: 'pulse 2s ease-in-out infinite', boxShadow: '0 0 6px #ffd70080' }} />
        <span className="text-[#ffd700] font-bold font-mono text-[11px] tracking-widest">ANAKIN</span>
        <span className="text-[#00ff88] font-mono text-[11px] font-bold tracking-wider">ONLINE</span>
        <span className="text-[#555555] font-mono text-[11px]">· 24/7 SCANNING</span>
        <span className="text-[#444444] font-mono text-[11px] ml-1">{lastScanLabel}</span>
      </div>
      {/* Stats strip */}
      <div className="flex items-center gap-0 divide-x divide-[#1a1a1a] text-[11px] font-mono overflow-x-auto">
        {/* Bot status */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] shrink-0"
            style={{ animation: 'pulse 2s ease-in-out infinite', boxShadow: '0 0 6px #00d4ff80' }} />
          <span className="text-[#00d4ff] font-bold tracking-wider">BOT</span>
          <span className="text-[#444444]">ACTIVE</span>
        </div>
        {/* Session trades */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <span className="text-[#555555]">Session</span>
          <span className="text-[#e6e6e6] font-bold">{botActivity.totalTrades}</span>
          <span className="text-[#444444]">trades</span>
        </div>
        {/* Open positions */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <span className="text-[#555555]">Open</span>
          <span className="font-bold tabular-nums" style={{ color: openCount > 0 ? '#00d4ff' : '#444444' }}>{openCount}</span>
        </div>
        {/* Total PnL */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <span className="text-[#555555]">P&L</span>
          <span className="font-bold tabular-nums" style={{ color: totalTrades > 0 ? pnlColor : '#444444' }}>
            {totalTrades > 0 ? `${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(3)} SOL` : '—'}
          </span>
        </div>
        {/* Last trade */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <span className="text-[#555555]">Last trade</span>
          <span className="text-[#888888]">{timeAgo(botActivity.lastTradeTime)}</span>
        </div>
        {/* Win Rate */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <span className="text-[#555555]">Win Rate</span>
          <span className="font-bold tabular-nums" style={{ color: winRate == null ? '#444444' : winRate >= 50 ? '#00ff88' : '#ff3355' }}>
            {winRate == null ? '—' : `${winRate.toFixed(0)}%`}
          </span>
        </div>
        {/* Best */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <span className="text-[#555555]">Best</span>
          <span className="font-bold tabular-nums" style={{ color: bestPnl == null || bestPnl <= 0 ? '#444444' : '#00ff88' }}>
            {bestPnl == null ? '—' : `${bestPnl >= 0 ? '+' : ''}${bestPnl.toFixed(3)} SOL`}
          </span>
        </div>
        {/* Price tick */}
        <div className="flex items-center gap-1.5 px-4 py-3 ml-auto shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="text-[#555555]">Price tick</span>
          <span className="text-[#444444]">{timeAgo(botActivity.lastTickTime)}</span>
        </div>
      </div>
    </div>
  )
}

function WatchedTokenRow({ ca, onRemove }: { ca: string; onRemove: () => void }) {
  const short = ca.slice(0, 6) + '…' + ca.slice(-4)
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#141414] border border-[#1e1e1e]">
      <span className="text-[10px] font-mono text-[#888888]">{short}</span>
      <button
        onClick={onRemove}
        className="text-[#444444] hover:text-[#ff3355] transition-colors ml-auto min-h-[28px] min-w-[28px] flex items-center justify-center cursor-pointer"
        aria-label="Remove"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

export function BacktestPage({
  signals, strategies, positions, stats, botActivity,
  watchedCAs, onAddWatchedCA, onRemoveWatchedCA,
  onSaveStrategy, onAddStrategy, onDeleteStrategy, onToggleAutoTrade, onUpdateSize, onClear,
}: Props) {
  const [tableFilter, setTableFilter] = useState<TableFilter>('all')
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [caInput, setCaInput] = useState('')
  const [caError, setCaError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const totalPnl = strategies.reduce((sum, s) => sum + (stats[s.id]?.totalPnlSol ?? 0), 0)
  const totalTrades = strategies.reduce((sum, s) => sum + (stats[s.id]?.totalTrades ?? 0), 0)
  const openCount = positions.filter(p => p.status === 'open').length

  function handleAddCA() {
    const ca = caInput.trim()
    if (ca.length < 32 || ca.length > 44) {
      setCaError('Enter a valid Solana token address (32–44 chars)')
      return
    }
    onAddWatchedCA(ca)
    setCaInput('')
    setCaError('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BotStatusBar botActivity={botActivity} openCount={openCount} totalPnl={totalPnl} totalTrades={totalTrades} positions={positions} />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Page header */}
        <div className="px-4 pt-4 pb-3 border-b border-[#1a1a1a] shrink-0 bg-[#080808]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display font-bold text-[15px] text-[#e6e6e6]">Bot Strategies</h1>
              <p className="text-[11px] text-[#444444] font-mono mt-0.5">
                {signals.length} live signals · {strategies.filter(s => s.enabled).length} active strategies
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditing(makeNewStrategy()); setIsNew(true) }}
                className="min-h-[44px] px-3 text-[11px] font-mono rounded border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] active:bg-[#00d4ff25] transition-all cursor-pointer"
              >
                + Strategy
              </button>
              <button
                onClick={onClear}
                className="min-h-[44px] px-3 text-[11px] font-mono rounded border border-[#1e1e1e] text-[#444444] hover:text-[#888888] active:bg-[#141414] transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Enable strategies banner */}
          {strategies.some(s => !s.enabled) && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#141414] border border-[#1e1e1e]">
              <div>
                <p className="text-[11px] font-mono text-[#888888]">
                  {strategies.filter(s => !s.enabled).length} strategies are <span className="text-[#ffcc00]">disabled</span>
                </p>
                <p className="text-[10px] font-mono text-[#444444] mt-0.5">
                  Enable them individually below, or tap ⚡ logo 5× to open Admin Panel → Enable All
                </p>
              </div>
              <button
                onClick={() => strategies.filter(s => !s.enabled).forEach(s => onSaveStrategy({ ...s, enabled: true }))}
                className="ml-4 shrink-0 min-h-[36px] px-3 text-[11px] font-mono rounded-xl border border-[#00ff8830] text-[#00ff88] bg-[#00ff8808] hover:bg-[#00ff8818] transition-all cursor-pointer"
              >
                ▶ Enable All
              </button>
            </div>
          )}

          {/* Strategy grid */}
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
                onToggleAutoTrade={onToggleAutoTrade}
                onUpdateSize={onUpdateSize}
              />
            ))}
          </div>

          {/* Custom Token Watcher */}
          <div className="bg-[#111111] rounded-xl border border-[#1e1e1e] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span className="text-[11px] font-mono text-[#888888] uppercase tracking-wider">Watch Custom Token</span>
                {watchedCAs.length > 0 && (
                  <span className="text-[10px] font-mono text-[#00d4ff] bg-[#00d4ff15] px-1.5 py-0.5 rounded">
                    {watchedCAs.length}
                  </span>
                )}
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-[10px] font-mono text-[#555555]">
                Add any Solana token CA — bot will monitor it every 60s and apply your enabled strategies.
              </p>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={caInput}
                  onChange={e => { setCaInput(e.target.value); setCaError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleAddCA()}
                  placeholder="Token contract address (e.g. So1ana...)"
                  className="flex-1 bg-[#0d0d0d] border border-[#1e1e1e] rounded px-3 py-2 text-[11px] font-mono text-[#e6e6e6] placeholder-[#333333] outline-none focus:border-[#00d4ff40] transition-colors min-h-[44px]"
                />
                <button
                  onClick={handleAddCA}
                  className="min-h-[44px] px-4 text-[11px] font-mono rounded border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] active:bg-[#00d4ff25] transition-all shrink-0 cursor-pointer"
                >
                  Watch
                </button>
              </div>
              {caError && (
                <p className="text-[10px] font-mono text-[#ff3355]">{caError}</p>
              )}
              {watchedCAs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {watchedCAs.map(ca => (
                    <WatchedTokenRow key={ca} ca={ca} onRemove={() => onRemoveWatchedCA(ca)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <PatternIntelPanel positions={positions} />

          {/* Positions table */}
          <div className="bg-[#111111] rounded-xl border border-[#1e1e1e] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-[13px] text-[#e6e6e6]">Positions</h2>
              <div className="flex gap-1">
                {(['all', 'open', 'closed'] as TableFilter[]).map(f => (
                  <button key={f} onClick={() => setTableFilter(f)}
                    className={`text-[11px] font-mono px-2.5 py-1.5 min-h-[36px] rounded border transition-all cursor-pointer ${
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
