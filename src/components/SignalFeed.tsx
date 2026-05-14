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
  alertSettings: AlertSettings
  onAlertSettingsChange: (s: AlertSettings) => void
}

const GRADE_FILTER_OPTIONS = ['ALL', 'SAFE', 'WATCH', 'RISK', 'STARRED'] as const
type GradeFilter = typeof GRADE_FILTER_OPTIONS[number]

const GRADE_COLORS: Record<string, string> = {
  SAFE: '#00ff88',
  WATCH: '#ffcc00',
  RISK: '#ff3355',
  STARRED: '#ffcc00',
}

function AlertPanel({ settings, onChange }: { settings: AlertSettings; onChange: (s: AlertSettings) => void }) {
  const set = (patch: Partial<AlertSettings>) => onChange({ ...settings, ...patch })

  async function handleNotifToggle() {
    if (settings.browserNotifEnabled) {
      set({ browserNotifEnabled: false })
      return
    }
    const granted = await requestNotificationPermission()
    set({ browserNotifEnabled: granted })
  }

  return (
    <div className="border-t border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-[#888888] uppercase tracking-wider">Alert Settings</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => set({ soundEnabled: !settings.soundEnabled })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all ${
            settings.soundEnabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <span>{settings.soundEnabled ? '🔊' : '🔇'}</span>
          <span>Sound</span>
        </button>
        <button onClick={() => set({ vibrationEnabled: !settings.vibrationEnabled })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all ${
            settings.vibrationEnabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <span>📳</span>
          <span>Vibrate</span>
        </button>
        <button onClick={() => set({ safeEnabled: !settings.safeEnabled })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all ${
            settings.safeEnabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <span style={{ color: '#00ff88' }}>●</span>
          <span>SAFE signals</span>
        </button>
        <button onClick={() => set({ watchEnabled: !settings.watchEnabled })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all ${
            settings.watchEnabled ? 'border-[#ffcc0040] text-[#ffcc00] bg-[#ffcc0008]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <span style={{ color: '#ffcc00' }}>●</span>
          <span>WATCH signals</span>
        </button>
        <button onClick={handleNotifToggle}
          className={`col-span-2 flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all ${
            settings.browserNotifEnabled ? 'border-[#00d4ff40] text-[#00d4ff] bg-[#00d4ff08]' : 'border-[#1e1e1e] text-[#555555]'
          }`}>
          <span>🔔</span>
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
        <span className="text-[11px] font-mono text-[#00d4ff] w-8 text-right">{settings.minScore}</span>
      </div>
    </div>
  )
}

export function SignalFeed({ signals, newSignalId, onTrade, alertSettings, onAlertSettingsChange }: Props) {
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse-green" />
          <span className="text-[11px] font-mono text-[#888888] tracking-wider">LIVE FEED</span>
          <span className="text-[11px] font-mono text-[#333333]">·</span>
          <span className="text-[11px] font-mono text-[#555555]">{signals.length} signals</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAlerts(v => !v)}
            className={`text-[13px] min-h-[36px] min-w-[36px] flex items-center justify-center rounded border transition-all mr-1 ${
              showAlerts ? 'border-[#2a2a2a] bg-[#141414]' : 'border-transparent'
            } ${alertsOn ? 'text-[#00d4ff]' : 'text-[#444444]'}`}
            title="Alert settings"
          >
            {alertsOn ? '🔔' : '🔕'}
          </button>
          {GRADE_FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => handleFilterChange(opt)}
              className={`text-[11px] font-mono px-2.5 py-1.5 rounded min-h-[36px] transition-all ${
                filter === opt
                  ? 'bg-[#141414] text-[#e6e6e6] border border-[#2a2a2a]'
                  : 'text-[#444444] hover:text-[#888888] border border-transparent'
              }`}
              style={filter === opt && opt !== 'ALL' ? { color: GRADE_COLORS[opt] } : undefined}
            >
              {opt === 'STARRED' ? '★' : opt}
              {opt !== 'ALL' && counts[opt as keyof typeof counts] > 0 && (
                <span className="ml-1 opacity-60">{counts[opt as keyof typeof counts]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alert settings panel */}
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
            />
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <span className="text-[#333333] text-2xl">{filter === 'STARRED' ? '★' : '◈'}</span>
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
