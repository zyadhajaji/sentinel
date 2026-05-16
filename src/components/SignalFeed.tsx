import { useState } from 'react'
import type { Signal } from '../types'
import type { AlertSettings } from '../lib/alertEngine'
import { requestNotificationPermission } from '../lib/alertEngine'
import { TokenCard } from './TokenCard'
import { CallsPanel } from './CallsPanel'
import { useWatchlist } from '../contexts/WatchlistContext'
import { useCaLookup } from '../hooks/useCaLookup'
import { loadStorage, saveStorage } from '../lib/storage'
import { storageKey } from '../lib/appMode'
import type { CallRecord } from '../hooks/useCalls'

interface Props {
  signals: Signal[]
  newSignalId: string | null
  solPrice?: number
  onTrade: (signal: Signal) => void
  onDetail: (signal: Signal) => void
  alertSettings: AlertSettings
  onAlertSettingsChange: (s: AlertSettings) => void
  watchedCAs: string[]
  onAddWatchedCA: (ca: string) => void
  onRemoveWatchedCA: (ca: string) => void
  calls: CallRecord[]
  calledCAs: Set<string>
  onCall: (signal: Signal) => void
  onRemoveCall: (ca: string) => void
  onClearCalls: () => void
}

// ── MC Tier filter ─────────────────────────────────────────────────────────────
// SAFE  = high market cap tokens (≥ $500K) — relatively established
// WATCH = mid-tier tokens (≥ $7K)
// RISK  = instant/new launches (< $7K or age ≤ 5 min)
const MC_FILTER_OPTIONS = ['ALL', 'SAFE', 'WATCH', 'RISK', 'STARRED'] as const
type McFilter = typeof MC_FILTER_OPTIONS[number]

const MC_COLORS: Record<string, string> = {
  SAFE: '#00ff88',
  WATCH: '#ffcc00',
  RISK: '#ff3355',
  STARRED: '#ffcc00',
}

const MC_LABELS: Record<string, string> = {
  ALL:     'ALL',
  SAFE:    'SAFE',    // ≥$500K MC
  WATCH:   'WATCH',   // ≥$7K MC
  RISK:    'RISK',    // <$7K or instant
  STARRED: '★',
}

const MC_HINTS: Record<string, string> = {
  SAFE:  '≥$500K',
  WATCH: '≥$7K',
  RISK:  '<$7K',
}

function matchesMcFilter(signal: Signal, filter: McFilter, watchlist: Set<string>): boolean {
  switch (filter) {
    case 'ALL':     return true
    case 'SAFE':    return signal.mcap_usd >= 500_000
    case 'WATCH':   return signal.mcap_usd >= 7_000
    case 'RISK':    return signal.mcap_usd < 7_000 || signal.contract_age_minutes <= 5
    case 'STARRED': return watchlist.has(signal.ca)
  }
}

// ── SVG icon helpers ───────────────────────────────────────────────────────────
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

function IconVibrate() {
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
          <IconVibrate />
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

export function SignalFeed({ signals, newSignalId, solPrice = 150, onTrade, onDetail, alertSettings, onAlertSettingsChange, watchedCAs, calls, calledCAs, onCall, onRemoveCall, onClearCalls }: Props) {
  const [filter, setFilter] = useState<McFilter>(() => loadStorage<McFilter>(storageKey('sentinel_filter'), 'ALL'))
  const [search, setSearch] = useState('')
  const [showAlerts, setShowAlerts] = useState(false)
  const [showCalls, setShowCalls] = useState(false)
  const { watchlist } = useWatchlist()
  const { state: lookupState, isCA } = useCaLookup(search, solPrice)

  function handleFilterChange(f: McFilter) {
    setFilter(f)
    saveStorage(storageKey('sentinel_filter'), f)
  }

  // Apply MC-tier filter first
  const mcFiltered = signals.filter(s => matchesMcFilter(s, filter, watchlist))

  // Then apply search (name, symbol, or CA)
  const q = search.trim().toLowerCase()
  const filtered = q
    ? mcFiltered.filter(s =>
        s.token_symbol.toLowerCase().includes(q) ||
        s.token_name.toLowerCase().includes(q) ||
        s.ca.toLowerCase().includes(q)
      )
    : mcFiltered

  // Counts per tier
  const counts = {
    SAFE:    signals.filter(s => s.mcap_usd >= 500_000).length,
    WATCH:   signals.filter(s => s.mcap_usd >= 7_000).length,
    RISK:    signals.filter(s => s.mcap_usd < 7_000 || s.contract_age_minutes <= 5).length,
    STARRED: watchlist.size,
  }

  const alertsOn = alertSettings.soundEnabled || alertSettings.vibrationEnabled

  return (
    <div className="flex flex-col h-full">
      {/* ── Feed header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-[#1a1a1a] shrink-0 bg-[#080808]">
        {/* Top row: live dot + signal count + alert toggle + filter tabs */}
        <div className="flex items-center justify-between px-4 py-2.5 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse-green" />
            <span className="text-[11px] font-mono text-[#888888] tracking-wider">LIVE</span>
            <span className="text-[11px] font-mono text-[#444444] tabular-nums">{signals.length}</span>
            {watchedCAs.length > 0 && (
              <span className="text-[10px] font-mono text-[#00d4ff] bg-[#00d4ff10] px-1.5 py-0.5 rounded">
                {watchedCAs.length} watched
              </span>
            )}
            {/* Calls toggle */}
            <button
              onClick={() => { setShowCalls(v => !v); setShowAlerts(false) }}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer ${
                showCalls ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8810]' : 'border-[#1e1e1e] text-[#444]'
              }`}
            >
              CALLS{calls.length > 0 && <span className="ml-1 tabular-nums">{calls.length}</span>}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowAlerts(v => !v); setShowCalls(false) }}
              className={`text-[13px] min-h-[36px] min-w-[36px] flex items-center justify-center rounded border transition-all mr-0.5 cursor-pointer ${
                showAlerts ? 'border-[#2a2a2a] bg-[#141414]' : 'border-transparent'
              } ${alertsOn ? 'text-[#00d4ff]' : 'text-[#444444]'}`}
              aria-label="Alert settings"
            >
              <IconBell on={alertsOn} />
            </button>

            {MC_FILTER_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => handleFilterChange(opt)}
                className={`relative text-[10px] font-mono px-2 py-1.5 rounded min-h-[32px] transition-all cursor-pointer ${
                  filter === opt
                    ? 'bg-[#141414] border border-[#2a2a2a]'
                    : 'text-[#444444] hover:text-[#888888] border border-transparent'
                }`}
                style={filter === opt && opt !== 'ALL' ? { color: MC_COLORS[opt] } : filter === opt ? { color: '#e6e6e6' } : undefined}
                title={MC_HINTS[opt]}
              >
                {opt === 'STARRED' ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={filter === opt ? '#ffcc00' : 'none'} stroke="#ffcc00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline' }}>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                ) : (
                  <span>{MC_LABELS[opt]}</span>
                )}
                {opt !== 'ALL' && opt !== 'STARRED' && counts[opt as keyof typeof counts] > 0 && (
                  <span className="ml-0.5 opacity-50 tabular-nums">{counts[opt as keyof typeof counts]}</span>
                )}
                {opt === 'STARRED' && watchlist.size > 0 && (
                  <span className="ml-0.5 opacity-50 tabular-nums">{watchlist.size}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 pb-2.5">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search symbol, name, or CA…"
              className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg pl-8 pr-8 py-2 text-[11px] font-mono text-[#e6e6e6] placeholder-[#333] outline-none focus:border-[#2a2a2a] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          {/* MC tier label below search bar when a tier is selected */}
          {filter !== 'ALL' && filter !== 'STARRED' && (
            <div className="flex items-center gap-1.5 mt-1.5 px-0.5">
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: MC_COLORS[filter] }}>
                {filter}
              </span>
              <span className="text-[9px] font-mono text-[#333]">{MC_HINTS[filter]} market cap</span>
              <span className="text-[9px] font-mono text-[#333]">·</span>
              <span className="text-[9px] font-mono text-[#444] tabular-nums">{filtered.length} signals</span>
            </div>
          )}
        </div>
      </div>

      {showAlerts && (
        <AlertPanel settings={alertSettings} onChange={onAlertSettingsChange} />
      )}

      {showCalls && (
        <CallsPanel calls={calls} onRemove={onRemoveCall} onClear={onClearCalls} />
      )}

      {/* ── Scrollable signal list ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-3 space-y-2.5">

          {/* ── CA Lookup result ───────────────────────────────────────────────── */}
          {isCA && (
            <>
              {lookupState.status === 'loading' && (
                <div className="flex items-center gap-2 px-3 py-3 rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] text-[11px] font-mono text-[#444]">
                  <svg className="animate-spin shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Fetching token…
                </div>
              )}
              {lookupState.status === 'not_found' && (
                <div className="flex items-center gap-2 px-3 py-3 rounded-2xl border border-[#ff335520] bg-[#0d0d0d] text-[11px] font-mono text-[#ff3355]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Token not found on Solana
                </div>
              )}
              {lookupState.status === 'error' && (
                <div className="flex items-center gap-2 px-3 py-3 rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] text-[11px] font-mono text-[#555]">
                  Lookup failed — check connection
                </div>
              )}
              {lookupState.status === 'found' && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <span className="text-[9px] font-mono text-[#00d4ff] uppercase tracking-wider">Lookup result</span>
                  </div>
                  <TokenCard
                    signal={lookupState.signal}
                    onTrade={onTrade}
                    onDetail={onDetail}
                    onCall={onCall}
                    isCalled={calledCAs.has(lookupState.signal.ca)}
                  />
                </div>
              )}
              <div className="border-t border-[#111] my-1" />
            </>
          )}

          {/* ── Live feed ─────────────────────────────────────────────────────── */}
          {filtered.map(signal => (
            <TokenCard
              key={signal.id}
              signal={signal}
              isNew={signal.id === newSignalId}
              onTrade={onTrade}
              onDetail={onDetail}
              onCall={onCall}
              isCalled={calledCAs.has(signal.ca)}
            />
          ))}
          {filtered.length === 0 && !isCA && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {filter === 'STARRED'
                  ? <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  : q
                    ? <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>
                    : <><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>
                }
              </svg>
              <span className="text-[#444444] text-sm font-mono">
                {filter === 'STARRED' ? 'No starred tokens yet'
                  : q ? `No results for "${search}"`
                  : `No ${filter} signals yet`}
              </span>
              {q && (
                <button onClick={() => setSearch('')}
                  className="text-[11px] font-mono text-[#555] hover:text-[#888] cursor-pointer transition-colors">
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
