import { useMemo } from 'react'
import type { Position } from '../../types/backtest'
import { detectNarratives } from '../../lib/narrativeEngine'

interface Props { positions: Position[] }

interface GroupStat {
  label: string
  count: number
  wins: number
  winRate: number
  avgPnlPct: number
  dimension: string
}

function groupBy(items: Array<{ label: string; won: boolean; pnlPct: number }>) {
  const map = new Map<string, { won: number; pnl: number; count: number }>()
  for (const item of items) {
    const g = map.get(item.label) ?? { won: 0, pnl: 0, count: 0 }
    g.count++
    if (item.won) g.won++
    g.pnl += item.pnlPct
    map.set(item.label, g)
  }
  const out: Omit<GroupStat, 'dimension'>[] = []
  for (const [label, g] of map) {
    if (g.count < 2) continue
    const winRate = (g.won / g.count) * 100
    out.push({ label, count: g.count, wins: g.won, winRate, avgPnlPct: g.pnl / g.count })
  }
  return out.sort((a, b) => b.avgPnlPct - a.avgPnlPct)
}

function GroupTable({ rows, title }: { rows: Omit<GroupStat, 'dimension'>[]; title: string }) {
  if (rows.length === 0)
    return (
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono text-[#444] uppercase tracking-wider mb-2">{title}</div>
        <div className="text-[10px] font-mono text-[#333] italic">No data</div>
      </div>
    )
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-mono text-[#444] uppercase tracking-wider mb-2">{title}</div>
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="text-[#333]">
            <th className="text-left pb-1 font-normal">Label</th>
            <th className="text-right pb-1 font-normal">n</th>
            <th className="text-right pb-1 font-normal">Win%</th>
            <th className="text-right pb-1 font-normal">Avg PnL</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map(r => (
            <tr key={r.label} className="border-t border-[#1a1a1a]">
              <td className="py-0.5 text-[#888] truncate max-w-[80px]">{r.label}</td>
              <td className="py-0.5 text-right text-[#555]">{r.count}</td>
              <td className="py-0.5 text-right text-[#aaa]">{r.winRate.toFixed(0)}%</td>
              <td className="py-0.5 text-right font-bold" style={{ color: r.avgPnlPct >= 0 ? '#00ff88' : '#ff3355' }}>
                {r.avgPnlPct >= 0 ? '+' : ''}{r.avgPnlPct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PatternIntelPanel({ positions }: Props) {
  const analysis = useMemo(() => {
    const closed = positions.filter(p => p.status !== 'open')
    if (closed.length < 3) return null

    const rows = closed.map(p => {
      const won = p.status === 'closed_tp'
      const pnlPct = p.positionSizeSol > 0 ? (p.totalPnlSol / p.positionSizeSol) * 100 : 0
      const narratives = detectNarratives(p.tokenName, p.tokenSymbol)
      const narrative = narratives[0] ?? 'OTHER'
      const scoreGroup = p.scannerScore >= 70 ? 'SAFE (70+)' : p.scannerScore >= 40 ? 'WATCH (40-70)' : 'RISK (<40)'
      const mcapGroup = p.entryMcap < 50_000 ? '<$50K' : p.entryMcap < 200_000 ? '$50K-200K' : p.entryMcap < 1_000_000 ? '$200K-1M' : '>$1M'
      const sourceGroup = p.source
      return { won, pnlPct, narrative, scoreGroup, mcapGroup, sourceGroup }
    })

    const byNarrative = groupBy(rows.map(r => ({ label: r.narrative, won: r.won, pnlPct: r.pnlPct })))
    const byScore = groupBy(rows.map(r => ({ label: r.scoreGroup, won: r.won, pnlPct: r.pnlPct })))
    const byMcap = groupBy(rows.map(r => ({ label: r.mcapGroup, won: r.won, pnlPct: r.pnlPct })))
    const bySource = groupBy(rows.map(r => ({ label: r.sourceGroup, won: r.won, pnlPct: r.pnlPct })))

    const allGroups: GroupStat[] = [
      ...byNarrative.map(g => ({ ...g, dimension: 'Narrative' })),
      ...byScore.map(g => ({ ...g, dimension: 'Score' })),
      ...byMcap.map(g => ({ ...g, dimension: 'Entry MCap' })),
      ...bySource.map(g => ({ ...g, dimension: 'Source' })),
    ]

    const topSignals = allGroups
      .filter(g => g.winRate >= 40)
      .sort((a, b) => b.avgPnlPct - a.avgPnlPct)
      .slice(0, 3)

    return { byNarrative, byScore, byMcap, topSignals, total: closed.length }
  }, [positions])

  if (!analysis) {
    return (
      <div className="bg-[#141414] rounded-xl border border-[#222222] p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-sm text-[#e6e6e6]">PATTERN INTEL</h2>
        </div>
        <p className="text-[11px] font-mono text-[#444] italic">
          Not enough data yet — positions will be analyzed after they close
        </p>
      </div>
    )
  }

  const { byNarrative, byScore, byMcap, topSignals, total } = analysis

  return (
    <div className="bg-[#141414] rounded-xl border border-[#222222] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-sm text-[#e6e6e6]">PATTERN INTEL</h2>
        <span className="text-[10px] font-mono text-[#444]">{topSignals.length} signal insights · {total} closed</span>
      </div>
      <p className="text-[10px] font-mono text-[#555] -mt-2">Patterns found in your closed positions</p>

      <div className="flex gap-6 border-t border-[#1e1e1e] pt-4">
        <GroupTable rows={byNarrative} title="By Narrative" />
        <div className="w-px bg-[#1e1e1e] shrink-0" />
        <GroupTable rows={byScore} title="By Score" />
        <div className="w-px bg-[#1e1e1e] shrink-0" />
        <GroupTable rows={byMcap} title="By Entry MCap" />
      </div>

      {topSignals.length > 0 && (
        <div className="border-t border-[#1e1e1e] pt-4">
          <div className="text-[10px] font-mono text-[#444] uppercase tracking-wider mb-2">Top Signals</div>
          <div className="flex gap-3 flex-wrap">
            {topSignals.map(s => (
              <div key={s.label + s.dimension}
                className="flex-1 min-w-[180px] bg-[#0d1a14] border border-[#1a3327] rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#00d4ff] text-[11px]">⚡</span>
                  <span className="text-[11px] font-mono font-bold text-[#e6e6e6]">{s.label}</span>
                  <span className="text-[9px] font-mono text-[#444] ml-auto">{s.dimension}</span>
                </div>
                <div className="text-[10px] font-mono text-[#888]">
                  {s.winRate.toFixed(0)}% win · avg{' '}
                  <span style={{ color: s.avgPnlPct >= 0 ? '#00ff88' : '#ff3355' }} className="font-bold">
                    {s.avgPnlPct >= 0 ? '+' : ''}{s.avgPnlPct.toFixed(1)}%
                  </span>
                  {' '}· {s.count} trades
                </div>
                <div className="text-[9px] font-mono text-[#444]">Consider filtering for: {s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
