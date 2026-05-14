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
  pumpfun: '#ff8c00',
  raydium: '#9945ff',
  moonshot: '#00d4ff',
  jupiter: '#00ff88',
}

const NARRATIVE_COLORS: Record<string, string> = {
  AI: '#8b5cf6',
  MEME: '#ff8c00',
  ANIMAL: '#00ff88',
  GAMING: '#00d4ff',
  DEFI: '#ffcc00',
  CELEB: '#ff3355',
  SPACE: '#00d4ff',
  FOOD: '#ff8c00',
  PATRIOT: '#ff3355',
  SOLANA: '#9945ff',
}

function rugLabel(score: number | null): { text: string; color: string } | null {
  if (score === null) return null
  if (score >= 700) return null                                    // clean — show nothing
  if (score >= 500) return { text: '⚠ WARN', color: '#ffcc00' }  // moderate risk
  return { text: '☠ RUG', color: '#ff3355' }                     // high risk
}

export function TokenCard({ signal, isNew, onTrade }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const { watchlist, toggle } = useWatchlist()
  const isWatched = watchlist.has(signal.ca)

  const priceChangeColor = signal.price_change_1h >= 0 ? '#00ff88' : '#ff3355'
  const priceChangeSign = signal.price_change_1h >= 0 ? '+' : ''
  const buyPressColor = signal.buy_pressure >= 60 ? '#00ff88' : signal.buy_pressure >= 40 ? '#ffcc00' : '#ff3355'
  const rug = rugLabel(signal.rug_score)

  function copyCA() {
    navigator.clipboard.writeText(signal.ca).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={clsx(
        'bg-[#141414] border rounded-xl p-4 transition-all duration-200',
        isNew
          ? 'border-[#00ff88] shadow-[0_0_24px_rgba(0,255,136,0.12)] animate-slide-in'
          : 'border-[#1e1e1e] active:border-[#2a2a2a]'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <ScoreRing score={signal.scanner_score} grade={signal.score_grade} size="md" />
          <div className="min-w-0">
            {/* Name + badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display font-bold text-[14px] text-[#e6e6e6] tracking-wide">
                {signal.token_symbol}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                style={{
                  color: SOURCE_COLORS[signal.source] || '#888888',
                  background: `${SOURCE_COLORS[signal.source] || '#888888'}18`,
                  border: `1px solid ${SOURCE_COLORS[signal.source] || '#888888'}30`,
                }}
              >
                {signal.source}
              </span>
              {signal.narrative_tags.slice(0, 1).map(tag => (
                <span key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                  style={{
                    color: NARRATIVE_COLORS[tag] || '#888888',
                    background: `${NARRATIVE_COLORS[tag] || '#888888'}15`,
                    border: `1px solid ${NARRATIVE_COLORS[tag] || '#888888'}25`,
                  }}>
                  {tag}
                </span>
              ))}
              {rug && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 font-bold"
                  style={{ color: rug.color, background: `${rug.color}12`, border: `1px solid ${rug.color}30` }}
                >
                  {rug.text}
                </span>
              )}
              {isNew && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-mono text-[#00ff88] bg-[#00ff8812] border border-[#00ff8825] animate-pulse shrink-0">
                  NEW
                </span>
              )}
            </div>
            {/* Meta row — CA is tappable to copy */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <button
                onClick={copyCA}
                className="text-[11px] font-mono transition-colors min-h-[20px]"
                style={{ color: copied ? '#00ff88' : '#444444' }}
                title="Copy contract address"
              >
                {copied ? '✓ copied' : shortCA(signal.ca)}
              </button>
              <span className="text-[#2a2a2a]">·</span>
              <span className="text-[11px] text-[#555555]">{signal.contract_age_minutes}m</span>
              <span className="text-[#2a2a2a]">·</span>
              <span className="text-[11px] text-[#444444]">{timeAgo(signal.timestamp)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); toggle(signal.ca) }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[16px] rounded border transition-all"
            style={isWatched
              ? { borderColor: '#ffcc0040', color: '#ffcc00', background: '#ffcc0010' }
              : { borderColor: '#1e1e1e', color: '#444444' }
            }
            title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatched ? '★' : '☆'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onTrade(signal) }}
            className="min-h-[44px] px-3 text-[11px] font-mono font-bold rounded border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] active:bg-[#00d4ff25] transition-all"
          >
            TRADE
          </button>
          {signal.dex_url && (
            <a
              href={signal.dex_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[11px] font-mono rounded border border-[#1e1e1e] text-[#555555] hover:text-[#888888] active:bg-[#141414] transition-all"
            >
              ↗
            </a>
          )}
        </div>
      </div>

      {/* Stats grid — 2×2 on mobile, 4 across on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-[#0f0f0f] rounded-lg p-2.5">
          <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">MCap</p>
          <p className="text-[13px] font-mono text-[#e6e6e6] font-medium">{formatUSD(signal.mcap_usd)}</p>
        </div>
        <div className="bg-[#0f0f0f] rounded-lg p-2.5">
          <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">Liquidity</p>
          <p className="text-[13px] font-mono text-[#e6e6e6] font-medium">{formatUSD(signal.liquidity_usd)}</p>
        </div>
        <div className="bg-[#0f0f0f] rounded-lg p-2.5">
          <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">1h Change</p>
          <p className="text-[13px] font-mono font-bold" style={{ color: priceChangeColor }}>
            {priceChangeSign}{signal.price_change_1h.toFixed(1)}%
          </p>
        </div>
        <div className="bg-[#0f0f0f] rounded-lg p-2.5">
          <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-1">Buy Press</p>
          <p className="text-[13px] font-mono font-bold" style={{ color: buyPressColor }}>
            {signal.buy_pressure}%
          </p>
        </div>
      </div>

      {/* Bottom info row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-[#555555] font-mono flex-wrap">
          {signal.mint_authority_revoked !== null && (
            <span style={{ color: signal.mint_authority_revoked ? '#00ff88' : '#ff3355' }}>
              {signal.mint_authority_revoked ? '✓ Mint' : '✗ Mint'}
            </span>
          )}
          {signal.freeze_authority_revoked !== null && (
            <>
              <span className="text-[#2a2a2a]">·</span>
              <span style={{ color: signal.freeze_authority_revoked ? '#00ff88' : '#ff3355' }}>
                {signal.freeze_authority_revoked ? '✓ Freeze' : '✗ Freeze'}
              </span>
            </>
          )}
          {signal.top_holder_pct !== null && signal.top_holder_pct > 0 && (
            <>
              <span className="text-[#2a2a2a]">·</span>
              <span style={{ color: signal.top_holder_pct > 20 ? '#ff3355' : signal.top_holder_pct > 10 ? '#ffcc00' : '#555555' }}>
                Top {signal.top_holder_pct.toFixed(1)}%
              </span>
            </>
          )}
          {signal.fees_est_sol > 0.001 && (
            <>
              <span className="text-[#2a2a2a]">·</span>
              <span className="text-[#555555]">{signal.fees_est_sol.toFixed(3)} SOL fees</span>
            </>
          )}
        </div>
        <button
          onClick={() => setShowBreakdown(v => !v)}
          className="text-[11px] text-[#444444] hover:text-[#888888] font-mono transition-colors min-h-[36px] px-1 shrink-0"
        >
          {showBreakdown ? '▲' : '▼'} score
        </button>
      </div>

      {/* Score breakdown */}
      {showBreakdown && (
        <div className="mt-3 pt-3 border-t border-[#1e1e1e]">
          <ScoreBreakdownPanel breakdown={signal.score_breakdown} grade={signal.score_grade} />
        </div>
      )}
    </div>
  )
}
