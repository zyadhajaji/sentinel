import { useState, useMemo } from 'react'
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

// ── Column classification ─────────────────────────────────────────────────────
type ColKey = 'new' | 'migrating' | 'migrated'

function signalColumn(s: Signal): ColKey {
  if (s.source === 'raydium' || s.source === 'jupiter' || s.mcap_usd >= 69_000) return 'migrated'
  if (s.mcap_usd >= 25_000) return 'migrating'
  return 'new'
}

// ── MC filter ─────────────────────────────────────────────────────────────────
const MC_OPTIONS = ['ALL', 'SAFE', 'WATCH', 'RISK', 'STARRED'] as const
type McFilter = typeof MC_OPTIONS[number]

const MC_COLORS: Record<string, string> = {
  SAFE: '#00ff88', WATCH: '#ffcc00', RISK: '#ff3355', STARRED: '#ffcc00',
}

function matchesMc(s: Signal, f: McFilter, wl: Set<string>): boolean {
  switch (f) {
    case 'ALL':     return true
    case 'SAFE':    return s.mcap_usd >= 500_000
    case 'WATCH':   return s.mcap_usd >= 7_000
    case 'RISK':    return s.mcap_usd < 7_000 || s.contract_age_minutes <= 5
    case 'STARRED': return wl.has(s.ca)
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconBell({ on }: { on: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      {!on && <line x1="1" y1="1" x2="23" y2="23"/>}
    </svg>
  )
}
function IconSound({ on }: { on: boolean }) {
  return on ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  )
}

// ── Alert settings panel ──────────────────────────────────────────────────────
function AlertPanel({ settings, onChange }: { settings: AlertSettings; onChange: (s: AlertSettings) => void }) {
  const set = (p: Partial<AlertSettings>) => onChange({ ...settings, ...p })
  async function handleNotif() {
    if (settings.browserNotifEnabled) { set({ browserNotifEnabled: false }); return }
    const granted = await requestNotificationPermission()
    set({ browserNotifEnabled: granted })
  }
  return (
    <div className="border-t border-[#1a1a1a] bg-[#0a0a0c] px-4 py-3 space-y-3 shrink-0">
      <span className="text-[10px] font-mono text-[#555] uppercase tracking-wider block">Alert Settings</span>
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: 'soundEnabled', label: 'Sound', icon: <IconSound on={settings.soundEnabled} />, color: '#00ff88', active: settings.soundEnabled, action: () => set({ soundEnabled: !settings.soundEnabled }) },
          { key: 'safeEnabled', label: 'SAFE', icon: <span className="w-2 h-2 rounded-full shrink-0" style={{ background: settings.safeEnabled ? '#00ff88' : '#444', display: 'inline-block' }} />, color: '#00ff88', active: settings.safeEnabled, action: () => set({ safeEnabled: !settings.safeEnabled }) },
          { key: 'watchEnabled', label: 'WATCH', icon: <span className="w-2 h-2 rounded-full shrink-0" style={{ background: settings.watchEnabled ? '#ffcc00' : '#444', display: 'inline-block' }} />, color: '#ffcc00', active: settings.watchEnabled, action: () => set({ watchEnabled: !settings.watchEnabled }) },
        ].map(btn => (
          <button key={btn.key} onClick={btn.action}
            className="flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all cursor-pointer"
            style={btn.active ? { borderColor: `${btn.color}40`, color: btn.color, background: `${btn.color}08` } : { borderColor: '#1e1e1e', color: '#555' }}>
            {btn.icon}<span>{btn.label}</span>
          </button>
        ))}
        <button onClick={handleNotif}
          className="col-span-2 flex items-center gap-2 px-3 py-2.5 rounded border text-[11px] font-mono min-h-[44px] transition-all cursor-pointer"
          style={settings.browserNotifEnabled ? { borderColor: '#00d4ff40', color: '#00d4ff', background: '#00d4ff08' } : { borderColor: '#1e1e1e', color: '#555' }}>
          <IconBell on={settings.browserNotifEnabled} />
          <span>Browser notifications</span>
          <span className="ml-auto text-[10px] opacity-50">{settings.browserNotifEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-[#555]">Min score</span>
        <input type="range" min={0} max={100} step={5} value={settings.minScore}
          onChange={e => set({ minScore: parseInt(e.target.value) })} className="flex-1 accent-[#00d4ff]" />
        <span className="text-[10px] font-mono text-[#00d4ff] w-8 text-right tabular-nums">{settings.minScore}</span>
      </div>
    </div>
  )
}

// ── Column header ─────────────────────────────────────────────────────────────
function ColHeader({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color?: string }) {
  return (
    <div className="sentinel-col-head">
      <span className="col-icon" style={color ? { color } : undefined}>{icon}</span>
      <span>{label}</span>
      <span className="col-spacer" />
      <span className="sentinel-col-count">{count}</span>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyCol({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 gap-2">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
      <span className="text-[11px] font-mono text-[#2a2a2a]">No {label}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function SignalFeed({ signals, newSignalId, solPrice = 150, onTrade, onDetail, alertSettings, onAlertSettingsChange, watchedCAs, calls, calledCAs, onCall, onRemoveCall, onClearCalls }: Props) {
  const [filter, setFilter] = useState<McFilter>(() => loadStorage<McFilter>(storageKey('sentinel_filter'), 'ALL'))
  const [search, setSearch]       = useState('')
  const [showAlerts, setShowAlerts] = useState(false)
  const [showCalls, setShowCalls]   = useState(false)
  const [mobileCol, setMobileCol]   = useState<ColKey>('new')
  const { watchlist } = useWatchlist()
  const { state: lookupState, isCA } = useCaLookup(search, solPrice)

  function handleFilter(f: McFilter) {
    setFilter(f)
    saveStorage(storageKey('sentinel_filter'), f)
  }

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    let base = signals.filter(s => matchesMc(s, filter, watchlist))
    if (q) base = base.filter(s =>
      s.token_symbol.toLowerCase().includes(q) ||
      s.token_name.toLowerCase().includes(q) ||
      s.ca.toLowerCase().includes(q)
    )
    return base
  }, [signals, filter, watchlist, q])

  // Split into 3 columns
  const cols = useMemo(() => {
    const result: Record<ColKey, Signal[]> = { new: [], migrating: [], migrated: [] }
    for (const s of filtered) result[signalColumn(s)].push(s)
    return result
  }, [filtered])

  const alertsOn = alertSettings.soundEnabled || alertSettings.vibrationEnabled

  const renderCard = (s: Signal) => (
    <TokenCard key={s.id} signal={s} isNew={s.id === newSignalId} onTrade={onTrade} onDetail={onDetail} onCall={onCall} isCalled={calledCAs.has(s.ca)} />
  )

  return (
    <div className="flex flex-col h-full bg-[#080808]">
      {/* ── Top bar: live status + search + filters ─────────────────────────── */}
      <div className="shrink-0 border-b border-[#1a1a1a] bg-[#080808]">
        {/* Status row */}
        <div className="flex items-center justify-between px-4 py-2 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse-green" />
            <span className="text-[10px] font-mono text-[#555] tracking-wider">LIVE</span>
            <span className="text-[10px] font-mono text-[#333] tabular-nums">{signals.length}</span>
            {watchedCAs.length > 0 && (
              <span className="text-[9px] font-mono text-[#00d4ff] bg-[#00d4ff10] px-1.5 py-0.5 rounded">{watchedCAs.length} watched</span>
            )}
            <button onClick={() => { setShowCalls(v => !v); setShowAlerts(false) }}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer"
              style={showCalls ? { borderColor: '#00ff8840', color: '#00ff88', background: '#00ff8810' } : { borderColor: '#1e1e1e', color: '#333' }}>
              CALLS{calls.length > 0 && <span className="ml-1 tabular-nums">{calls.length}</span>}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowAlerts(v => !v); setShowCalls(false) }}
              className="text-[13px] min-h-[36px] min-w-[36px] flex items-center justify-center rounded border transition-all cursor-pointer"
              style={showAlerts ? { borderColor: '#2a2a2a', background: '#141414', color: alertsOn ? '#00d4ff' : '#444' } : { borderColor: 'transparent', color: alertsOn ? '#00d4ff' : '#444' }}
              aria-label="Alert settings">
              <IconBell on={alertsOn} />
            </button>
            {MC_OPTIONS.map(opt => (
              <button key={opt} onClick={() => handleFilter(opt)}
                className="text-[9px] font-mono px-2 py-1 rounded min-h-[30px] transition-all cursor-pointer border"
                style={filter === opt
                  ? { background: '#141414', borderColor: '#2a2a2a', color: opt !== 'ALL' && opt !== 'STARRED' ? MC_COLORS[opt] : '#e6e6e6' }
                  : { borderColor: 'transparent', color: '#333' }
                }>
                {opt === 'STARRED'
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill={filter === opt ? '#ffcc00' : 'none'} stroke="#ffcc00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  : opt}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol, name, or CA…"
              className="w-full bg-[#0a0a0c] border border-[#1a1a1a] rounded-lg pl-8 pr-8 py-1.5 text-[11px] font-mono text-[#e6e6e6] placeholder-[#2a2a2a] outline-none focus:border-[#2a2a2a] transition-colors" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#333] hover:text-[#666] cursor-pointer transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile column tabs */}
        <div className="flex md:hidden border-t border-[#1a1a1a]">
          {([
            { key: 'new' as const, label: 'New', count: cols.new.length },
            { key: 'migrating' as const, label: '→ Migrate', count: cols.migrating.length },
            { key: 'migrated' as const, label: 'Migrated', count: cols.migrated.length },
          ]).map(t => (
            <button key={t.key} onClick={() => setMobileCol(t.key)}
              className="flex-1 py-2 text-[10px] font-mono transition-all border-b-2 cursor-pointer"
              style={mobileCol === t.key
                ? { borderColor: '#00d4ff', color: '#00d4ff' }
                : { borderColor: 'transparent', color: '#333' }}>
              {t.label} <span className="opacity-50 tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {showAlerts && <AlertPanel settings={alertSettings} onChange={onAlertSettingsChange} />}
      {showCalls && <CallsPanel calls={calls} onRemove={onRemoveCall} onClear={onClearCalls} />}

      {/* CA lookup result */}
      {isCA && (
        <div className="shrink-0 px-3 pt-2">
          {lookupState.status === 'loading' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-[#1e1e1e] bg-[#0a0a0c] text-[10px] font-mono text-[#333]">
              <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Fetching token…
            </div>
          )}
          {lookupState.status === 'found' && (
            <div className="mb-2">
              <div className="flex items-center gap-1 mb-1 px-0.5">
                <span className="text-[9px] font-mono text-[#00d4ff] uppercase tracking-wider">Lookup result</span>
              </div>
              <TokenCard signal={lookupState.signal} onTrade={onTrade} onDetail={onDetail} onCall={onCall} isCalled={calledCAs.has(lookupState.signal.ca)} />
            </div>
          )}
          <div className="border-t border-[#111] mb-2" />
        </div>
      )}

      {/* ── Desktop: 3-column grid ──────────────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-3 gap-2 flex-1 overflow-hidden p-2">
        {/* New Tokens */}
        <div className="sentinel-col">
          <ColHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="7"/><path d="M12 8v8M8 12h8"/></svg>}
            label="New Tokens"
            count={cols.new.length}
          />
          <div className="sentinel-col-body">
            {cols.new.length > 0 ? cols.new.map(renderCard) : <EmptyCol label="new tokens" />}
          </div>
        </div>

        {/* About to Migrate */}
        <div className="sentinel-col">
          <ColHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>}
            label="About to Migrate"
            count={cols.migrating.length}
            color="#fbbf24"
          />
          <div className="sentinel-col-body">
            {cols.migrating.length > 0 ? cols.migrating.map(renderCard) : <EmptyCol label="migrating tokens" />}
          </div>
        </div>

        {/* Migrated */}
        <div className="sentinel-col">
          <ColHeader
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}
            label="Migrated"
            count={cols.migrated.length}
            color="#00d4ff"
          />
          <div className="sentinel-col-body">
            {cols.migrated.length > 0 ? cols.migrated.map(renderCard) : <EmptyCol label="migrated tokens" />}
          </div>
        </div>
      </div>

      {/* ── Mobile: single column ───────────────────────────────────────────── */}
      <div className="md:hidden flex-1 overflow-y-auto overscroll-contain">
        <div className="p-2 space-y-2">
          {cols[mobileCol].length > 0
            ? cols[mobileCol].map(renderCard)
            : <EmptyCol label={mobileCol === 'new' ? 'new tokens' : mobileCol === 'migrating' ? 'migrating tokens' : 'migrated tokens'} />
          }
        </div>
      </div>
    </div>
  )
}
