import { useState, useMemo } from 'react'
import type { Position } from '../../types/backtest'

interface Props {
  positions: Position[]
  solPrice: number
}

type View = '7D' | '30D' | '3M'

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDate(iso: string): Date {
  return new Date(iso)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
}

function formatMonthDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pnlColor(pnl: number, strong = false): string {
  if (pnl > 0) return strong ? '#00ff88' : '#00ff8899'
  if (pnl < 0) return strong ? '#ff3355' : '#ff335599'
  return '#555555'
}

function pnlBg(pnl: number, intensity: number): string {
  const capped = Math.min(intensity, 1)
  const alpha = Math.round(capped * 80)
    .toString(16)
    .padStart(2, '0')
  if (pnl > 0) return `#00ff88${alpha}`
  if (pnl < 0) return `#ff3355${alpha}`
  return 'transparent'
}

function getStatusChip(status: Position['status']): string {
  switch (status) {
    case 'closed_tp': return 'TP'
    case 'closed_sl': return 'SL'
    case 'closed_timeout': return 'TO'
    case 'closed_rug': return 'RUG'
    default: return 'OPEN'
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <p className="text-[12px] font-mono text-[#444444] max-w-[280px]">
        No trades recorded yet — activate a bot strategy to start tracking.
      </p>
    </div>
  )
}

interface TradeRowProps {
  pos: Position
  solPrice: number
}

function TradeRow({ pos, solPrice }: TradeRowProps) {
  const pnl = pos.totalPnlSol
  const usd = pnl * solPrice
  const chip = getStatusChip(pos.status)
  const chipColor =
    pos.status === 'closed_tp' ? '#00ff88' :
    pos.status === 'closed_sl' ? '#ff3355' :
    pos.status === 'closed_rug' ? '#ff3355' :
    pos.status === 'closed_timeout' ? '#888888' :
    '#00d4ff'

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#111111] hover:bg-[#111111] transition-colors">
      <span
        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
        style={{ color: chipColor, background: `${chipColor}18`, border: `1px solid ${chipColor}40` }}
      >
        {chip}
      </span>
      <span className="text-[11px] font-mono text-[#e6e6e6] font-bold truncate flex-1">{pos.tokenSymbol}</span>
      <span className="text-[10px] font-mono text-[#555555] truncate hidden sm:block">{pos.strategyName}</span>
      <span
        className="text-[11px] font-mono font-bold shrink-0"
        style={{ color: pnlColor(pnl, true) }}
      >
        {pnl >= 0 ? '+' : ''}{pnl.toFixed(3)} SOL
      </span>
      <span
        className="text-[10px] font-mono shrink-0 hidden sm:block"
        style={{ color: pnlColor(usd, false) }}
      >
        ({usd >= 0 ? '+' : ''}${Math.abs(usd).toFixed(2)})
      </span>
    </div>
  )
}

// ── 7D Hourly view ─────────────────────────────────────────────────────────────

interface HourCell {
  positions: Position[]
  netPnl: number
}

interface SevenDayViewProps {
  positions: Position[]
  solPrice: number
}

function SevenDayView({ positions, solPrice }: SevenDayViewProps) {
  const [selected, setSelected] = useState<{ day: number; hour: number } | null>(null)

  const now = useMemo(() => new Date(), [])
  // Last 7 days: day[0] = 6 days ago, day[6] = today
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      return startOfDay(d)
    })
  }, [now])

  // Build grid: grid[dayIdx][hour] = HourCell
  const grid = useMemo(() => {
    const g: HourCell[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ positions: [], netPnl: 0 }))
    )
    const closedPositions = positions.filter(p => p.exitTime !== null)
    closedPositions.forEach(pos => {
      const exitDate = parseDate(pos.exitTime!)
      const exitDay = startOfDay(exitDate)
      const dayIdx = days.findIndex(d => d.getTime() === exitDay.getTime())
      if (dayIdx === -1) return
      const hour = exitDate.getHours()
      g[dayIdx][hour].positions.push(pos)
      g[dayIdx][hour].netPnl += pos.totalPnlSol
    })
    return g
  }, [positions, days])

  // Max absolute PnL for intensity scaling
  const maxPnl = useMemo(() => {
    let max = 0
    grid.forEach(day => day.forEach(cell => {
      if (Math.abs(cell.netPnl) > max) max = Math.abs(cell.netPnl)
    }))
    return max || 1
  }, [grid])

  const selectedCell = selected !== null ? grid[selected.day][selected.hour] : null

  // On mobile show last 3 days only (days[4..6])
  const visibleDays = days // CSS handles hiding

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Hour labels */}
        <div className="flex flex-col shrink-0 w-7 pt-6">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="flex-1 flex items-center justify-end pr-1"
              style={{ minHeight: 0 }}
            >
              {h % 6 === 0 && (
                <span className="text-[9px] font-mono text-[#444444] leading-none">
                  {String(h).padStart(2, '0')}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 overflow-x-auto overflow-y-hidden min-w-0">
          <div className="flex flex-1 min-w-[280px]">
            {visibleDays.map((day, dayIdx) => (
              <div
                key={dayIdx}
                className={`flex flex-col flex-1 min-w-0 ${dayIdx < 4 ? 'hidden sm:flex' : 'flex'}`}
              >
                {/* Day header */}
                <div className="h-6 flex items-center justify-center border-b border-[#1a1a1a] shrink-0">
                  <span className="text-[10px] font-mono text-[#555555] truncate px-1">
                    {formatDayLabel(day)}
                  </span>
                </div>

                {/* Hour cells */}
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = grid[dayIdx][hour]
                  const hasData = cell.positions.length > 0
                  const intensity = hasData ? Math.abs(cell.netPnl) / maxPnl : 0
                  const isSelected = selected?.day === dayIdx && selected?.hour === hour

                  return (
                    <button
                      key={hour}
                      onClick={() => {
                        if (!hasData) return
                        setSelected(isSelected ? null : { day: dayIdx, hour })
                      }}
                      className="flex-1 border border-[#111111] transition-all relative min-h-0"
                      style={{
                        background: hasData ? pnlBg(cell.netPnl, intensity) : 'transparent',
                        outline: isSelected ? '1px solid #00d4ff' : undefined,
                        cursor: hasData ? 'pointer' : 'default',
                      }}
                      title={hasData ? `${cell.positions.length} trade(s), ${cell.netPnl >= 0 ? '+' : ''}${cell.netPnl.toFixed(3)} SOL` : undefined}
                    >
                      {hasData && (
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white/60">
                          {cell.positions.length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slide-out drawer for selected cell */}
      {selectedCell && selected && (
        <div className="border-t border-[#1a1a1a] bg-[#0d0d0d] overflow-y-auto" style={{ maxHeight: '40%' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] sticky top-0 bg-[#0d0d0d]">
            <span className="text-[11px] font-mono text-[#888888]">
              {formatDayLabel(days[selected.day])} — {String(selected.hour).padStart(2, '0')}:00
              <span className="ml-2 text-[10px]" style={{ color: pnlColor(selectedCell.netPnl, true) }}>
                {selectedCell.netPnl >= 0 ? '+' : ''}{selectedCell.netPnl.toFixed(3)} SOL net
              </span>
            </span>
            <button
              onClick={() => setSelected(null)}
              className="text-[#444444] hover:text-[#888888] text-[11px] font-mono cursor-pointer"
            >
              close
            </button>
          </div>
          {selectedCell.positions.map(pos => (
            <TradeRow key={pos.id} pos={pos} solPrice={solPrice} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 30D Daily grid view ────────────────────────────────────────────────────────

interface DayCell {
  date: Date
  positions: Position[]
  netPnl: number
  wins: number
  losses: number
}

interface ThirtyDayViewProps {
  positions: Position[]
  solPrice: number
}

function ThirtyDayView({ positions, solPrice }: ThirtyDayViewProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (29 - i))
      return startOfDay(d)
    })
  }, [now])

  const dayCells = useMemo(() => {
    const map = new Map<string, DayCell>()
    days.forEach(d => {
      map.set(d.toISOString(), { date: d, positions: [], netPnl: 0, wins: 0, losses: 0 })
    })
    positions.filter(p => p.exitTime !== null).forEach(pos => {
      const exitDay = startOfDay(parseDate(pos.exitTime!))
      const cell = map.get(exitDay.toISOString())
      if (!cell) return
      cell.positions.push(pos)
      cell.netPnl += pos.totalPnlSol
      if (pos.totalPnlSol >= 0) cell.wins++
      else cell.losses++
    })
    return map
  }, [positions, days])

  // Build weeks: each row is Mon–Sun
  const weeks = useMemo(() => {
    const result: Date[][] = []
    let week: Date[] = []
    days.forEach(d => {
      const dow = (d.getDay() + 6) % 7 // 0=Mon..6=Sun
      if (dow === 0 && week.length > 0) {
        result.push(week)
        week = []
      }
      week.push(d)
    })
    if (week.length > 0) result.push(week)
    return result
  }, [days])

  const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* DOW header */}
      <div className="grid grid-cols-7 gap-0.5 px-2 pt-2 pb-1 shrink-0">
        {DOW_LABELS.map((l, i) => (
          <div key={i} className="text-center text-[10px] font-mono text-[#444444]">{l}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {weeks.map((week, wi) => (
          <div key={wi}>
            {/* Day cells row */}
            <div className="grid grid-cols-7 gap-0.5">
              {/* Pad for days before start of week */}
              {Array.from({ length: (week[0].getDay() + 6) % 7 }, (_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {week.map(day => {
                const cell = dayCells.get(day.toISOString())!
                const hasData = cell.positions.length > 0
                const isExpanded = expandedDay === day.toISOString()
                const dotColor =
                  !hasData ? '#222222' :
                  cell.wins > 0 && cell.losses === 0 ? '#00ff88' :
                  cell.wins === 0 && cell.losses > 0 ? '#ff3355' :
                  '#00d4ff'

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      if (!hasData) return
                      setExpandedDay(isExpanded ? null : day.toISOString())
                    }}
                    className="relative rounded border border-[#1a1a1a] bg-[#0d0d0d] flex flex-col items-center justify-between p-1 aspect-square transition-all hover:border-[#2a2a2a] overflow-hidden"
                    style={{
                      cursor: hasData ? 'pointer' : 'default',
                      outline: isExpanded ? '1px solid #00d4ff' : undefined,
                    }}
                  >
                    {/* Trade count chip */}
                    {hasData && (
                      <span className="absolute top-0.5 right-0.5 text-[8px] font-mono text-[#00d4ff] bg-[#00d4ff18] rounded px-0.5 leading-tight">
                        {cell.positions.length}
                      </span>
                    )}
                    {/* Day number */}
                    <span className="text-[10px] font-mono text-[#555555] self-start leading-none mt-0.5">
                      {day.getDate()}
                    </span>
                    {/* PnL */}
                    {hasData && (
                      <span
                        className="text-[9px] font-mono font-bold leading-none"
                        style={{ color: pnlColor(cell.netPnl, true) }}
                      >
                        {cell.netPnl >= 0 ? '+' : ''}{cell.netPnl.toFixed(2)}
                      </span>
                    )}
                    {/* Dot */}
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: dotColor }}
                    />
                  </button>
                )
              })}
            </div>

            {/* Expanded trades for any day in this week */}
            {expandedDay && week.some(d => d.toISOString() === expandedDay) && (() => {
              const cell = dayCells.get(expandedDay)!
              return (
                <div className="mt-0.5 border border-[#1a1a1a] rounded bg-[#0a0a0a] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#111111]">
                    <span className="text-[10px] font-mono text-[#888888]">
                      {formatMonthDay(cell.date)}
                      <span className="ml-2" style={{ color: pnlColor(cell.netPnl, true) }}>
                        {cell.netPnl >= 0 ? '+' : ''}{cell.netPnl.toFixed(3)} SOL
                      </span>
                    </span>
                    <button
                      className="text-[10px] font-mono text-[#444444] hover:text-[#888888] cursor-pointer"
                      onClick={() => setExpandedDay(null)}
                    >
                      close
                    </button>
                  </div>
                  {cell.positions.map(pos => (
                    <TradeRow key={pos.id} pos={pos} solPrice={solPrice} />
                  ))}
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 3M Weekly summary view ─────────────────────────────────────────────────────

interface WeekSummary {
  weekStart: Date
  weekEnd: Date
  positions: Position[]
  netPnl: number
  wins: number
  losses: number
  days: Map<string, { date: Date; positions: Position[]; netPnl: number }>
}

interface ThreeMonthViewProps {
  positions: Position[]
  solPrice: number
}

function ThreeMonthView({ positions, solPrice }: ThreeMonthViewProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

  const now = useMemo(() => new Date(), [])

  const weeks = useMemo<WeekSummary[]>(() => {
    // Build 13 weeks (most recent first)
    const result: WeekSummary[] = []
    for (let wi = 0; wi < 13; wi++) {
      // Week ending on the most recent Sunday
      const weekEndDate = new Date(now)
      // Go back wi weeks, anchored to start of today
      weekEndDate.setDate(weekEndDate.getDate() - wi * 7)
      const weekEnd = startOfDay(weekEndDate)

      const weekStartDate = new Date(weekEnd)
      weekStartDate.setDate(weekStartDate.getDate() - 6)
      const weekStart = startOfDay(weekStartDate)

      const summary: WeekSummary = {
        weekStart,
        weekEnd,
        positions: [],
        netPnl: 0,
        wins: 0,
        losses: 0,
        days: new Map(),
      }

      // Seed day map
      for (let di = 0; di < 7; di++) {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + di)
        const dayStart = startOfDay(d)
        summary.days.set(dayStart.toISOString(), { date: dayStart, positions: [], netPnl: 0 })
      }

      result.push(summary)
    }

    // Distribute closed positions
    positions.filter(p => p.exitTime !== null).forEach(pos => {
      const exitDay = startOfDay(parseDate(pos.exitTime!))
      for (const week of result) {
        if (exitDay >= week.weekStart && exitDay <= week.weekEnd) {
          week.positions.push(pos)
          week.netPnl += pos.totalPnlSol
          if (pos.totalPnlSol >= 0) week.wins++
          else week.losses++
          const dayCell = week.days.get(exitDay.toISOString())
          if (dayCell) {
            dayCell.positions.push(pos)
            dayCell.netPnl += pos.totalPnlSol
          }
          break
        }
      }
    })

    return result
  }, [positions, now])

  return (
    <div className="flex flex-col h-full overflow-y-auto gap-0.5 p-2">
      {weeks.map((week, wi) => {
        const total = week.wins + week.losses
        const winRate = total > 0 ? week.wins / total : 0
        const isExpanded = expandedWeek === wi
        const hasData = week.positions.length > 0

        return (
          <div key={wi} className="border border-[#1a1a1a] rounded bg-[#0d0d0d] overflow-hidden">
            {/* Week row */}
            <button
              onClick={() => {
                if (!hasData) return
                setExpandedWeek(isExpanded ? null : wi)
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#111111] transition-colors text-left"
              style={{ cursor: hasData ? 'pointer' : 'default' }}
            >
              {/* Date range */}
              <span className="text-[10px] font-mono text-[#555555] w-28 shrink-0">
                {formatMonthDay(week.weekStart)} – {formatMonthDay(week.weekEnd)}
              </span>

              {/* Trade count */}
              <span className="text-[10px] font-mono text-[#444444] w-12 shrink-0">
                {total > 0 ? `${total} trade${total !== 1 ? 's' : ''}` : '—'}
              </span>

              {/* Win rate bar */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {total > 0 ? (
                  <>
                    <div className="flex-1 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${winRate * 100}%`, background: '#00ff88' }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#555555] shrink-0 w-8 text-right">
                      {Math.round(winRate * 100)}%
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-mono text-[#2a2a2a]">no trades</span>
                )}
              </div>

              {/* Week PnL */}
              <span
                className="text-[11px] font-mono font-bold w-20 text-right shrink-0"
                style={{ color: hasData ? pnlColor(week.netPnl, true) : '#2a2a2a' }}
              >
                {hasData
                  ? `${week.netPnl >= 0 ? '+' : ''}${week.netPnl.toFixed(3)}`
                  : '—'
                }
              </span>

              {/* Expand chevron */}
              {hasData && (
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="#444444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </button>

            {/* Expanded: daily breakdown */}
            {isExpanded && (
              <div className="border-t border-[#111111]">
                {Array.from(week.days.values()).map(dayData => {
                  const dayHasTrades = dayData.positions.length > 0
                  return (
                    <div key={dayData.date.toISOString()}>
                      {/* Day sub-header */}
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] border-b border-[#0f0f0f]">
                        <span className="text-[10px] font-mono text-[#444444] w-20">
                          {formatDayLabel(dayData.date)}
                        </span>
                        {dayHasTrades ? (
                          <>
                            <span className="text-[10px] font-mono text-[#555555]">
                              {dayData.positions.length} trade{dayData.positions.length !== 1 ? 's' : ''}
                            </span>
                            <span
                              className="ml-auto text-[10px] font-mono font-bold"
                              style={{ color: pnlColor(dayData.netPnl, true) }}
                            >
                              {dayData.netPnl >= 0 ? '+' : ''}{dayData.netPnl.toFixed(3)} SOL
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-mono text-[#2a2a2a]">no trades</span>
                        )}
                      </div>
                      {/* Trade rows */}
                      {dayData.positions.map(pos => (
                        <TradeRow key={pos.id} pos={pos} solPrice={solPrice} />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main CalendarPage ──────────────────────────────────────────────────────────

export function CalendarPage({ positions, solPrice }: Props) {
  const [view, setView] = useState<View>('30D')

  const closedPositions = useMemo(
    () => positions.filter(p => p.status !== 'open'),
    [positions]
  )

  const hasData = closedPositions.length > 0

  const views: View[] = ['7D', '30D', '3M']

  return (
    <div className="flex flex-col h-full bg-[#080808] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#1a1a1a] bg-[#080808] shrink-0">
        <span className="text-[11px] font-mono text-[#444444] mr-2">CALENDAR</span>
        <div className="flex items-center gap-0.5 bg-[#0d0d0d] border border-[#1a1a1a] rounded p-0.5">
          {views.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="text-[11px] font-mono px-3 py-1 rounded transition-all cursor-pointer"
              style={{
                background: view === v ? '#141414' : 'transparent',
                color: view === v ? '#e6e6e6' : '#555555',
                border: view === v ? '1px solid #2a2a2a' : '1px solid transparent',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            {view === '7D' && <SevenDayView positions={closedPositions} solPrice={solPrice} />}
            {view === '30D' && <ThirtyDayView positions={closedPositions} solPrice={solPrice} />}
            {view === '3M' && <ThreeMonthView positions={closedPositions} solPrice={solPrice} />}
          </>
        )}
      </div>
    </div>
  )
}
