import { useState } from 'react'
import type { Signal } from '../types'
import { ScoreBreakdownPanel } from './ScoreBreakdownPanel'
import { shortCA } from '../lib/mockData'
import { useWatchlist } from '../contexts/WatchlistContext'
import clsx from 'clsx'

interface Props {
  signal: Signal
  isNew?: boolean
  onTrade: (signal: Signal) => void
  onDetail?: (signal: Signal) => void
  onCall?: (signal: Signal) => void
  isCalled?: boolean
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}
function fmtSOL(n: number): string {
  return n >= 1 ? `${n.toFixed(2)}◎` : `${n.toFixed(3)}◎`
}
function ageLabel(m: number): string {
  if (m < 1)    return '<1m'
  if (m < 60)   return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

// ── Alert computation ─────────────────────────────────────────────────────────
type AlertType  = 'migration' | 'mooning' | 'ath' | null
type AlertStyle = 'sweep' | 'pulse' | 'flash' | 'combo'

function computeAlert(signal: Signal): { type: AlertType; style: AlertStyle } {
  const { price_change_1h, volume_1h, mcap_usd, source } = signal
  if (price_change_1h >= 200 || volume_1h >= 100_000) {
    return { type: 'ath', style: 'combo' }
  }
  if (price_change_1h >= 80) {
    return { type: 'mooning', style: 'pulse' }
  }
  // approaching pump.fun migration threshold
  if ((source === 'pumpfun' || source === 'moonshot') && mcap_usd >= 45_000 && mcap_usd < 69_000) {
    return { type: 'migration', style: 'sweep' }
  }
  return { type: null, style: 'sweep' }
}

// ── Badge labels ──────────────────────────────────────────────────────────────
function badgeLabel(type: AlertType, signal: Signal): string {
  if (type === 'ath')       return `★ ATH +${signal.price_change_1h.toFixed(0)}%`
  if (type === 'mooning')   return `▲ MOON +${signal.price_change_1h.toFixed(0)}%`
  if (type === 'migration') return `→ MIGRATING`
  return ''
}

// ── Grade config ──────────────────────────────────────────────────────────────
const GRADE: Record<string, { color: string; chip: string }> = {
  SAFE:  { color: '#34d399', chip: 'chip-green' },
  WATCH: { color: '#fbbf24', chip: 'chip-amber' },
  RISK:  { color: '#f87171', chip: 'chip-red' },
}

const SOURCE_LABELS: Record<string, string> = {
  pumpfun: 'pump', raydium: 'ray', moonshot: 'moon', jupiter: 'jup', unknown: '?',
}

const NARRATIVE_COLORS: Record<string, string> = {
  AI: '#a855f7', MEME: '#ff8c00', ANIMAL: '#00d4ff', GAMING: '#00ff88',
  DEFI: '#4ade80', CELEB: '#ff3355', SPACE: '#7c3aed', FOOD: '#fb923c',
  PATRIOT: '#3b82f6', SOLANA: '#9945ff',
}

// ── Gradient avatar ───────────────────────────────────────────────────────────
const GRAD_PALETTE: [string, string][] = [
  ['#7c3aed', '#a855f7'], ['#00d4ff', '#0066ff'], ['#00ff88', '#00d4a0'],
  ['#ff8c00', '#ff3355'], ['#ffd700', '#ff8c00'], ['#ff3355', '#a855f7'],
  ['#00d4ff', '#7c3aed'], ['#00ff88', '#00d4ff'],
]
function tokenGradient(symbol: string, ca: string): [string, string] {
  const seed = symbol.length >= 2 ? symbol : ca
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xff
  return GRAD_PALETTE[h % GRAD_PALETTE.length]!
}

function TokenAvatar({ imageUrl, symbol, ca }: { imageUrl: string | null; symbol: string; ca: string }) {
  const [imgErr, setImgErr] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const initials = symbol.slice(0, 2).toUpperCase()
  const [c1, c2] = tokenGradient(symbol, ca)
  const gradId = `tg-${symbol}-${ca.slice(0, 6)}`.replace(/[^a-zA-Z0-9-]/g, '')
  const showImage = !!imageUrl && !imgErr

  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width="52" height="52" viewBox="0 0 52 52" style={{ position: 'absolute', inset: 0, opacity: showImage && imgLoaded ? 0 : 1, transition: 'opacity 300ms' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <rect width="52" height="52" rx="8" fill={`url(#${gradId})`} />
        <text x="26" y="26" textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.85)" fontWeight="700" fontSize="17" fontFamily="JetBrains Mono, monospace">{initials}</text>
      </svg>
      {showImage && (
        <img src={imageUrl} alt={symbol} onLoad={() => setImgLoaded(true)} onError={() => setImgErr(true)}
          style={{ position: 'absolute', inset: 0, width: 52, height: 52, borderRadius: 8, objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 300ms' }} />
      )}
    </div>
  )
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function MiniSparkline({ ca, priceChange }: { ca: string; priceChange: number }) {
  const W = 64, H = 20, pts = 18
  let seed = 0
  for (let i = 0; i < ca.length; i++) seed = (seed * 31 + ca.charCodeAt(i)) & 0xffffff
  function rng() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }
  const raw: number[] = []
  let v = 0.5
  const bias = priceChange > 0 ? 0.015 * Math.min(priceChange / 100, 1.5) : -0.01 * Math.min(Math.abs(priceChange) / 100, 1)
  for (let i = 0; i < pts; i++) {
    v = Math.max(0.05, Math.min(0.95, v + (rng() - 0.48 + bias) * 0.18))
    raw.push(v)
  }
  const minV = Math.min(...raw), maxV = Math.max(...raw)
  const norm = raw.map(r => (r - minV) / (maxV - minV + 0.001))
  const coords = norm.map((n, i) => ({ x: (i / (pts - 1)) * W, y: H - 3 - n * (H - 6) }))
  const polyline = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${coords[0].x},${H} ` + coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` ${coords[coords.length - 1].x},${H}`
  const color = priceChange >= 0 ? '#00ff88' : '#ff3355'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <polygon points={area} fill={`${color}18`} />
      <polyline points={polyline} stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="1.5" fill={color} />
    </svg>
  )
}

// ── Social link ───────────────────────────────────────────────────────────────
function SocialLink({ href, label, color, icon }: { href: string; label: string; color: string; icon: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} aria-label={label}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-all"
      style={{ color, borderColor: `${color}30`, background: `${color}0d`, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}>
      {icon}
      <span>{label}</span>
    </a>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function TokenCard({ signal, isNew, onTrade, onDetail, onCall, isCalled }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const { watchlist, toggle } = useWatchlist()
  const isWatched = watchlist.has(signal.ca)

  const alert   = computeAlert(signal)
  const grade   = GRADE[signal.score_grade] ?? GRADE.RISK!
  const isUp    = signal.price_change_1h >= 0
  const pxColor = isUp ? '#00ff88' : '#ff3355'
  const pxSign  = isUp ? '+' : ''

  // rug label
  const rugLabel = signal.rug_score !== null && signal.rug_score < 500 ? '☠ RUG' :
                   signal.rug_score !== null && signal.rug_score < 700 ? '⚠ WARN' : null
  const rugColor = signal.rug_score !== null && signal.rug_score < 500 ? '#f87171' : '#fbbf24'

  // bundle risk
  const hasBundle = signal.rug_risks.some(r => /bundle|sniper|coordin/i.test(r))
  const holderRisk = hasBundle ? '🔴 BUNDLE'
    : signal.top_holder_pct !== null && signal.top_holder_pct >= 80 ? `🔴 TOP ${signal.top_holder_pct.toFixed(0)}%`
    : signal.top_holder_pct !== null && signal.top_holder_pct >= 50 ? `⚠ TOP ${signal.top_holder_pct.toFixed(0)}%`
    : null
  const holderRiskColor = (hasBundle || (signal.top_holder_pct ?? 0) >= 80) ? '#f87171' : '#fbbf24'

  function copyCA(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(signal.ca).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const cardClasses = clsx(
    'signal-card',
    isNew && 'animate-slide-up',
    alert.type && 'alert',
    alert.type && `alert--${alert.type}`,
    alert.type && `style-${alert.style}`,
  )

  return (
    <div className={cardClasses} onClick={() => onDetail?.(signal)}>
      {/* Alert overlays */}
      <div className="card-edge" />
      <div className="card-pulse" />
      <div className="card-flash" />
      {alert.type && (
        <div className="card-badge">{badgeLabel(alert.type, signal)}</div>
      )}

      {/* ── Avatar col ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <TokenAvatar imageUrl={signal.image_url} symbol={signal.token_symbol} ca={signal.ca} />
        {/* Grade dot */}
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: grade.color, display: 'block', marginTop: 2 }} />
      </div>

      {/* ── Mid col ─────────────────────────────────────────────────────── */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Row 1: symbol + grade badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, color: '#e8e8e8', letterSpacing: '0.3px' }}>
            {signal.token_symbol}
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
            {signal.token_name}
          </span>
          {signal.narrative_tags?.slice(0, 1).map(tag => (
            <span key={tag} style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, padding: '1px 5px', borderRadius: 20, color: NARRATIVE_COLORS[tag] ?? '#888', background: `${NARRATIVE_COLORS[tag] ?? '#888'}18`, border: `1px solid ${NARRATIVE_COLORS[tag] ?? '#888'}30`, flexShrink: 0 }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Row 2: age · CA · source */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#444', flexWrap: 'wrap' }}>
          <span style={{ color: '#666' }}>{ageLabel(signal.contract_age_minutes)}</span>
          <span style={{ color: '#222' }}>·</span>
          <button onClick={copyCA} style={{ color: copied ? '#00ff88' : '#333', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }} title="Copy CA">
            {copied ? 'copied!' : shortCA(signal.ca)}
          </button>
          <span style={{ color: '#222' }}>·</span>
          <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700, color: '#666', background: '#181818' }}>
            {SOURCE_LABELS[signal.source] ?? signal.source}
          </span>
          {signal.holders !== null && (
            <>
              <span style={{ color: '#222' }}>·</span>
              <span style={{ fontSize: 9, color: '#444' }}>{signal.holders >= 1000 ? `${(signal.holders / 1000).toFixed(1)}K` : signal.holders}h</span>
            </>
          )}
        </div>

        {/* Row 3: socials */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {signal.twitter_url && (
            <SocialLink href={signal.twitter_url} label="X" color="#1D9BF0"
              icon={<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
            />
          )}
          {signal.telegram_url && (
            <SocialLink href={signal.telegram_url} label="TG" color="#229ED9"
              icon={<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>}
            />
          )}
          {signal.dex_url && (
            <SocialLink href={signal.dex_url} label="Chart" color="#9945ff"
              icon={<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            />
          )}
        </div>

        {/* Row 4: buy pressure bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', background: '#1a1a1a', display: 'flex' }}>
            <div style={{ width: `${signal.buy_pressure}%`, background: '#00ff88', opacity: 0.7 }} />
            <div style={{ width: `${100 - signal.buy_pressure}%`, background: '#ff3355', opacity: 0.4 }} />
          </div>
          <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: signal.buy_pressure >= 60 ? '#00ff88' : '#888', flexShrink: 0 }}>{signal.buy_pressure}%</span>
        </div>
      </div>

      {/* ── Right col ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <MiniSparkline ca={signal.ca} priceChange={signal.price_change_1h} />

        {/* V + MC */}
        <div style={{ display: 'flex', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
          <span><span style={{ color: '#333' }}>V </span><span style={{ color: '#fbbf24' }}>{fmt(signal.volume_1h)}</span></span>
          <span><span style={{ color: '#333' }}>MC </span><span className="mc-value" style={{ color: pxColor }}>{fmt(signal.mcap_usd)}</span></span>
        </div>

        {/* F + price change */}
        <div style={{ display: 'flex', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
          <span><span style={{ color: '#333' }}>F </span><span style={{ color: '#555' }}>{fmtSOL(signal.fees_est_sol)}</span></span>
          <span style={{ padding: '1px 5px', borderRadius: 20, fontWeight: 700, fontSize: 9, color: pxColor, background: `${pxColor}15`, border: `1px solid ${pxColor}30` }}>
            {pxSign}{signal.price_change_1h.toFixed(1)}%
          </span>
        </div>

        {/* BUY button */}
        <button
          onClick={(e) => { e.stopPropagation(); onTrade(signal) }}
          style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'border-color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>
          BUY
        </button>
      </div>

      {/* ── Chips row (full width below all 3 cols) ──────────────────────── */}
      <div className="card-chips-row">
        {/* Grade */}
        <span className={`signal-chip ${grade.chip}`}>{signal.score_grade}</span>

        {/* Rug warning */}
        {rugLabel && (
          <span className="signal-chip chip-red" style={{ color: rugColor }}>{rugLabel}</span>
        )}

        {/* Holder risk */}
        {holderRisk && (
          <span className="signal-chip chip-red" style={{ color: holderRiskColor }}>{holderRisk}</span>
        )}

        {/* Score expand */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowBreakdown(v => !v) }}
          className="signal-chip"
          style={{ cursor: 'pointer', background: 'none', border: '1px solid #1e1e1e', gap: 3 }}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {signal.scanner_score}
        </button>

        {/* Star/watch */}
        <button
          onClick={(e) => { e.stopPropagation(); toggle(signal.ca) }}
          className="signal-chip"
          style={{ cursor: 'pointer', background: isWatched ? '#ffcc0010' : 'none', border: isWatched ? '1px solid #ffcc0035' : '1px solid #1e1e1e' }}
          aria-label={isWatched ? 'Unwatch' : 'Watch'}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill={isWatched ? '#ffcc00' : 'none'} stroke={isWatched ? '#ffcc00' : '#444'} strokeWidth="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>

        {/* Call button */}
        {onCall && (
          <button
            onClick={(e) => { e.stopPropagation(); onCall(signal) }}
            className={`signal-chip ${isCalled ? 'chip-green' : ''}`}
            style={{ cursor: 'pointer', border: isCalled ? '1px solid rgba(52,211,153,0.3)' : '1px solid #1e1e1e' }}
          >
            {isCalled ? '✓ CALLED' : 'CALL'}
          </button>
        )}

        {/* Narrative tags (remaining) */}
        {signal.narrative_tags?.slice(1, 3).map(tag => (
          <span key={tag} style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, padding: '2px 5px', borderRadius: 20, flexShrink: 0,
            color: NARRATIVE_COLORS[tag] ?? '#888', background: `${NARRATIVE_COLORS[tag] ?? '#888'}18`, border: `1px solid ${NARRATIVE_COLORS[tag] ?? '#888'}30` }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Score breakdown */}
      {showBreakdown && (
        <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: '1px solid #181818' }}>
          <ScoreBreakdownPanel breakdown={signal.score_breakdown} grade={signal.score_grade} />
        </div>
      )}
    </div>
  )
}
