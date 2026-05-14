import { useState } from 'react'
import type { Signal } from '../types'
import type { AlertSettings } from '../lib/alertEngine'
import { requestNotificationPermission } from '../lib/alertEngine'
import { TokenCard } from './TokenCard'
import { useWatchlist } from '../contexts/WatchlistContext'
import { loadStorage, saveStorage } from '../lib/storage'

interface Props {
  signals: Signal[]
  newSignalId: string | null
  onTrade: (signal: Signal) => void
  onDetail: (signal: Signal) => void
  alertSettings: AlertSettings
  onAlertSettingsChange: (s: AlertSettings) => void
  watchedCAs: string[]
  onAddWatchedCA: (ca: string) => void
  onRemoveWatchedCA: (ca: string) => void
}

const GRADE_FILTER_OPTIONS = ['ALL', 'SAFE', 'WATCH', 'RISK', 'STARRED'] as const
type GradeFilter = typeof GRADE_FILTER_OPTIONS[number]

const GRADE_COLORS: Record<string, string> = {
  SAFE: '#00ff88',
  WATCH: '#ffcc00',
  RISK: '#ff3355',
  STARRED: '#ffcc00',
}

// SVG icon helpers
function IconSound({ on }: { on: boolean }) {
  return on ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  )
}

function IconVibrate({ on: _on }: { on: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5v14"/><path d="M18 5v14"/>
      <rect x="8" y="7" width="8" height="10" rx="1"/>
    </svg>
  )
}

function IconBell({ on }: { on: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      {!on && <line x1="1" y1="1" x2="23" y2="23"/>}
    </svg>
  )
}

function AlertPanel({ settings, onChange }: { settings: AlertSettings; onChange: (s: AlertSettings) => void }) {
  const set = (patch: Partial<AlertSettings>) => onChange({ ...settings, ...patch })

  async function handleNotifToggle() {
    if (settings.browserNotifEnabled) { set({ browserNotifEnabled: false }); return }
    const granted = await requestNotificationPermission()
    set({ browserNotifEnabled: granted })
  }

  return (
    <div className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3 space-y-3">
      <span className="text-[11px] font-mono text-[#888888] uppercase tracking-wider block">Alert Settings</span>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => set({ soundEnabled: !settings.soundEnabled })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all cursor-pointer ${
            settings.soundEnabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <IconSound on={settings.soundEnabled} />
          <span>Sound</span>
        </button>
        <button onClick={() => set({ vibrationEnabled: !settings.vibrationEnabled })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all cursor-pointer ${
            settings.vibrationEnabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <IconVibrate on={settings.vibrationEnabled} />
          <span>Vibrate</span>
        </button>
        <button onClick={() => set({ safeEnabled: !settings.safeEnabled })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all cursor-pointer ${
            settings.safeEnabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: settings.safeEnabled ? '#00ff88' : '#444' }} />
          <span>SAFE signals</span>
        </button>
        <button onClick={() => set({ watchEnabled: !settings.watchEnabled })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all cursor-pointer ${
            settings.watchEnabled ? 'border-[#ffcc0040] text-[#ffcc00] bg-[#ffcc0008]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: settings.watchEnabled ? '#ffcc00' : '#444' }} />
          <span>WATCH signals</span>
        </button>
        <button onClick={handleNotifToggle}
          className={`col-span-2 flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all cursor-pointer ${
            settings.browserNotifEnabled ? 'border-[#00d4ff40] text-[#00d4ff] bg-[#00d4ff08]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <IconBell on={settings.browserNotifEnabled} />
          <span>Browser notifications</span>
          <span className="ml-auto text-[10px] opacity-50">{settings.browserNotifEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-[#555555]">Min score</span>
        <input
          type="range" min={0} max={100} step={5}
          value={settings.minScore}
          onChange={e => set({ minScore: parseInt(e.target.value) })}
          className="flex-1 accent-[#00d4ff]"
        />
        <span className="text-[11px] font-mono text-[#00d4ff] w-8 text-right tabular-nums">{settings.minScore}</span>
      </div>
    </div>
  )
}

export function SignalFeed({ signals, newSignalId, onTrade, onDetail, alertSettings, onAlertSettingsChange, watchedCAs }: Props) {
  const [filter, setFilter] = useState<GradeFilter>(() => loadStorage<GradeFilter>('sentinel_filter', 'ALL'))
  const [showAlerts, setShowAlerts] = useState(false)
  const { watchlist } = useWatchlist()

  function handleFilterChange(f: GradeFilter) {
    setFilter(f)
    saveStorage('sentinel_filter', f)
  }

  const filtered = filter === 'ALL'
    ? signals
    : filter === 'STARRED'
      ? signals.filter(s => watchlist.has(s.ca))
      : signals.filter(s => s.score_grade === filter)

  const counts = {
    SAFE: signals.filter(s => s.score_grade === 'SAFE').length,
    WATCH: signals.filter(s => s.score_grade === 'WATCH').length,
    RISK: signals.filter(s => s.score_grade === 'RISK').length,
    STARRED: watchlist.size,
  }

  const alertsOn = alertSettings.soundEnabled || alertSettings.vibrationEnabled

  return (
    <div className="flex flex-col h-full">
      {/* Feed header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] shrink-0 bg-[#080808]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse-green" />
          <span className="text-[11px] font-mono text-[#888888] tracking-wider">LIVE FEED</span>
          <span className="text-[11px] font-mono text-[#333333]">·</span>
          <span className="text-[11px] font-mono text-[#555555] tabular-nums">{signals.length} signals</span>
          {watchedCAs.length > 0 && (
            <span className="text-[10px] font-mono text-[#00d4ff] bg-[#00d4ff10] px-1.5 py-0.5 rounded">
              {watchedCAs.length} watched
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAlerts(v => !v)}
            className={`text-[13px] min-h-[36px] min-w-[36px] flex items-center justify-center rounded border transition-all mr-1 cursor-pointer ${
              showAlerts ? 'border-[#2a2a2a] bg-[#141414]' : 'border-transparent'
            } ${alertsOn ? 'text-[#00d4ff]' : 'text-[#444444]'}`}
            aria-label="Alert settings"
          >
            <IconBell on={alertsOn} />
          </button>
          {GRADE_FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => handleFilterChange(opt)}
              className={`text-[11px] font-mono px-2.5 py-1.5 rounded min-h-[36px] transition-all cursor-pointer ${
                filter === opt
                  ? 'bg-[#141414] text-[#e6e6e6] border border-[#2a2a2a]'
                  : 'text-[#444444] hover:text-[#888888] border border-transparent'
              }`}
              style={filter === opt && opt !== 'ALL' ? { color: GRADE_COLORS[opt] } : undefined}
            >
              {opt === 'STARRED' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill={filter === opt ? '#ffcc00' : 'none'} stroke="#ffcc00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline' }}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ) : opt}
              {opt !== 'ALL' && counts[opt as keyof typeof counts] > 0 && (
                <span className="ml-1 opacity-60 tabular-nums">{counts[opt as keyof typeof counts]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {showAlerts && (
        <AlertPanel settings={alertSettings} onChange={onAlertSettingsChange} />
      )}

      {/* Scrollable signal list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-3 space-y-2.5">
          {filtered.map(signal => (
            <TokenCard
              key={signal.id}
              signal={signal}
              isNew={signal.id === newSignalId}
              onTrade={onTrade}
              onDetail={onDetail}
            />
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {filter === 'STARRED'
                  ? <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  : <><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>
                }
              </svg>
              <span className="text-[#444444] text-sm font-mono">
                {filter === 'STARRED' ? 'No starred tokens yet' : `No ${filter} signals yet`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
