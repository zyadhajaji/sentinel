import type { Position } from '../../types/backtest'
import type { Strategy } from '../../types/backtest'

interface Props {
  positions: Position[]
  strategies: Strategy[]
  filter: 'all' | 'open' | 'closed'
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open:           { label: 'OPEN',    color: '#00d4ff' },
  closed_tp:      { label: 'TP ✓',   color: '#00ff88' },
  closed_sl:      { label: 'SL ✗',   color: '#ff3355' },
  closed_timeout: { label: 'TIMEOUT', color: '#ffcc00' },
  closed_rug:     { label: 'RUG',     color: '#ff3355' },
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

export function PositionTable({ positions, strategies, filter }: Props) {
  const strategyColorMap = Object.fromEntries(strategies.map(s => [s.id, s.color]))

  const filtered = positions.filter(p => {
    if (filter === 'open') return p.status === 'open'
    if (filter === 'closed') return p.status !== 'open'
    return true
  }).slice(0, 100)

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-2">
        <span className="text-[#333333] font-mono text-sm">No positions yet</span>
        <span className="text-[#2a2a2a] font-mono text-[11px]">Strategies will enter on qualifying signals</span>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1 table-scroll">
      <table className="w-full text-[11px] font-mono min-w-[500px]">
        <thead>
          <tr className="text-[#444444] uppercase tracking-wider border-b border-[#1e1e1e]">
            <th className="text-left pb-2 pr-3 pl-1">Token</th>
            <th className="text-left pb-2 pr-3 hidden sm:table-cell">Strategy</th>
            <th className="text-right pb-2 pr-3 hidden sm:table-cell">Entry</th>
            <th className="text-right pb-2 pr-3">PnL %</th>
            <th className="text-right pb-2 pr-3">PnL SOL</th>
            <th className="text-left pb-2 pr-3">Status</th>
            <th className="text-right pb-2 pr-1">Age</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(pos => {
            const statusInfo = STATUS_LABELS[pos.status] ?? { label: pos.status, color: '#888888' }
            const displayPnlPct = pos.status === 'open' ? pos.unrealizedPnlPct : ((pos.totalPnlSol / pos.positionSizeSol) * 100)
            const pnlColor = displayPnlPct >= 0 ? '#00ff88' : '#ff3355'
            const stratColor = strategyColorMap[pos.strategyId] ?? '#888888'
            return (
              <tr key={pos.id} className="border-b border-[#111111] hover:bg-[#111111] transition-colors">
                <td className="py-2.5 pr-3 pl-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#e6e6e6] font-bold">{pos.tokenSymbol}</span>
                    {pos.dexUrl && (
                      <a href={pos.dexUrl} target="_blank" rel="noopener noreferrer"
                         className="text-[#333333] hover:text-[#666666] transition-colors min-h-[36px] flex items-center">↗</a>
                    )}
                  </div>
                  {/* Strategy shown inline on mobile */}
                  <div className="sm:hidden text-[10px] mt-0.5" style={{ color: stratColor }}>{pos.strategyName}</div>
                </td>
                <td className="py-2.5 pr-3 hidden sm:table-cell">
                  <span style={{ color: stratColor }}>{pos.strategyName}</span>
                </td>
                <td className="py-2.5 pr-3 text-right text-[#555555] hidden sm:table-cell">
                  ${pos.entryPrice < 0.0001 ? pos.entryPrice.toExponential(2) : pos.entryPrice.toFixed(6)}
                </td>
                <td className="py-2.5 pr-3 text-right font-bold" style={{ color: pnlColor }}>
                  {displayPnlPct >= 0 ? '+' : ''}{displayPnlPct.toFixed(1)}%
                </td>
                <td className="py-2.5 pr-3 text-right" style={{ color: pnlColor }}>
                  {pos.totalPnlSol >= 0 ? '+' : ''}{pos.totalPnlSol.toFixed(4)}
                </td>
                <td className="py-2.5 pr-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ color: statusInfo.color, background: statusInfo.color + '15' }}>
                    {statusInfo.label}
                  </span>
                </td>
                <td className="py-2.5 pr-1 text-right text-[#444444]">
                  {timeAgo(pos.entryTime)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
