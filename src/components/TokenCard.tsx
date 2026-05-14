import { useState } from 'react'
import type { Signal } from '../types'
import { ScoreRing } from './ScoreRing'
import { ScoreBreakdownPanel } from './ScoreBreakdownPanel'
import { formatUSD, shortCA, timeAgo } from '../lib/mockData'
import { useWatchlist } from '../contexts/WatchlistContext'
import clsx from 'clsx'

interface Props {
  signal: Signal
  isNew?: boolean
  onTrade: (signal: Signal) => void
}

const SOURCE_COLORS: Record<string, string> = {
  pumpfun:  '#ff8c00',
  raydium:  '#9945ff',
  moonshot: '#00d4ff',
  jupiter:  '#00ff88',
}

const NARRATIVE_COLORS: Record<string, string> = {
  AI: '#8b5cf6', MEME: '#ff8c00', ANIMAL: '#00ff88', GAMING: '#00d4ff',
  DEFI: '#ffcc00', CELEB: '#ff3355', SPACE: '#00d4ff', FOOD: '#ff8c00',
  PATRIOT: '#ff3355', SOLANA: '#9945ff',
}

// ── Status pill system ─────────────────────────────────────────────────────
interface PillDef {
  key: string
  label: string
  color: string
  animated: boolean
  glow?: boolean
}

function computeStatusPills(signal: Signal): PillDef[] {
  const pills: PillDef[] = []

  // Age tier — most important signal for momentum traders
  if (signal.contract_age_minutes <= 3) {
    pills.push({ key: 'age', label: 'JUST LAUNCHED', color: '#00ff88', animated: true, glow: true })
  } else if (signal.contract_age_minutes <= 15) {
    pills.push({ key: 'age', label: 'FRESH', color: '#00d4ff', animated: false })
  } else if (signal.contract_age_minutes <= 45) {
    pills.push({ key: 'age', label: 'ACTIVE', color: '#888888', animated: false })
  }

  // Price momentum
  if (signal.price_change_1h >= 200) {
    pills.push({ key: 'px', label: 'MOONING', color: '#ffd700', animated: true, glow: true })
  } else if (signal.price_change_1h >= 100) {
    pills.push({ key: 'px', label: 'ATH', color: '#ffd700', animated: true })
  } else if (signal.price_change_1h >= 50) {
    pills.push({ key: 'px', label: 'PUMPING', color: '#ff8c00', animated: true })
  }

  // Volume
  if (signal.volume_1h >= 50_000) {
    pills.push({ key: 'vol', label: 'HIGH VOL', color: '#00d4ff', animated: true })
  } else if (signal.volume_1h >= 10_000) {
    pills.push({ key: 'vol', label: 'TRENDING', color: '#00d4ff', animated: false })
  }

  // Buy pressure / FOMO
  if (signal.buy_pressure >= 80) {
    pills.push({ key: 'bp', label: 'FOMO', color: '#ff3355', animated: true })
  }

  return pills
}

function StatusPill({ label, color, animated, glow }: PillDef) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 transition-all"
      style={{
        color,
        background: `${color}12`,
        border: `1px solid ${color}28`,
        boxShadow: glow ? `0 0 10px ${color}28` : undefined,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: color,
          animation: animated ? 'pill-dot-pulse 1.8s ease-in-out infinite' : undefined,
        }}
      />
      {label}
    </span>
  )
}

// ── Launch time helpers ────────────────────────────────────────────────────
function launchClock(ageMinutes: number): string {
  const launchMs = Date.now() - ageMinutes * 60_000
  return new Date(launchMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ageLabel(minutes: number): string {
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// ── Volume bar ─────────────────────────────────────────────────────────────
function volumeTier(vol: number): { label: string; color: string; pct: number } {
  if (vol >= 100_000) return { label: formatUSD(vol), color: '#ffd700', pct: 100 }
  if (vol >= 50_000)  return { label: formatUSD(vol), color: '#ff8c00', pct: 75 }
  if (vol >= 10_000)  return { label: formatUSD(vol), color: '#00d4ff', pct: 50 }
  if (vol >= 1_000)   return { label: formatUSD(vol), color: '#555555', pct: 25 }
  return { label: formatUSD(vol), color: '#333333', pct: 8 }
}

// ── Rug risk ───────────────────────────────────────────────────────────────
function rugLabel(score: number | null): { text: string; color: string } | null {
  if (score === null) return null
  if (score >= 700) return null
  if (score >= 500) return { text: 'WARN', color: '#ffcc00' }
  return { text: 'RUG RISK', color: '#ff3355' }
}

// ── Star icon ─────────────────────────────────────────────────────────────
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? '#ffcc00' : 'none'}
      stroke={filled ? '#ffcc00' : '#555555'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function TokenCard({ signal, isNew, onTrade }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const { watchlist, toggle } = useWatchlist()
  const isWatched = watchlist.has(signal.ca)

  const priceChangeColor = signal.price_change_1h >= 0 ? '#00ff88' : '#ff3355'
  const priceChangeSign  = signal.price_change_1h >= 0 ? '+' : ''
  const buyPressColor    = signal.buy_pressure >= 60 ? '#00ff88' : signal.buy_pressure >= 40 ? '#ffcc00' : '#ff3355'
  const rug     = rugLabel(signal.rug_score)
  const pills   = computeStatusPills(signal)
  const volData = volumeTier(signal.volume_1h)

  function copyCA() {
    navigator.clipboard.writeText(signal.ca).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={clsx(
        'bg-[#111111] border rounded-xl overflow-hidden transition-all duration-200',
        isNew
          ? 'border-[#00ff88] shadow-[0_0_28px_rgba(0,255,136,0.10)] animate-slide-up'
          : 'border-[#1a1a1a] hover:border-[#252525]'
      )}
    >
      {/* Launch banner — shown when very fresh */}
      {signal.contract_age_minutes <= 3 && (
        <div
          className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-mono font-bold"
          style={{ background: 'rgba(0,255,136,0.06)', borderBottom: '1px solid rgba(0,255,136,0.12)', color: '#00ff88' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" style={{ animation: 'pill-dot-pulse 1.2s ease-in-out infinite' }} />
          JUST LAUNCHED · {launchClock(signal.contract_age_minutes)}
        </div>
      )}
      {/* Pumping/ATH banner */}
      {signal.price_change_1h >= 100 && signal.contract_age_minutes > 3 && (
        <div
          className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-mono font-bold"
          style={{ background: 'rgba(255,215,0,0.05)', borderBottom: '1px solid rgba(255,215,0,0.12)', color: '#ffd700' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" style={{ animation: 'pill-dot-pulse 1.4s ease-in-out infinite' }} />
          {signal.price_change_1h >= 200 ? 'MOONING' : 'ATH'} · +{signal.price_change_1h.toFixed(0)}% in 1h
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <ScoreRing score={signal.scanner_score} grade={signal.score_grade} size="md" />
            <div className="min-w-0">
              {/* Name + source + narrative */}
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="font-display font-bold text-[14px] text-[#e6e6e6] tracking-wide">
                  {signal.token_symbol}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                  style={{
                    color: SOURCE_COLORS[signal.source] || '#888888',
                    background: `${SOURCE_COLORS[signal.source] || '#888888'}15`,
                    border: `1px solid ${SOURCE_COLORS[signal.source] || '#888888'}28`,
                  }}
                >
                  {signal.source}
                </span>
                {signal.narrative_tags.slice(0, 1).map(tag => (
                  <span key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{
                      color: NARRATIVE_COLORS[tag] || '#888888',
                      background: `${NARRATIVE_COLORS[tag] || '#888888'}12`,
                      border: `1px solid ${NARRATIVE_COLORS[tag] || '#888888'}25`,
                    }}>
                    {tag}
                  </span>
                ))}
                {rug && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 font-bold"
                    style={{ color: rug.color, background: `${rug.color}10`, border: `1px solid ${rug.color}28` }}
                  >
                    {rug.text}
                  </span>
                )}
                {isNew && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono text-[#00ff88] bg-[#00ff8810] border border-[#00ff8825] shrink-0">
                    NEW
                  </span>
                )}
              </div>

              {/* Launch time + CA + seen */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={copyCA}
                  className="text-[11px] font-mono transition-colors min-h-[20px] cursor-pointer"
                  style={{ color: copied ? '#00ff88' : '#444444' }}
                  title="Copy contract address"
                >
                  {copied ? 'copied' : shortCA(signal.ca)}
                </button>
                <span className="text-[#252525]">·</span>
                {/* Exact launch time */}
                <span className="text-[10px] font-mono text-[#555555]" title={`Launched ${ageLabel(signal.contract_age_minutes)} ago`}>
                  {launchClock(signal.contract_age_minutes)}
                </span>
                <span className="text-[#252525]">·</span>
                <span className="text-[10px] font-mono text-[#444444]">{ageLabel(signal.contract_age_minutes)} old</span>
                <span className="text-[#252525]">·</span>
                <span className="text-[10px] font-mono text-[#333333]">{timeAgo(signal.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); toggle(signal.ca) }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded border transition-all cursor-pointer"
              style={isWatched
                ? { borderColor: '#ffcc0035', background: '#ffcc0010' }
                : { borderColor: '#1e1e1e' }
              }
              aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              <StarIcon filled={isWatched} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTrade(signal) }}
              className="min-h-[44px] px-3 text-[11px] font-mono font-bold rounded border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] active:bg-[#00d4ff25] transition-all cursor-pointer"
            >
              TRADE
            </button>
            {signal.dex_url && (
              <a
                href={signal.dex_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-[#1a1a1a] text-[#555555] hover:text-[#888888] active:bg-[#141414] transition-all cursor-pointer"
                aria-label="View on DexScreener"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Status pills row */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {pills.map(pill => (
              <StatusPill key={pill.key} label={pill.label} color={pill.color} animated={pill.animated} glow={pill.glow} />
            ))}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-[#0d0d0d] rounded-lg p-2.5">
            <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">MCap</p>
            <p className="text-[13px] font-mono text-[#e6e6e6] font-medium tabular-nums">{formatUSD(signal.mcap_usd)}</p>
          </div>
          <div className="bg-[#0d0d0d] rounded-lg p-2.5">
            <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">Liquidity</p>
            <p className="text-[13px] font-mono text-[#e6e6e6] font-medium tabular-nums">{formatUSD(signal.liquidity_usd)}</p>
          </div>
          <div className="bg-[#0d0d0d] rounded-lg p-2.5">
            <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">1h Change</p>
            <p className="text-[13px] font-mono font-bold tabular-nums" style={{ color: priceChangeColor }}>
              {priceChangeSign}{signal.price_change_1h.toFixed(1)}%
            </p>
          </div>
          <div className="bg-[#0d0d0d] rounded-lg p-2.5">
            <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">Buy Press</p>
            <p className="text-[13px] font-mono font-bold tabular-nums" style={{ color: buyPressColor }}>
              {signal.buy_pressure}%
            </p>
          </div>
        </div>

        {/* Volume bar */}
        {signal.volume_1h > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-[#444444] uppercase tracking-wider">1h Volume</span>
              <span className="text-[10px] font-mono tabular-nums" style={{ color: volData.color }}>{volData.label}</span>
            </div>
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${volData.pct}%`, background: volData.color, opacity: 0.7 }}
              />
            </div>
          </div>
        )}

        {/* Social links */}
        {(signal.twitter_url || signal.telegram_url || signal.website_url) && (
          <div className="flex items-center gap-1.5 mb-3">
            {signal.twitter_url && (
              <a href={signal.twitter_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-[#1e1e1e] text-[#555555] hover:text-[#e6e6e6] hover:border-[#333333] transition-all min-h-[28px] cursor-pointer"
                aria-label="Twitter / X"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>Twitter</span>
              </a>
            )}
            {signal.telegram_url && (
              <a href={signal.telegram_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-[#1e1e1e] text-[#555555] hover:text-[#e6e6e6] hover:border-[#333333] transition-all min-h-[28px] cursor-pointer"
                aria-label="Telegram"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2.5L2.5 9.5l7 2.5m12-9.5l-7 19-5-7m12-12l-12 9"/>
                </svg>
                <span>Telegram</span>
              </a>
            )}
            {signal.website_url && (
              <a href={signal.website_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-[#1e1e1e] text-[#555555] hover:text-[#e6e6e6] hover:border-[#333333] transition-all min-h-[28px] cursor-pointer"
                aria-label="Website"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span>Website</span>
              </a>
            )}
          </div>
        )}

        {/* Bottom info row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
            {signal.mint_authority_revoked !== null && (
              <span style={{ color: signal.mint_authority_revoked ? '#00ff88' : '#ff3355' }}>
                Mint {signal.mint_authority_revoked ? 'revoked' : 'live'}
              </span>
            )}
            {signal.freeze_authority_revoked !== null && (
              <>
                <span className="text-[#252525]">·</span>
                <span style={{ color: signal.freeze_authority_revoked ? '#00ff88' : '#ff3355' }}>
                  Freeze {signal.freeze_authority_revoked ? 'revoked' : 'live'}
                </span>
              </>
            )}
            {signal.top_holder_pct !== null && signal.top_holder_pct > 0 && (
              <>
                <span className="text-[#252525]">·</span>
                <span style={{ color: signal.top_holder_pct > 20 ? '#ff3355' : signal.top_holder_pct > 10 ? '#ffcc00' : '#555555' }}>
                  Top {signal.top_holder_pct.toFixed(1)}%
                </span>
              </>
            )}
          </div>
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="text-[10px] text-[#444444] hover:text-[#777777] font-mono transition-colors min-h-[36px] px-1 shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <svg
              width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease-out' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            score
          </button>
        </div>

        {showBreakdown && (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <ScoreBreakdownPanel breakdown={signal.score_breakdown} grade={signal.score_grade} />
          </div>
        )}
      </div>
    </div>
  )
}
