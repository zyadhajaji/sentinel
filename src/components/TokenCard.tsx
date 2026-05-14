import { useState } from 'react'
import type { Signal } from '../types'
import { ScoreBreakdownPanel } from './ScoreBreakdownPanel'
import { formatUSD, shortCA } from '../lib/mockData'
import { useWatchlist } from '../contexts/WatchlistContext'
import clsx from 'clsx'

interface Props {
  signal: Signal
  isNew?: boolean
  onTrade: (signal: Signal) => void
  onDetail?: (signal: Signal) => void
}

const GRADE_CONFIG = {
  SAFE:  { color: '#00ff88', label: 'SAFE' },
  WATCH: { color: '#ffcc00', label: 'WATCH' },
  RISK:  { color: '#ff3355', label: 'RISK' },
}

const SOURCE_LABELS: Record<string, string> = {
  pumpfun: 'pump', raydium: 'ray', moonshot: 'moon', jupiter: 'jup', unknown: '?',
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
// Generates a deterministic pseudo-chart from the CA string, biased by price_change_1h
function MiniSparkline({ ca, priceChange }: { ca: string; priceChange: number }) {
  const W = 80, H = 36, pts = 20
  // Seed from CA chars
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
  const coords = norm.map((n, i) => ({
    x: (i / (pts - 1)) * W,
    y: H - 4 - n * (H - 8),
  }))

  const polyline = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${coords[0].x},${H} ` + coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` ${coords[coords.length - 1].x},${H}`

  const isUp = priceChange >= 0
  const color = isUp ? '#00ff88' : '#ff3355'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="shrink-0">
      <polygon points={area} fill={`${color}18`} />
      <polyline points={polyline} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2" fill={color} />
    </svg>
  )
}

// ── Token avatar ──────────────────────────────────────────────────────────────
function TokenAvatar({ imageUrl, symbol, grade }: { imageUrl: string | null; symbol: string; grade: Signal['score_grade'] }) {
  const [imgErr, setImgErr] = useState(false)
  const cfg = GRADE_CONFIG[grade]
  const initials = symbol.slice(0, 2).toUpperCase()

  return (
    <div className="relative shrink-0 w-14 h-14">
      {imageUrl && !imgErr ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setImgErr(true)}
          className="w-14 h-14 rounded-xl object-cover bg-[#1a1a1a]"
        />
      ) : (
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-[16px] font-bold font-display"
          style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}28` }}
        >
          {initials}
        </div>
      )}
      {/* Grade dot badge */}
      <span
        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111111]"
        style={{ background: cfg.color }}
      />
    </div>
  )
}

// ── Status pills ──────────────────────────────────────────────────────────────
function computePills(signal: Signal) {
  const pills: { key: string; label: string; color: string; pulse: boolean }[] = []
  if (signal.contract_age_minutes <= 3)
    pills.push({ key: 'age', label: 'JUST LAUNCHED', color: '#00ff88', pulse: true })
  else if (signal.contract_age_minutes <= 15)
    pills.push({ key: 'age', label: 'FRESH', color: '#00d4ff', pulse: false })
  if (signal.price_change_1h >= 200)
    pills.push({ key: 'px', label: 'MOONING 🚀', color: '#ffd700', pulse: true })
  else if (signal.price_change_1h >= 100)
    pills.push({ key: 'px', label: 'ATH', color: '#ffd700', pulse: true })
  else if (signal.price_change_1h >= 50)
    pills.push({ key: 'px', label: 'PUMPING', color: '#ff8c00', pulse: false })
  if (signal.volume_1h >= 50_000)
    pills.push({ key: 'vol', label: 'HIGH VOL', color: '#00d4ff', pulse: true })
  if (signal.buy_pressure >= 80)
    pills.push({ key: 'bp', label: 'FOMO', color: '#ff3355', pulse: true })
  return pills
}

// ── Rug warning ───────────────────────────────────────────────────────────────
function rugLabel(score: number | null): { text: string; color: string } | null {
  if (score === null) return null
  if (score >= 700) return null
  if (score >= 500) return { text: '⚠ WARN', color: '#ffcc00' }
  return { text: '☠ RUG', color: '#ff3355' }
}

// ── Age helper ────────────────────────────────────────────────────────────────
function ageLabel(m: number): string {
  if (m < 1) return '<1m'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`
}

// ── Star icon ─────────────────────────────────────────────────────────────────
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#ffcc00' : 'none'}
      stroke={filled ? '#ffcc00' : '#444444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function TokenCard({ signal, isNew, onTrade, onDetail }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const { watchlist, toggle } = useWatchlist()
  const isWatched = watchlist.has(signal.ca)

  const pills = computePills(signal)
  const rug = rugLabel(signal.rug_score)
  const grade = GRADE_CONFIG[signal.score_grade]
  const isUp = signal.price_change_1h >= 0
  const pxColor = isUp ? '#00ff88' : '#ff3355'
  const pxSign  = isUp ? '+' : ''

  function copyCA(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(signal.ca).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const hasSocials = !!(signal.twitter_url || signal.telegram_url || signal.website_url)

  return (
    <div
      className={clsx(
        'bg-[#0f0f0f] rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.99]',
        isNew
          ? 'border border-[#00ff8860] shadow-[0_0_24px_rgba(0,255,136,0.08)] animate-slide-up'
          : 'border border-[#1c1c1c] hover:border-[#2a2a2a]',
        onDetail ? 'cursor-pointer' : ''
      )}
      onClick={() => onDetail?.(signal)}
    >
      {/* Launch/ATH banner */}
      {signal.contract_age_minutes <= 3 && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-mono font-bold"
          style={{ background: 'rgba(0,255,136,0.05)', borderBottom: '1px solid rgba(0,255,136,0.1)', color: '#00ff88' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" style={{ animation: 'pill-dot-pulse 1.2s ease-in-out infinite' }} />
          NEW TOKEN LAUNCHED
        </div>
      )}
      {signal.price_change_1h >= 100 && signal.contract_age_minutes > 3 && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-mono font-bold"
          style={{ background: 'rgba(255,215,0,0.04)', borderBottom: '1px solid rgba(255,215,0,0.1)', color: '#ffd700' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" style={{ animation: 'pill-dot-pulse 1.4s ease-in-out infinite' }} />
          {signal.price_change_1h >= 200 ? 'MOONING' : 'ATH'} · +{signal.price_change_1h.toFixed(0)}%
        </div>
      )}

      <div className="p-3.5">
        {/* Main row: avatar | info | sparkline | mcap */}
        <div className="flex items-center gap-3">
          <TokenAvatar imageUrl={signal.image_url} symbol={signal.token_symbol} grade={signal.score_grade} />

          {/* Token info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-bold text-[15px] text-[#e8e8e8] tracking-wide truncate"
                style={{ fontFamily: "'Inter', sans-serif" }}>
                {signal.token_symbol}
              </span>
              {/* Grade badge */}
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 font-bold"
                style={{ color: grade.color, background: `${grade.color}15`, border: `1px solid ${grade.color}30` }}>
                {grade.label}
              </span>
              {rug && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 font-bold"
                  style={{ color: rug.color, background: `${rug.color}12` }}>
                  {rug.text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#444444] flex-wrap">
              <span>{SOURCE_LABELS[signal.source] ?? signal.source}</span>
              <span className="text-[#252525]">·</span>
              <span>{ageLabel(signal.contract_age_minutes)}</span>
              <span className="text-[#252525]">·</span>
              <button
                onClick={copyCA}
                className="transition-colors min-h-[20px] cursor-pointer"
                style={{ color: copied ? '#00ff88' : '#333333' }}
                title="Copy CA"
              >
                {copied ? 'copied!' : shortCA(signal.ca)}
              </button>
            </div>
          </div>

          {/* Sparkline + MCap */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <MiniSparkline ca={signal.ca} priceChange={signal.price_change_1h} />
            <span className="text-[14px] font-bold tabular-nums" style={{ color: pxColor, fontFamily: "'Inter', sans-serif" }}>
              {formatUSD(signal.mcap_usd)}
            </span>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: pxColor }}>
              {pxSign}{signal.price_change_1h.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Pills row */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {pills.map(p => (
              <span key={p.key}
                className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{ color: p.color, background: `${p.color}12`, border: `1px solid ${p.color}25` }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                  background: p.color,
                  animation: p.pulse ? 'pill-dot-pulse 1.8s ease-in-out infinite' : undefined,
                }} />
                {p.label}
              </span>
            ))}
          </div>
        )}

        {/* Stats strip */}
        <div className="flex items-center gap-3 mt-2.5 text-[11px] font-mono">
          <div className="flex items-center gap-1">
            <span className="text-[#333333]">LIQ</span>
            <span className="text-[#888888] tabular-nums">{formatUSD(signal.liquidity_usd)}</span>
          </div>
          <span className="text-[#1e1e1e]">|</span>
          <div className="flex items-center gap-1">
            <span className="text-[#333333]">VOL</span>
            <span className="text-[#888888] tabular-nums">{formatUSD(signal.volume_1h)}</span>
          </div>
          <span className="text-[#1e1e1e]">|</span>
          {/* Buy pressure bar */}
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[#333333] shrink-0">BP</span>
            <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${signal.buy_pressure}%`,
                  background: signal.buy_pressure >= 65 ? '#00ff88' : signal.buy_pressure >= 45 ? '#ffcc00' : '#ff3355',
                  opacity: 0.7,
                }} />
            </div>
            <span className="tabular-nums shrink-0"
              style={{ color: signal.buy_pressure >= 65 ? '#00ff88' : signal.buy_pressure >= 45 ? '#ffcc00' : '#ff3355' }}>
              {signal.buy_pressure}%
            </span>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#181818]">
          {/* Social icons */}
          <div className="flex items-center gap-1">
            {signal.twitter_url && (
              <a href={signal.twitter_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-[#555555] hover:text-[#e6e6e6] hover:border-[#333333] transition-all cursor-pointer"
                aria-label="Twitter">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            )}
            {signal.telegram_url && (
              <a href={signal.telegram_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-[#555555] hover:text-[#e6e6e6] hover:border-[#333333] transition-all cursor-pointer"
                aria-label="Telegram">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                </svg>
              </a>
            )}
            {signal.website_url && (
              <a href={signal.website_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-[#555555] hover:text-[#e6e6e6] hover:border-[#333333] transition-all cursor-pointer"
                aria-label="Website">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </a>
            )}
            {!hasSocials && (
              <span className="text-[10px] font-mono text-[#2a2a2a]">no socials</span>
            )}
            {signal.dex_url && (
              <a href={signal.dex_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-[#333333] hover:text-[#888888] hover:border-[#333333] transition-all cursor-pointer ml-0.5"
                aria-label="DexScreener">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setShowBreakdown(v => !v) }}
              className="text-[10px] font-mono text-[#333333] hover:text-[#666666] transition-colors min-h-[28px] px-2 flex items-center gap-1 cursor-pointer rounded-lg"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              {signal.scanner_score}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggle(signal.ca) }}
              className="w-8 h-8 flex items-center justify-center rounded-xl border transition-all cursor-pointer"
              style={isWatched ? { borderColor: '#ffcc0035', background: '#ffcc0010' } : { borderColor: '#1e1e1e' }}
              aria-label={isWatched ? 'Unwatch' : 'Watch'}
            >
              <StarIcon filled={isWatched} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTrade(signal) }}
              className="h-8 px-3 text-[11px] font-mono font-bold rounded-xl border transition-all cursor-pointer"
              style={{ borderColor: '#00d4ff30', color: '#00d4ff', background: '#00d4ff08' }}
            >
              BUY
            </button>
          </div>
        </div>

        {showBreakdown && (
          <div className="mt-3 pt-3 border-t border-[#181818]">
            <ScoreBreakdownPanel breakdown={signal.score_breakdown} grade={signal.score_grade} />
          </div>
        )}
      </div>
    </div>
  )
}
