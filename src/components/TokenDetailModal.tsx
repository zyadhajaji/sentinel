import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import type { Signal } from '../types'
import { ScoreBreakdownPanel } from './ScoreBreakdownPanel'
import { formatUSD, formatPrice, shortCA, timeAgo } from '../lib/mockData'
import { getJupiterQuote, executeJupiterBuy, formatTokenAmount } from '../lib/jupiter'
import type { JupiterQuote } from '../lib/jupiter'

interface Props {
  signal: Signal
  onClose: () => void
}

type Tab = 'overview' | 'chart' | 'trade'

const SLIPPAGE_OPTIONS = [50, 100, 200, 500] // bps

const RUG_RISK_COLORS: Record<string, string> = {
  danger: '#ff3355',
  warn: '#ffcc00',
}

function StatRow({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#141414]">
      <span className="text-[11px] font-mono text-[#555555]">{label}</span>
      <div className="text-right">
        <span className="text-[12px] font-mono font-medium tabular-nums" style={{ color: color ?? '#e6e6e6' }}>{value}</span>
        {sub && <span className="text-[10px] font-mono text-[#444444] ml-1.5">{sub}</span>}
      </div>
    </div>
  )
}

function SafetyBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[11px] font-mono text-[#444444]">—</span>
  const color = score >= 700 ? '#00ff88' : score >= 500 ? '#ffcc00' : score >= 300 ? '#ff8c00' : '#ff3355'
  const label = score >= 700 ? 'SAFE' : score >= 500 ? 'MODERATE' : score >= 300 ? 'RISKY' : 'DANGER'
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2 py-0.5 rounded"
      style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label} ({score})
    </span>
  )
}

// ── Trade tab ─────────────────────────────────────────────────────────────────
function TradeTab({ signal }: { signal: Signal }) {
  const { connected, publicKey } = useWallet()
  const wallet = useWallet()
  const { setVisible } = useWalletModal()

  const [solAmount, setSolAmount] = useState('0.1')
  const [slippageBps, setSlippageBps] = useState(100)
  const [quote, setQuote] = useState<JupiterQuote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [txResult, setTxResult] = useState<{ status: 'ok' | 'error'; message: string } | null>(null)

  const parsedSol = parseFloat(solAmount) || 0

  // Auto-fetch quote when amount/slippage changes
  useEffect(() => {
    if (!parsedSol || parsedSol <= 0 || !signal.ca) return
    setQuote(null)
    setTxResult(null)
    const t = setTimeout(async () => {
      setQuoting(true)
      const q = await getJupiterQuote(signal.ca, parsedSol, slippageBps)
      setQuote(q)
      setQuoting(false)
    }, 400)
    return () => clearTimeout(t)
  }, [solAmount, slippageBps, signal.ca, parsedSol])

  async function handleBuy() {
    if (!quote || !connected) return
    setSwapping(true)
    setTxResult(null)
    const result = await executeJupiterBuy(quote, wallet)
    setSwapping(false)
    if (result.status === 'ok') {
      setTxResult({ status: 'ok', message: result.txid })
      setQuote(null)
    } else {
      setTxResult({ status: 'error', message: result.message })
    }
  }

  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0
  const impactColor = priceImpact > 5 ? '#ff3355' : priceImpact > 2 ? '#ffcc00' : '#00ff88'

  return (
    <div className="p-4 space-y-4">
      {/* Amount */}
      <div>
        <label className="text-[10px] font-mono text-[#555555] uppercase tracking-wider block mb-2">Amount (SOL)</label>
        <input
          type="number" value={solAmount} onChange={e => setSolAmount(e.target.value)}
          className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-[13px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#00d4ff40] transition-colors min-h-[44px]"
          placeholder="0.1" step="0.01" min="0"
        />
        <div className="flex gap-1.5 mt-2">
          {['0.05', '0.1', '0.25', '0.5', '1'].map(amt => (
            <button key={amt} onClick={() => setSolAmount(amt)}
              className={`flex-1 text-[10px] font-mono py-1.5 rounded border transition-all cursor-pointer min-h-[36px] ${
                solAmount === amt ? 'border-[#00d4ff40] text-[#00d4ff] bg-[#00d4ff08]' : 'border-[#1e1e1e] text-[#444444] hover:text-[#888888]'
              }`}>
              {amt}
            </button>
          ))}
        </div>
      </div>

      {/* Slippage */}
      <div>
        <label className="text-[10px] font-mono text-[#555555] uppercase tracking-wider block mb-2">Slippage</label>
        <div className="flex gap-1.5">
          {SLIPPAGE_OPTIONS.map(bps => (
            <button key={bps} onClick={() => setSlippageBps(bps)}
              className={`flex-1 text-[10px] font-mono py-1.5 rounded border transition-all cursor-pointer min-h-[36px] ${
                slippageBps === bps ? 'border-[#00d4ff40] text-[#00d4ff] bg-[#00d4ff08]' : 'border-[#1e1e1e] text-[#444444] hover:text-[#888888]'
              }`}>
              {bps / 100}%
            </button>
          ))}
        </div>
      </div>

      {/* Quote preview */}
      <div className="bg-[#0d0d0d] rounded-lg border border-[#1e1e1e] divide-y divide-[#141414]">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[10px] font-mono text-[#444444]">You receive</span>
          <span className="text-[12px] font-mono text-[#e6e6e6] tabular-nums">
            {quoting ? (
              <span className="text-[#333333] animate-pulse">quoting...</span>
            ) : quote ? (
              `~${formatTokenAmount(quote.outAmount)} ${signal.token_symbol}`
            ) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[10px] font-mono text-[#444444]">Price impact</span>
          <span className="text-[12px] font-mono tabular-nums" style={{ color: quote ? impactColor : '#444444' }}>
            {quote ? `${priceImpact.toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[10px] font-mono text-[#444444]">Route</span>
          <span className="text-[11px] font-mono text-[#666666]">
            {quote?.routePlan?.[0]?.swapInfo?.label ?? 'Jupiter best route'}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[10px] font-mono text-[#444444]">Priority fee</span>
          <span className="text-[11px] font-mono text-[#666666]">auto (fast landing)</span>
        </div>
      </div>

      {/* Tx result */}
      {txResult && (
        <div className={`rounded-lg px-3 py-2.5 text-[11px] font-mono border ${
          txResult.status === 'ok'
            ? 'bg-[#00ff8808] border-[#00ff8830] text-[#00ff88]'
            : 'bg-[#ff335508] border-[#ff335530] text-[#ff3355]'
        }`}>
          {txResult.status === 'ok' ? (
            <div>
              <span className="font-bold block mb-1">Swap submitted!</span>
              <a
                href={`https://solscan.io/tx/${txResult.message}`}
                target="_blank" rel="noopener noreferrer"
                className="underline opacity-70 break-all"
              >
                {txResult.message.slice(0, 20)}...{txResult.message.slice(-8)}
              </a>
            </div>
          ) : (
            <span>{txResult.message}</span>
          )}
        </div>
      )}

      {/* CTA */}
      {connected ? (
        <button
          onClick={handleBuy}
          disabled={!quote || swapping || quoting || parsedSol <= 0}
          className={`w-full py-3.5 rounded-lg font-display font-bold text-[14px] transition-all cursor-pointer ${
            quote && !swapping
              ? 'bg-[#00ff88] text-[#080808] hover:bg-[#00e67a] active:scale-[0.98]'
              : 'bg-[#1a1a1a] text-[#444444] cursor-not-allowed'
          }`}
        >
          {swapping ? 'SWAPPING...' : quoting ? 'QUOTING...' : `BUY ${signal.token_symbol}`}
        </button>
      ) : (
        <button onClick={() => setVisible(true)}
          className="w-full py-3.5 rounded-lg font-display font-bold text-[14px] border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] transition-all cursor-pointer">
          CONNECT WALLET
        </button>
      )}

      <p className="text-center text-[9px] font-mono text-[#333333]">
        Powered by Jupiter · Non-custodial · You sign every transaction
      </p>
      {connected && publicKey && (
        <p className="text-center text-[9px] font-mono text-[#333333]">
          Wallet: {publicKey.toString().slice(0, 6)}...{publicKey.toString().slice(-4)}
        </p>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function TokenDetailModal({ signal, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const pnlColor = signal.price_change_1h >= 0 ? '#00ff88' : '#ff3355'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-xl bg-[#0d0d0d] border border-[#222] md:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] shrink-0 bg-[#0a0a0a]">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-display font-bold text-[16px] text-[#e6e6e6]">{signal.token_symbol}</span>
                <span className="text-[11px] font-mono text-[#555555]">{signal.token_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(signal.ca).catch(() => {}) }}
                  className="text-[10px] font-mono text-[#444444] hover:text-[#888888] transition-colors cursor-pointer"
                  title="Copy CA"
                >
                  {shortCA(signal.ca)}
                </button>
                <span className="text-[#252525]">·</span>
                <span className="text-[10px] font-mono text-[#444444]">{timeAgo(signal.timestamp)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Grade badge */}
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded"
              style={{
                color: signal.score_grade === 'SAFE' ? '#00ff88' : signal.score_grade === 'WATCH' ? '#ffcc00' : '#ff3355',
                background: signal.score_grade === 'SAFE' ? '#00ff8815' : signal.score_grade === 'WATCH' ? '#ffcc0015' : '#ff335515',
                border: `1px solid ${signal.score_grade === 'SAFE' ? '#00ff8830' : signal.score_grade === 'WATCH' ? '#ffcc0030' : '#ff335530'}`,
              }}>
              {signal.score_grade} {signal.scanner_score}
            </span>
            <button onClick={onClose}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded border border-[#1e1e1e] text-[#555555] hover:text-[#e6e6e6] hover:border-[#333333] transition-all cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Price hero */}
        <div className="px-4 py-3 bg-[#080808] border-b border-[#1a1a1a] shrink-0">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-mono text-[#444444] mb-0.5">Price</p>
              <p className="text-[22px] font-mono font-bold text-[#e6e6e6] tabular-nums leading-none">
                ${formatPrice(signal.price_usd)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[20px] font-mono font-bold tabular-nums leading-none" style={{ color: pnlColor }}>
                {signal.price_change_1h >= 0 ? '+' : ''}{signal.price_change_1h.toFixed(1)}%
              </p>
              <p className="text-[10px] font-mono text-[#444444] mt-0.5">1h change</p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#1a1a1a] shrink-0 bg-[#080808]">
          {(['overview', 'chart', 'trade'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                tab === t
                  ? 'text-[#e6e6e6] border-b-2 border-[#00d4ff]'
                  : 'text-[#444444] hover:text-[#888888]'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'overview' && (
            <div className="p-4 space-y-4">
              {/* Core stats */}
              <div>
                <p className="text-[10px] font-mono text-[#333333] uppercase tracking-wider mb-2">Market</p>
                <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] divide-y divide-[#141414] px-4">
                  <StatRow label="Market Cap" value={formatUSD(signal.mcap_usd)} />
                  <StatRow label="Liquidity" value={formatUSD(signal.liquidity_usd)} />
                  <StatRow label="1h Volume" value={formatUSD(signal.volume_1h)} />
                  <StatRow label="Buy Pressure" value={`${signal.buy_pressure}%`}
                    color={signal.buy_pressure >= 60 ? '#00ff88' : signal.buy_pressure >= 40 ? '#ffcc00' : '#ff3355'} />
                  <StatRow label="Source" value={signal.source} />
                  <StatRow label="Age" value={
                    signal.contract_age_minutes < 60
                      ? `${signal.contract_age_minutes}m`
                      : `${Math.floor(signal.contract_age_minutes / 60)}h ${signal.contract_age_minutes % 60}m`
                  } />
                  {signal.holders !== null && <StatRow label="Holders" value={signal.holders.toLocaleString()} />}
                  {signal.top_holder_pct !== null && (
                    <StatRow label="Top Holder" value={`${signal.top_holder_pct.toFixed(1)}%`}
                      color={signal.top_holder_pct > 20 ? '#ff3355' : signal.top_holder_pct > 10 ? '#ffcc00' : '#00ff88'} />
                  )}
                </div>
              </div>

              {/* Safety */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono text-[#333333] uppercase tracking-wider">Safety</p>
                  <SafetyBadge score={signal.rug_score} />
                </div>
                <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] divide-y divide-[#141414] px-4">
                  <StatRow label="Mint Authority"
                    value={signal.mint_authority_revoked === true ? 'Revoked ✓' : signal.mint_authority_revoked === false ? 'LIVE ✗' : '—'}
                    color={signal.mint_authority_revoked === true ? '#00ff88' : signal.mint_authority_revoked === false ? '#ff3355' : '#444444'} />
                  <StatRow label="Freeze Authority"
                    value={signal.freeze_authority_revoked === true ? 'Revoked ✓' : signal.freeze_authority_revoked === false ? 'LIVE ✗' : '—'}
                    color={signal.freeze_authority_revoked === true ? '#00ff88' : signal.freeze_authority_revoked === false ? '#ff3355' : '#444444'} />
                </div>
                {signal.rug_risks.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {signal.rug_risks.map((risk, i) => {
                      const isWarn = risk.toLowerCase().startsWith('warn')
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono"
                          style={{
                            background: `${RUG_RISK_COLORS[isWarn ? 'warn' : 'danger']}08`,
                            border: `1px solid ${RUG_RISK_COLORS[isWarn ? 'warn' : 'danger']}20`,
                            color: RUG_RISK_COLORS[isWarn ? 'warn' : 'danger'],
                          }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          {risk}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Socials */}
              {(signal.twitter_url || signal.telegram_url || signal.website_url) && (
                <div>
                  <p className="text-[10px] font-mono text-[#333333] uppercase tracking-wider mb-2">Socials</p>
                  <div className="flex flex-wrap gap-2">
                    {signal.twitter_url && (
                      <a href={signal.twitter_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1e1e1e] text-[#888888] hover:text-[#e6e6e6] hover:border-[#333333] transition-all text-[11px] font-mono cursor-pointer">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Twitter / X
                      </a>
                    )}
                    {signal.telegram_url && (
                      <a href={signal.telegram_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1e1e1e] text-[#888888] hover:text-[#e6e6e6] hover:border-[#333333] transition-all text-[11px] font-mono cursor-pointer">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M21.5 2.5L2.5 9.5l7 2.5m12-9.5l-7 19-5-7m12-12l-12 9"/>
                        </svg>
                        Telegram
                      </a>
                    )}
                    {signal.website_url && (
                      <a href={signal.website_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1e1e1e] text-[#888888] hover:text-[#e6e6e6] hover:border-[#333333] transition-all text-[11px] font-mono cursor-pointer">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                        Website
                      </a>
                    )}
                    {signal.dex_url && (
                      <a href={signal.dex_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1e1e1e] text-[#888888] hover:text-[#e6e6e6] hover:border-[#333333] transition-all text-[11px] font-mono cursor-pointer">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        DexScreener
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Score breakdown */}
              <div>
                <p className="text-[10px] font-mono text-[#333333] uppercase tracking-wider mb-2">Score Breakdown</p>
                <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] p-4">
                  <ScoreBreakdownPanel breakdown={signal.score_breakdown} grade={signal.score_grade} />
                </div>
              </div>

              {/* Narrative tags */}
              {signal.narrative_tags.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-[#333333] uppercase tracking-wider mb-2">Narratives</p>
                  <div className="flex flex-wrap gap-1.5">
                    {signal.narrative_tags.map(tag => (
                      <span key={tag} className="text-[11px] font-mono px-2 py-1 rounded bg-[#1a1a1a] text-[#888888] border border-[#222]">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'chart' && (
            <div className="flex flex-col h-full">
              <iframe
                src={`https://dexscreener.com/solana/${signal.ca}?embed=1&loadChartSettings=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=1`}
                className="w-full flex-1 border-0"
                style={{ minHeight: '480px' }}
                title="DexScreener Chart"
                allow="clipboard-write"
              />
              <div className="px-4 py-2 border-t border-[#1a1a1a] flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#444444]">Chart by DexScreener</span>
                {signal.dex_url && (
                  <a href={signal.dex_url} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] font-mono text-[#00d4ff] hover:underline cursor-pointer">
                    Open full chart ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {tab === 'trade' && <TradeTab signal={signal} />}
        </div>
      </div>
    </div>
  )
}
