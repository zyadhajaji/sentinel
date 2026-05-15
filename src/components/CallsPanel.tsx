import type { CallRecord } from '../hooks/useCalls'

interface Props {
  calls: CallRecord[]
  onRemove: (ca: string) => void
  onClear: () => void
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function CallsPanel({ calls, onRemove, onClear }: Props) {
  if (calls.length === 0) {
    return (
      <div className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-4 py-6 flex flex-col items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <p className="text-[11px] font-mono text-[#333]">No calls yet — hit CALL on any signal</p>
      </div>
    )
  }

  const totalCalls = calls.length
  const wins = calls.filter(c => c.current_mcap_usd > c.entry_mcap_usd).length
  const winRate = totalCalls > 0 ? Math.round((wins / totalCalls) * 100) : 0

  return (
    <div className="border-t border-[#1a1a1a] bg-[#0d0d0d]">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#888] uppercase tracking-wider">
            My Calls <span className="text-[#444]">({totalCalls})</span>
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold"
            style={{
              color: winRate >= 60 ? '#00ff88' : winRate >= 40 ? '#ffcc00' : '#ff3355',
              background: winRate >= 60 ? '#00ff8810' : winRate >= 40 ? '#ffcc0010' : '#ff335510',
            }}
          >
            {winRate}% WR
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-[10px] font-mono text-[#333] hover:text-[#666] transition-colors cursor-pointer"
        >
          Clear all
        </button>
      </div>

      {/* Call list */}
      <div className="divide-y divide-[#111111] max-h-64 overflow-y-auto overscroll-contain">
        {calls.map(call => {
          const mcapChange = call.entry_mcap_usd > 0
            ? ((call.current_mcap_usd - call.entry_mcap_usd) / call.entry_mcap_usd) * 100
            : 0
          const isUp = mcapChange >= 0
          const changeColor = isUp ? '#00ff88' : '#ff3355'
          const sign = isUp ? '+' : ''

          return (
            <div key={call.id} className="flex items-center gap-2.5 px-4 py-2.5">
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: '#1a1a1a', color: '#555' }}
              >
                {call.token_symbol.slice(0, 2).toUpperCase()}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-[#e6e6e6] truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {call.token_symbol}
                  </span>
                  <span className="text-[9px] font-mono text-[#333] shrink-0">{timeSince(call.timestamp)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span style={{ color: '#444' }}>CALLED {fmt(call.entry_mcap_usd)}</span>
                  <span style={{ color: '#333' }}>→</span>
                  <span style={{ color: '#666' }}>{fmt(call.current_mcap_usd)}</span>
                </div>
              </div>

              {/* PnL badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-full"
                  style={{ color: changeColor, background: `${changeColor}12` }}
                >
                  {sign}{mcapChange.toFixed(0)}%
                </span>

                {call.dex_url && (
                  <a
                    href={call.dex_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="w-6 h-6 flex items-center justify-center rounded border border-[#1e1e1e] text-[#444] hover:text-[#888] hover:border-[#333] transition-colors cursor-pointer shrink-0"
                    aria-label="Open chart"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  </a>
                )}

                <button
                  onClick={() => onRemove(call.ca)}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#2a2a2a] hover:text-[#666] transition-colors cursor-pointer shrink-0"
                  aria-label="Remove call"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
