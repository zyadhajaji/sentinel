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
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function fmtSOL(n: number): string {
  return n >= 1 ? `${n.toFixed(2)}◎` : `${n.toFixed(3)}◎`
}

function fmtMc(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`
  return `$${usd.toFixed(0)}`
}

function ageLabel(m: number): string {
  if (m < 1) return '<1m'
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

// ── Config ────────────────────────────────────────────────────────────────────
const GRADE_CONFIG = {
  SAFE:  { color: '#00ff88', label: 'SAFE' },
  WATCH: { color: '#ffcc00', label: 'WATCH' },
  RISK:  { color: '#ff3355', label: 'RISK' },
}

const SOURCE_LABELS: Record<string, string> = {
  pumpfun: 'pump', raydium: 'ray', moonshot: 'moon', jupiter: 'jup', unknown: '?',
}

// Narrative tag colors — consistent per tag
const NARRATIVE_COLORS: Record<string, string> = {
  AI:      '#a855f7',
  MEME:    '#ff8c00',
  ANIMAL:  '#00d4ff',
  GAMING:  '#00ff88',
  DEFI:    '#4ade80',
  CELEB:   '#ff3355',
  SPACE:   '#7c3aed',
  FOOD:    '#fb923c',
  PATRIOT: '#3b82f6',
  SOLANA:  '#9945ff',
}

// ── Compute banner/effects ────────────────────────────────────────────────────
interface HotState {
  banners: { text: string; color: string; bg: string }[]
  borderColor: string
  animClass: string
}

function computeHot(signal: Signal): HotState {
  const banners: HotState['banners'] = []
  let borderColor = '#1c1c1c'
  let animClass = ''

  const isSurge   = signal.volume_1h >= 100_000
  const isHighVol = signal.volume_1h >= 50_000 && signal.volume_1h < 100_000
  const isMooning = signal.price_change_1h >= 200
  const isATH     = signal.price_change_1h >= 100 && signal.price_change_1h < 200
  const isLaunch  = signal.contract_age_minutes <= 3

  if (isLaunch) {
    banners.push({ text: '● NEW LAUNCH', color: '#00ff88', bg: 'rgba(0,255,136,0.05)' })
    borderColor = '#00ff8840'
    animClass = 'animate-launch'
  }
  if (isMooning) {
    banners.push({ text: `🚀 MOONING · +${signal.price_change_1h.toFixed(0)}%`, color: '#ffd700', bg: 'rgba(255,215,0,0.04)' })
    if (!isLaunch) { animClass = 'animate-moon' }
  } else if (isATH) {
    banners.push({ text: `📈 ATH · +${signal.price_change_1h.toFixed(0)}%`, color: '#ffd700', bg: 'rgba(255,215,0,0.04)' })
  }
  if (isSurge) {
    banners.push({ text: `🔥 SURGE · ${fmt(signal.volume_1h)} VOLUME`, color: '#ffd700', bg: 'rgba(255,215,0,0.04)' })
    borderColor = '#ffd70050'
    animClass = 'animate-surge'
  } else if (isHighVol) {
    banners.push({ text: `⚡ HIGH VOLUME · ${fmt(signal.volume_1h)}`, color: '#ff8c00', bg: 'rgba(255,140,0,0.04)' })
    if (!isLaunch) { borderColor = '#ff8c0040' }
  }

  return { banners, borderColor, animClass }
}

// ── Rug warning ───────────────────────────────────────────────────────────────
function rugLabel(score: number | null): { text: string; color: string } | null {
  if (score === null) return null
  if (score >= 700) return null
  if (score >= 500) return { text: '⚠ WARN', color: '#ffcc00' }
  return { text: '☠ RUG', color: '#ff3355' }
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function MiniSparkline({ ca, priceChange }: { ca: string; priceChange: number }) {
  const W = 72, H = 22, pts = 20
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
  const coords = norm.map((n, i) => ({ x: (i / (pts - 1)) * W, y: H - 4 - n * (H - 8) }))
  const polyline = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${coords[0].x},${H} ` + coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` ${coords[coords.length - 1].x},${H}`
  const isUp = priceChange >= 0
  const color = isUp ? '#00ff88' : '#ff3355'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="shrink-0">
      <polygon points={area} fill={`${color}18`} />
      <polyline points={polyline} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="1.5" fill={color} />
    </svg>
  )
}

// ── Token avatar ──────────────────────────────────────────────────────────────
function TokenAvatar({ imageUrl, symbol, grade }: { imageUrl: string | null; symbol: string; grade: Signal['score_grade'] }) {
  const [imgErr, setImgErr] = useState(false)
  const cfg = GRADE_CONFIG[grade]
  const initials = symbol.slice(0, 2).toUpperCase()

  return (
    <div className="relative shrink-0 w-[44px] h-[44px]">
      {imageUrl && !imgErr ? (
        <img
          src={imageUrl}
          alt={symbol}
          onError={() => setImgErr(true)}
          className="w-[44px] h-[44px] rounded-xl object-cover bg-[#1a1a1a]"
        />
      ) : (
        <div
          className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-[13px] font-bold font-display"
          style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}28` }}
        >
          {initials}
        </div>
      )}
      <span
        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111111]"
        style={{ background: cfg.color }}
      />
    </div>
  )
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

// ── Upgraded Social Pill ───────────────────────────────────────────────────────
interface SocialPillProps {
  href: string
  label: string
  color: string
  icon: React.ReactNode
  text: string
}

function SocialPill({ href, label, color, icon, text }: SocialPillProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      aria-label={label}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all cursor-pointer select-none"
      style={{
        color,
        borderColor: `${color}30`,
        background: `${color}0d`,
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-[9px] font-mono font-medium">{text}</span>
    </a>
  )
}

// Extract a short display text from a URL
function socialHandle(url: string, type: 'twitter' | 'telegram' | 'website' | 'dex'): string {
  try {
    const u = new URL(url)
    if (type === 'twitter') {
      const seg = u.pathname.replace(/^\//, '').split('/')[0]
      return seg ? `@${seg.slice(0, 12)}` : 'X'
    }
    if (type === 'telegram') {
      const seg = u.pathname.replace(/^\//, '').split('/')[0]
      return seg ? `t.me/${seg.slice(0, 10)}` : 'TG'
    }
    if (type === 'website') {
      return u.hostname.replace('www.', '').slice(0, 14)
    }
    if (type === 'dex') return 'Chart'
  } catch { /* noop */ }
  return type === 'twitter' ? 'X' : type === 'telegram' ? 'TG' : type === 'website' ? 'Web' : 'Chart'
}

// ── Narrative tag pill ────────────────────────────────────────────────────────
function NarrativePill({ tag }: { tag: string }) {
  const color = NARRATIVE_COLORS[tag] ?? '#888888'
  return (
    <span
      className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {tag}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function TokenCard({ signal, isNew, onTrade, onDetail }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const { watchlist, toggle } = useWatchlist()
  const isWatched = watchlist.has(signal.ca)

  const hot = computeHot(signal)
  const rug = rugLabel(signal.rug_score)
  const grade = GRADE_CONFIG[signal.score_grade]
  const isUp = signal.price_change_1h >= 0
  const pxColor = isUp ? '#00ff88' : '#ff3355'
  const pxSign  = isUp ? '+' : ''

  const bpColor = signal.buy_pressure >= 65 ? '#ff8c00' : signal.buy_pressure >= 45 ? '#ffcc00' : '#888888'

  const hasSocials = !!(signal.twitter_url || signal.telegram_url || signal.website_url || signal.dex_url)
  const hasNarratives = signal.narrative_tags && signal.narrative_tags.length > 0

  function copyCA(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(signal.ca).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div
      className={clsx(
        'bg-[#0d0d0d] rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.99]',
        isNew
          ? 'border border-[#00ff8860] shadow-[0_0_24px_rgba(0,255,136,0.08)] animate-slide-up'
          : `border hover:border-[#2a2a2a]`,
        hot.animClass,
        onDetail ? 'cursor-pointer' : ''
      )}
      style={!isNew ? { borderColor: hot.borderColor } : undefined}
      onClick={() => onDetail?.(signal)}
    >
      {/* ── Banners ────────────────────────────────────────────────────────── */}
      {hot.banners.map((banner, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-4 py-1 text-[10px] font-mono font-bold tracking-wider"
          style={{ background: banner.bg, borderBottom: `1px solid ${banner.color}20`, color: banner.color }}
        >
          {banner.text}
        </div>
      ))}

      {/* ── Section A: Main row ─────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 p-2.5">
        <TokenAvatar imageUrl={signal.image_url} symbol={signal.token_symbol} grade={signal.score_grade} />

        {/* Center info */}
        <div className="flex-1 min-w-0">
          {/* Row 1: symbol · grade · rug · narrative tags */}
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="font-bold text-[14px] text-[#e8e8e8] tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>
              {signal.token_symbol}
            </span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 font-bold"
              style={{ color: grade.color, background: `${grade.color}15`, border: `1px solid ${grade.color}30` }}
            >
              {grade.label}
            </span>
            {rug && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 font-bold"
                style={{ color: rug.color, background: `${rug.color}12` }}
              >
                {rug.text}
              </span>
            )}
            {hasNarratives && signal.narrative_tags.slice(0, 2).map(tag => (
              <NarrativePill key={tag} tag={tag} />
            ))}
          </div>

          {/* Row 2: age · CA · source · holders */}
          <div className="flex items-center gap-1 text-[10px] font-mono text-[#444444] flex-wrap mb-1">
            <span className="text-[#555555]">{ageLabel(signal.contract_age_minutes)}</span>
            <span className="text-[#252525]">·</span>
            <button
              onClick={copyCA}
              className="transition-colors cursor-pointer hover:text-[#888888]"
              style={{ color: copied ? '#00ff88' : '#333333' }}
              title="Copy CA"
            >
              {copied ? 'copied!' : shortCA(signal.ca)}
            </button>
            <span className="text-[#252525]">·</span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold"
              style={{ color: '#888', background: '#1a1a1a' }}
            >
              {SOURCE_LABELS[signal.source] ?? signal.source}
            </span>
            {signal.holders !== null && (
              <>
                <span className="text-[#252525]">·</span>
                <span className="text-[#444444] text-[9px]">
                  {signal.holders >= 1000 ? `${(signal.holders / 1000).toFixed(1)}K` : signal.holders} holders
                </span>
              </>
            )}
          </div>

          {/* Row 3: social pills */}
          {hasSocials && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {signal.twitter_url && (
                <SocialPill
                  href={signal.twitter_url}
                  label="Twitter / X"
                  color="#1D9BF0"
                  text={socialHandle(signal.twitter_url, 'twitter')}
                  icon={
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  }
                />
              )}
              {signal.telegram_url && (
                <SocialPill
                  href={signal.telegram_url}
                  label="Telegram"
                  color="#229ED9"
                  text={socialHandle(signal.telegram_url, 'telegram')}
                  icon={
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                    </svg>
                  }
                />
              )}
              {signal.website_url && (
                <SocialPill
                  href={signal.website_url}
                  label="Website"
                  color="#6b7280"
                  text={socialHandle(signal.website_url, 'website')}
                  icon={
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  }
                />
              )}
              {signal.dex_url && (
                <SocialPill
                  href={signal.dex_url}
                  label="DEX Chart"
                  color="#9945ff"
                  text="Chart"
                  icon={
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  }
                />
              )}
            </div>
          )}
        </div>

        {/* Right: sparkline + compact 2-line stats */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <MiniSparkline ca={signal.ca} priceChange={signal.price_change_1h} />
          {/* Line 1: V · MC */}
          <div className="flex gap-3">
            <span className="text-[10px] font-mono">
              <span style={{ color: '#333' }}>V </span>
              <span style={{ color: '#ffcc00' }}>{fmt(signal.volume_1h)}</span>
            </span>
            {(() => {
              const entryMc = signal.entry_mcap_usd
              const liveMc = signal.mcap_usd
              const hasEntry = typeof entryMc === 'number' && entryMc > 0
              const changed = hasEntry && entryMc !== liveMc
              const changePct = changed ? ((liveMc - entryMc) / entryMc) * 100 : 0
              const showChange = changed && Math.abs(changePct) > 1
              if (showChange) {
                const changeColor = changePct >= 0 ? '#00ff88' : '#ff3355'
                const sign = changePct >= 0 ? '+' : ''
                return (
                  <span className="text-[10px] font-mono flex items-center gap-0.5">
                    <span style={{ color: '#555' }}>CALLED {fmtMc(entryMc)}</span>
                    <span style={{ color: '#444' }}> → </span>
                    <span style={{ color: '#e6e6e6' }}>LIVE {fmtMc(liveMc)}</span>
                    <span style={{ color: changeColor }}> ({sign}{changePct.toFixed(0)}%)</span>
                  </span>
                )
              }
              return (
                <span className="text-[10px] font-mono">
                  <span style={{ color: '#333' }}>MC </span>
                  <span style={{ color: pxColor }}>{fmt(liveMc)}</span>
                </span>
              )
            })()}
          </div>
          {/* Line 2: F · L */}
          <div className="flex gap-3">
            <span className="text-[10px] font-mono">
              <span style={{ color: '#333' }}>F </span>
              <span style={{ color: '#555' }}>{fmtSOL(signal.fees_est_sol)}</span>
            </span>
            <span className="text-[10px] font-mono">
              <span style={{ color: '#333' }}>L </span>
              <span style={{ color: '#555' }}>{fmt(signal.liquidity_usd)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Section B: Bottom strip ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-t border-[#181818] pt-2 mt-0 mx-2.5 mb-2.5">
        {/* LEFT: BP bar + % */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <div className="flex-1 h-1 rounded-full overflow-hidden bg-[#1a1a1a] flex">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${signal.buy_pressure}%`, background: '#00ff88', opacity: 0.7 }}
            />
            <div
              className="h-full"
              style={{ width: `${100 - signal.buy_pressure}%`, background: '#ff3355', opacity: 0.4 }}
            />
          </div>
          <span className="text-[9px] font-mono shrink-0" style={{ color: bpColor }}>{signal.buy_pressure}%</span>
        </div>

        {/* price change chip */}
        <span
          className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0"
          style={{ color: pxColor, background: `${pxColor}15`, border: `1px solid ${pxColor}30` }}
        >
          {pxSign}{signal.price_change_1h.toFixed(1)}%
        </span>

        {/* score expand · star · BUY */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowBreakdown(v => !v) }}
          className="text-[10px] font-mono text-[#333333] hover:text-[#666666] transition-colors h-7 px-2 flex items-center gap-1 cursor-pointer rounded-lg shrink-0"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {signal.scanner_score}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggle(signal.ca) }}
          className="w-7 h-7 flex items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0"
          style={isWatched ? { borderColor: '#ffcc0035', background: '#ffcc0010' } : { borderColor: '#1e1e1e' }}
          aria-label={isWatched ? 'Unwatch' : 'Watch'}
        >
          <StarIcon filled={isWatched} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onTrade(signal) }}
          className="h-7 px-3 text-[11px] font-mono font-bold rounded-xl border transition-all cursor-pointer shrink-0"
          style={{ borderColor: '#00d4ff30', color: '#00d4ff', background: '#00d4ff08' }}
        >
          BUY
        </button>
      </div>

      {showBreakdown && (
        <div className="mx-2.5 mb-2.5 pt-2 border-t border-[#181818]">
          <ScoreBreakdownPanel breakdown={signal.score_breakdown} grade={signal.score_grade} />
        </div>
      )}
    </div>
  )
}
