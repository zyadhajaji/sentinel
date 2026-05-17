/**
 * MarketsTab — Hyperliquid Perp Trading
 *
 * Full Hyperliquid perpetuals interface:
 *   - Account overview (balance, PnL, margin)
 *   - Open positions with mark price + unrealized PnL
 *   - Open orders
 *   - All markets table (price, 24h change, OI, funding, volume)
 *   - Place order panel (slid in on market row click)
 */

import { useState, useMemo, useCallback } from 'react'
import { useHyperliquid } from '../contexts/HyperliquidContext'
import type { HLMarketRow, HLPositionRow, HLOrderRow } from '../lib/hyperliquid/types'
import { getCoinColor, getCoinFullName, POPULAR_MARKETS } from '../lib/hyperliquid/constants'
import {
  calcLiquidationPrice,
  DEFAULT_LEVERAGE,
} from '../lib/hyperliquid'

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function fmtUSD(n: number, compact = false): string {
  if (!isFinite(n)) return '—'
  if (compact) {
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
    return `$${n.toFixed(2)}`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

function fmtPct(n: number): string {
  if (!isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function fmtPrice(n: number): string {
  if (!isFinite(n)) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

function fmtSize(n: number, coin: string): string {
  if (!isFinite(n)) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K ${coin}`
  return `${n.toFixed(4)} ${coin}`
}

function fmtFunding(rate: number): string {
  // hourly → annualised % for display
  const annualised = rate * 24 * 365 * 100
  const sign = annualised >= 0 ? '+' : ''
  return `${sign}${annualised.toFixed(2)}% pa`
}

// ─────────────────────────────────────────────────────────────────────────────
// Place Order Panel
// ─────────────────────────────────────────────────────────────────────────────

interface OrderPanelProps {
  market: HLMarketRow
  accountBalance: number
  onClose: () => void
  onPlaceOrder: (params: {
    coin: string
    isBuy: boolean
    size: number
    price: number
    isMarket: boolean
    leverage: number
  }) => Promise<void>
  onSetLeverage: (coin: string, leverage: number, isCross?: boolean) => Promise<void>
}

function OrderPanel({ market, accountBalance, onClose, onPlaceOrder, onSetLeverage }: OrderPanelProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [sizeMode, setSizeMode] = useState<'usd' | 'pct'>('pct')
  const [sizeInput, setSizeInput] = useState('2')    // % of account
  const [leverage, setLeverage] = useState(DEFAULT_LEVERAGE)
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const markPx = market.markPx
  const coinColor = getCoinColor(market.coin)

  const sizeUsd = useMemo(() => {
    if (sizeMode === 'usd') return parseFloat(sizeInput) || 0
    const pct = parseFloat(sizeInput) || 0
    return accountBalance * (pct / 100) * leverage
  }, [sizeInput, sizeMode, accountBalance, leverage])

  const coinSize = sizeUsd / markPx

  const liqPrice = calcLiquidationPrice(markPx, leverage, side === 'buy')
  const priceDelta = Math.abs(markPx - liqPrice)
  const liqPct = (priceDelta / markPx) * 100

  async function handleSubmit() {
    setLastError(null)
    setIsSubmitting(true)
    try {
      await onSetLeverage(market.coin, leverage, true)
      await onPlaceOrder({
        coin: market.coin,
        isBuy: side === 'buy',
        size: parseFloat(coinSize.toFixed(6)),
        price: orderType === 'limit' ? (parseFloat(limitPrice) || markPx) : markPx,
        isMarket: orderType === 'market',
        leverage,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Order failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#080808] border-l border-[#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: coinColor }} />
          <span className="text-[13px] font-bold text-[#e6e6e6] font-mono">{market.coin}-PERP</span>
          <span className="text-[11px] font-mono text-[#555]">${fmtPrice(markPx)}</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-[#888] transition-colors cursor-pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Buy / Sell */}
        <div className="grid grid-cols-2 gap-1 bg-[#111] rounded-xl p-1">
          {(['buy', 'sell'] as const).map(s => (
            <button key={s} onClick={() => setSide(s)}
              className={`py-2.5 rounded-lg text-[12px] font-mono font-bold transition-all cursor-pointer ${
                side === s
                  ? s === 'buy'
                    ? 'bg-[#00ff8820] text-[#00ff88] border border-[#00ff8840]'
                    : 'bg-[#ff335520] text-[#ff3355] border border-[#ff335540]'
                  : 'text-[#444] border border-transparent hover:text-[#888]'
              }`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Order type */}
        <div className="flex gap-2">
          {(['market', 'limit'] as const).map(t => (
            <button key={t} onClick={() => setOrderType(t)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                orderType === t
                  ? 'bg-[#00d4ff10] text-[#00d4ff] border border-[#00d4ff30]'
                  : 'text-[#444] border border-[#1a1a1a] hover:text-[#666]'
              }`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Limit price (if limit order) */}
        {orderType === 'limit' && (
          <div>
            <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider block mb-1.5">Limit Price</label>
            <input
              type="number"
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              placeholder={fmtPrice(markPx)}
              className="w-full bg-[#0f0f0f] border border-[#222] rounded-lg px-3 py-2.5 text-[12px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#00d4ff50] transition-colors"
            />
          </div>
        )}

        {/* Size */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider">Size</label>
            <div className="flex gap-1">
              {(['pct', 'usd'] as const).map(m => (
                <button key={m} onClick={() => { setSizeMode(m); setSizeInput(m === 'pct' ? '2' : '100') }}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer transition-all ${
                    sizeMode === m ? 'bg-[#1a1a1a] text-[#e6e6e6]' : 'text-[#444] hover:text-[#666]'
                  }`}>
                  {m === 'pct' ? '%' : 'USD'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={sizeInput}
              onChange={e => setSizeInput(e.target.value)}
              className="flex-1 bg-[#0f0f0f] border border-[#222] rounded-lg px-3 py-2.5 text-[12px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#00d4ff50] transition-colors"
            />
            <span className="text-[11px] font-mono text-[#555]">{sizeMode === 'pct' ? '%' : 'USD'}</span>
          </div>
          {/* Quick size buttons */}
          <div className="flex gap-1 mt-2">
            {(sizeMode === 'pct' ? ['1', '2', '5', '10'] : ['50', '100', '250', '500']).map(v => (
              <button key={v} onClick={() => setSizeInput(v)}
                className="flex-1 text-[9px] font-mono py-1 rounded border border-[#1a1a1a] text-[#444] hover:text-[#888] hover:border-[#2a2a2a] transition-all cursor-pointer">
                {sizeMode === 'pct' ? `${v}%` : `$${v}`}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider">Leverage</label>
            <span className="text-[11px] font-mono text-[#00d4ff] font-bold">{leverage}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.min(market.maxLeverage, 50)}
            step={1}
            value={leverage}
            onChange={e => setLeverage(parseInt(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#00d4ff' }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] font-mono text-[#333]">1×</span>
            <span className="text-[9px] font-mono text-[#333]">{Math.min(market.maxLeverage, 50)}×</span>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-[#0f0f0f] rounded-xl border border-[#1a1a1a] p-3 space-y-2">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-[#444]">Order Size</span>
            <span className="text-[#888]">{fmtUSD(sizeUsd)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-[#444]">Coin Amount</span>
            <span className="text-[#888]">{fmtSize(coinSize, market.coin)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-[#444]">Margin Required</span>
            <span className="text-[#888]">{fmtUSD(sizeUsd / leverage)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono border-t border-[#1a1a1a] pt-2">
            <span className="text-[#444]">Est. Liq. Price</span>
            <span className="text-[#ffcc00]">${fmtPrice(liqPrice)} ({liqPct.toFixed(1)}%)</span>
          </div>
        </div>

        {lastError && (
          <div className="bg-[#ff335510] border border-[#ff335530] rounded-xl p-3">
            <p className="text-[10px] font-mono text-[#ff3355]">{lastError}</p>
          </div>
        )}

        {success && (
          <div className="bg-[#00ff8810] border border-[#00ff8830] rounded-xl p-3">
            <p className="text-[10px] font-mono text-[#00ff88]">✓ Order placed successfully</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || sizeUsd <= 0}
          className={`w-full py-3.5 rounded-xl font-mono font-bold text-[13px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            side === 'buy'
              ? 'bg-[#00ff8820] border border-[#00ff8840] text-[#00ff88] hover:bg-[#00ff8830]'
              : 'bg-[#ff335520] border border-[#ff335540] text-[#ff3355] hover:bg-[#ff335530]'
          }`}
        >
          {isSubmitting ? 'PLACING ORDER...' : `${side.toUpperCase()} ${market.coin}-PERP`}
        </button>

        <p className="text-center text-[9px] font-mono text-[#2a2a2a]">
          Powered by Hyperliquid · Self-custodial · EIP-712 signed
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Position Row
// ─────────────────────────────────────────────────────────────────────────────

function PositionRow({
  pos,
  onClose,
}: {
  pos: HLPositionRow
  onClose: (coin: string, size: number, isLong: boolean) => void
}) {
  const [closing, setClosing] = useState(false)
  const color = getCoinColor(pos.coin)
  const pnlColor = pos.unrealizedPnl >= 0 ? '#00ff88' : '#ff3355'

  async function handleClose() {
    setClosing(true)
    try {
      await onClose(pos.coin, pos.size, pos.side === 'Long')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#0f0f0f] hover:bg-[#0c0c0c] transition-colors">
      {/* Coin */}
      <div className="flex items-center gap-2 w-24 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[12px] font-mono font-bold text-[#e6e6e6]">{pos.coin}</span>
      </div>

      {/* Side + leverage */}
      <div className="w-20 shrink-0">
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
          pos.side === 'Long'
            ? 'bg-[#00ff8815] text-[#00ff88] border border-[#00ff8825]'
            : 'bg-[#ff335515] text-[#ff3355] border border-[#ff335525]'
        }`}>
          {pos.side.toUpperCase()}
        </span>
        <span className="text-[9px] font-mono text-[#444] ml-1">{pos.leverage}×</span>
      </div>

      {/* Size */}
      <div className="hidden sm:block flex-1 min-w-0">
        <p className="text-[11px] font-mono text-[#888]">{fmtSize(pos.size, pos.coin)}</p>
        <p className="text-[10px] font-mono text-[#444]">{fmtUSD(pos.sizeUsd)}</p>
      </div>

      {/* Entry / Mark */}
      <div className="hidden md:block flex-1 min-w-0">
        <p className="text-[11px] font-mono text-[#888]">${fmtPrice(pos.markPrice)}</p>
        <p className="text-[10px] font-mono text-[#444]">Entry ${fmtPrice(pos.entryPrice)}</p>
      </div>

      {/* PnL */}
      <div className="flex-1 min-w-0 text-right">
        <p className="text-[12px] font-mono font-bold tabular-nums" style={{ color: pnlColor }}>
          {pos.unrealizedPnl >= 0 ? '+' : ''}{fmtUSD(pos.unrealizedPnl)}
        </p>
        <p className="text-[10px] font-mono tabular-nums" style={{ color: pnlColor }}>
          {fmtPct(pos.unrealizedPnlPct)}
        </p>
      </div>

      {/* Liq */}
      <div className="hidden lg:block w-24 text-right shrink-0">
        <p className="text-[10px] font-mono text-[#ffcc00] tabular-nums">
          {pos.liquidationPrice ? `$${fmtPrice(pos.liquidationPrice)}` : '—'}
        </p>
        <p className="text-[9px] font-mono text-[#333]">liq</p>
      </div>

      {/* Close */}
      <button
        onClick={handleClose}
        disabled={closing}
        className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-[#ff3355] border border-[#ff335525] bg-[#ff335508] hover:bg-[#ff335515] transition-all cursor-pointer disabled:opacity-50"
      >
        {closing ? '...' : 'CLOSE'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Row
// ─────────────────────────────────────────────────────────────────────────────

function OrderRow({ order, onCancel }: { order: HLOrderRow; onCancel: (coin: string, oid: number) => void }) {
  const [cancelling, setCancelling] = useState(false)
  const color = getCoinColor(order.coin)

  async function handleCancel() {
    setCancelling(true)
    try { await onCancel(order.coin, order.oid) } finally { setCancelling(false) }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#0f0f0f] hover:bg-[#0c0c0c] transition-colors">
      <div className="flex items-center gap-2 w-24 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[12px] font-mono text-[#e6e6e6]">{order.coin}</span>
      </div>
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded w-12 text-center ${
        order.side === 'Buy' ? 'text-[#00ff88] bg-[#00ff8815]' : 'text-[#ff3355] bg-[#ff335515]'
      }`}>
        {order.side.toUpperCase()}
      </span>
      <span className="flex-1 text-[11px] font-mono text-[#888] tabular-nums">{order.size} @ ${fmtPrice(order.price)}</span>
      <span className="text-[10px] font-mono text-[#444]">{order.orderType}</span>
      <button
        onClick={handleCancel}
        disabled={cancelling}
        className="px-2 py-1 rounded text-[9px] font-mono text-[#ff3355] border border-[#ff335520] hover:bg-[#ff335510] transition-all cursor-pointer disabled:opacity-50"
      >
        {cancelling ? '...' : '✕'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Row
// ─────────────────────────────────────────────────────────────────────────────

function MarketRow({
  market,
  midPrice,
  onClick,
  isSelected,
}: {
  market: HLMarketRow
  midPrice: number
  onClick: () => void
  isSelected: boolean
}) {
  const color = getCoinColor(market.coin)
  const priceChange = market.priceChange24h
  const changeColor = priceChange >= 0 ? '#00ff88' : '#ff3355'
  const fundingColor = market.fundingRate >= 0 ? '#00d4ff' : '#ff9900'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-2.5 border-b border-[#0a0a0a] hover:bg-[#0c0c0c] transition-colors text-left cursor-pointer ${
        isSelected ? 'bg-[#00d4ff05] border-l-2 border-l-[#00d4ff30]' : ''
      }`}
    >
      {/* Coin name */}
      <div className="flex items-center gap-2 w-28 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <div>
          <span className="text-[12px] font-mono font-bold text-[#e6e6e6]">{market.coin}</span>
          <span className="text-[9px] font-mono text-[#333] ml-1">-PERP</span>
        </div>
      </div>

      {/* Price */}
      <div className="w-28 shrink-0 text-right">
        <span className="text-[12px] font-mono tabular-nums text-[#e6e6e6]">
          ${fmtPrice(midPrice > 0 ? midPrice : market.markPx)}
        </span>
      </div>

      {/* 24h change */}
      <div className="w-20 shrink-0 text-right">
        <span className="text-[11px] font-mono tabular-nums font-bold" style={{ color: changeColor }}>
          {fmtPct(priceChange)}
        </span>
      </div>

      {/* Funding */}
      <div className="hidden sm:block w-28 shrink-0 text-right">
        <span className="text-[10px] font-mono tabular-nums" style={{ color: fundingColor }}>
          {(market.fundingRate * 100).toFixed(4)}%/h
        </span>
      </div>

      {/* OI */}
      <div className="hidden md:block w-24 shrink-0 text-right">
        <span className="text-[10px] font-mono tabular-nums text-[#555]">
          {fmtUSD(market.openInterest * market.markPx, true)}
        </span>
      </div>

      {/* Volume */}
      <div className="hidden lg:block flex-1 text-right">
        <span className="text-[10px] font-mono tabular-nums text-[#555]">
          {fmtUSD(market.volume24h, true)}
        </span>
      </div>

      {/* Max lev */}
      <div className="hidden xl:block w-14 shrink-0 text-right">
        <span className="text-[10px] font-mono text-[#333]">{market.maxLeverage}×</span>
      </div>

      {/* Trade CTA */}
      <div className="w-16 shrink-0 text-right">
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
          isSelected
            ? 'border-[#00d4ff50] text-[#00d4ff] bg-[#00d4ff10]'
            : 'border-[#1e1e1e] text-[#444] group-hover:border-[#2a2a2a]'
        }`}>
          {isSelected ? 'OPEN' : 'TRADE'}
        </span>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Connect Wallet CTA
// ─────────────────────────────────────────────────────────────────────────────

function ConnectWalletCTA({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-[#00d4ff08] border border-[#00d4ff15]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <circle cx="12" cy="14" r="2" />
        </svg>
      </div>
      <h3 className="text-[14px] font-bold text-[#e6e6e6] mb-1">Connect EVM Wallet</h3>
      <p className="text-[11px] font-mono text-[#444] leading-relaxed max-w-[240px] mb-4">
        Connect MetaMask or any EVM wallet to trade Hyperliquid perps directly from the terminal
      </p>
      <button
        onClick={onConnect}
        className="px-6 py-2.5 rounded-xl text-[12px] font-mono font-bold bg-[#00d4ff10] border border-[#00d4ff40] text-[#00d4ff] hover:bg-[#00d4ff20] hover:border-[#00d4ff60] transition-all cursor-pointer"
      >
        CONNECT WALLET
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#141414] rounded-xl p-3">
      <p className="text-[9px] font-mono text-[#444] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[16px] font-bold tabular-nums" style={{ color: valueColor ?? '#e6e6e6', fontFamily: "'Inter', sans-serif" }}>
        {value}
      </p>
      {sub && <p className="text-[10px] font-mono text-[#333] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MarketsTab
// ─────────────────────────────────────────────────────────────────────────────

type SubTab = 'markets' | 'positions' | 'orders'

export function MarketsTab() {
  const hl = useHyperliquid()
  const [subTab, setSubTab] = useState<SubTab>('markets')
  const [selectedMarket, setSelectedMarket] = useState<HLMarketRow | null>(null)
  const [search, setSearch] = useState('')
  const [showFavourites, setShowFavourites] = useState(false)

  const openCount   = hl.positions.length
  const orderCount  = hl.orders.length

  // Sort markets: popular first, then by 24h volume
  const sortedMarkets = useMemo(() => {
    let base = [...hl.markets]
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      base = base.filter(m => m.coin.includes(q) || getCoinFullName(m.coin).toUpperCase().includes(q))
    }
    if (showFavourites) {
      base = base.filter(m => (POPULAR_MARKETS as readonly string[]).includes(m.coin))
    }
    return base.sort((a, b) => {
      const aFav = (POPULAR_MARKETS as readonly string[]).indexOf(a.coin)
      const bFav = (POPULAR_MARKETS as readonly string[]).indexOf(b.coin)
      if (aFav !== -1 && bFav !== -1) return aFav - bFav
      if (aFav !== -1) return -1
      if (bFav !== -1) return 1
      return b.volume24h - a.volume24h
    })
  }, [hl.markets, search, showFavourites])

  const handleClosePosition = useCallback(
    (coin: string, size: number, isLong: boolean) => hl.closePosition(coin, size, isLong),
    [hl]
  )

  const handleCancelOrder = useCallback(
    (coin: string, oid: number) => hl.cancelOrder(coin, oid),
    [hl]
  )

  const handlePlaceOrder = useCallback(
    async (params: { coin: string; isBuy: boolean; size: number; price: number; isMarket: boolean; leverage: number }) => {
      await hl.placeOrder({
        coin: params.coin,
        isBuy: params.isBuy,
        size: params.size,
        price: params.isMarket ? undefined : params.price,
        leverage: params.leverage,
        isCross: true,
      })
    },
    [hl]
  )

  const pnlColor = hl.totalPnl === 0 ? '#555' : hl.totalPnl > 0 ? '#00ff88' : '#ff3355'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main panel */}
      <div className={`flex flex-col flex-1 min-w-0 overflow-hidden ${selectedMarket ? 'hidden lg:flex' : 'flex'}`}>
        {/* Account bar */}
        <div className="shrink-0 bg-[#080808] border-b border-[#141414]">
          {!hl.isConnected ? (
            <ConnectWalletCTA onConnect={hl.connectWallet} />
          ) : (
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard
                  label="Account Value"
                  value={fmtUSD(hl.accountValue)}
                  sub={`${hl.address?.slice(0, 6)}…${hl.address?.slice(-4)}`}
                />
                <StatCard
                  label="Available"
                  value={fmtUSD(hl.availableBalance)}
                  sub="withdrawable USDC"
                />
                <StatCard
                  label="Unrealized PnL"
                  value={`${hl.totalPnl >= 0 ? '+' : ''}${fmtUSD(hl.totalPnl)}`}
                  sub={`${openCount} position${openCount !== 1 ? 's' : ''}`}
                  valueColor={pnlColor}
                />
                <StatCard
                  label="Open Orders"
                  value={String(orderCount)}
                  sub="limit / tp / sl"
                />
              </div>
              {hl.lastError && (
                <p className="mt-2 text-[10px] font-mono text-[#ff3355] bg-[#ff335508] border border-[#ff335520] rounded-lg px-3 py-2">
                  {hl.lastError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[#141414] shrink-0 bg-[#080808]">
          {([
            { id: 'markets' as const, label: 'MARKETS', count: hl.markets.length },
            { id: 'positions' as const, label: 'POSITIONS', count: openCount },
            { id: 'orders' as const, label: 'ORDERS', count: orderCount },
          ]).map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                subTab === t.id
                  ? 'bg-[#141414] text-[#e6e6e6] border border-[#2a2a2a]'
                  : 'text-[#555] hover:text-[#888] border border-transparent'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-[9px] px-1 rounded ${
                  subTab === t.id ? 'text-[#00d4ff]' : 'text-[#444]'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}

          {/* Loading indicator */}
          {(hl.isLoadingMarkets || hl.isLoadingAccount) && (
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
              <span className="text-[9px] font-mono text-[#333]">syncing</span>
            </div>
          )}

          <button
            onClick={hl.refreshMarkets}
            className="ml-auto text-[#333] hover:text-[#555] transition-colors cursor-pointer"
            title="Refresh"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Markets */}
          {subTab === 'markets' && (
            <>
              {/* Search + filter */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[#0f0f0f] bg-[#080808] sticky top-0 z-10">
                <div className="flex-1 flex items-center gap-2 bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg px-2.5 py-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search markets…"
                    className="flex-1 bg-transparent text-[11px] font-mono text-[#e6e6e6] placeholder-[#2a2a2a] outline-none"
                  />
                </div>
                <button
                  onClick={() => setShowFavourites(f => !f)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                    showFavourites
                      ? 'bg-[#00d4ff10] border border-[#00d4ff30] text-[#00d4ff]'
                      : 'bg-[#0f0f0f] border border-[#1a1a1a] text-[#444] hover:text-[#666]'
                  }`}>
                  ★ TOP
                </button>
              </div>

              {/* Table header */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[#0f0f0f] bg-[#060606] sticky top-[45px] z-10">
                <span className="w-28 shrink-0 text-[9px] font-mono text-[#333] uppercase tracking-wider">Market</span>
                <span className="w-28 shrink-0 text-[9px] font-mono text-[#333] uppercase tracking-wider text-right">Price</span>
                <span className="w-20 shrink-0 text-[9px] font-mono text-[#333] uppercase tracking-wider text-right">24h</span>
                <span className="hidden sm:block w-28 shrink-0 text-[9px] font-mono text-[#333] uppercase tracking-wider text-right">Funding/h</span>
                <span className="hidden md:block w-24 shrink-0 text-[9px] font-mono text-[#333] uppercase tracking-wider text-right">Open Int.</span>
                <span className="hidden lg:block flex-1 text-[9px] font-mono text-[#333] uppercase tracking-wider text-right">24h Vol</span>
                <span className="hidden xl:block w-14 shrink-0 text-[9px] font-mono text-[#333] uppercase tracking-wider text-right">Max Lev</span>
                <span className="w-16 shrink-0" />
              </div>

              {/* Market rows */}
              {sortedMarkets.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-[#333] font-mono text-[11px]">
                    {hl.isLoadingMarkets ? 'Loading markets…' : 'No markets found'}
                  </p>
                </div>
              ) : (
                sortedMarkets.map(market => (
                  <MarketRow
                    key={market.coin}
                    market={market}
                    midPrice={hl.allMids[market.coin] ?? 0}
                    onClick={() => setSelectedMarket(m => m?.coin === market.coin ? null : market)}
                    isSelected={selectedMarket?.coin === market.coin}
                  />
                ))
              )}
            </>
          )}

          {/* Positions */}
          {subTab === 'positions' && (
            <>
              {!hl.isConnected ? (
                <ConnectWalletCTA onConnect={hl.connectWallet} />
              ) : hl.positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <p className="text-[#333] font-mono text-[11px]">No open positions</p>
                  <button onClick={() => setSubTab('markets')}
                    className="text-[10px] font-mono text-[#00d4ff] hover:underline cursor-pointer">
                    Browse Markets →
                  </button>
                </div>
              ) : (
                <>
                  {/* Positions header */}
                  <div className="flex items-center gap-3 px-4 py-2 border-b border-[#0f0f0f] bg-[#060606] sticky top-0 z-10">
                    <span className="w-24 shrink-0 text-[9px] font-mono text-[#333] uppercase">Coin</span>
                    <span className="w-20 shrink-0 text-[9px] font-mono text-[#333] uppercase">Side</span>
                    <span className="hidden sm:block flex-1 text-[9px] font-mono text-[#333] uppercase">Size</span>
                    <span className="hidden md:block flex-1 text-[9px] font-mono text-[#333] uppercase">Mark Price</span>
                    <span className="flex-1 text-[9px] font-mono text-[#333] uppercase text-right">Unreal. PnL</span>
                    <span className="hidden lg:block w-24 text-[9px] font-mono text-[#333] uppercase text-right">Liq Price</span>
                    <span className="w-16 shrink-0" />
                  </div>
                  {hl.positions.map(pos => (
                    <PositionRow key={pos.coin} pos={pos} onClose={handleClosePosition} />
                  ))}
                </>
              )}
            </>
          )}

          {/* Orders */}
          {subTab === 'orders' && (
            <>
              {!hl.isConnected ? (
                <ConnectWalletCTA onConnect={hl.connectWallet} />
              ) : hl.orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <p className="text-[#333] font-mono text-[11px]">No open orders</p>
                </div>
              ) : (
                hl.orders.map(order => (
                  <OrderRow key={order.oid} order={order} onCancel={handleCancelOrder} />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Order panel (side panel on desktop, full screen on mobile) */}
      {selectedMarket && (
        <div className={`shrink-0 overflow-hidden ${
          selectedMarket ? 'flex flex-col' : 'hidden'
        } w-full lg:w-[340px] border-l border-[#141414]`}>
          {hl.isConnected ? (
            <OrderPanel
              market={selectedMarket}
              accountBalance={hl.availableBalance}
              onClose={() => setSelectedMarket(null)}
              onPlaceOrder={handlePlaceOrder}
              onSetLeverage={hl.setLeverage}
            />
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                <span className="text-[12px] font-mono font-bold text-[#e6e6e6]">{selectedMarket.coin}-PERP</span>
                <button onClick={() => setSelectedMarket(null)} className="text-[#444] hover:text-[#888] cursor-pointer">✕</button>
              </div>
              <div className="flex-1 flex items-center justify-center p-6">
                <ConnectWalletCTA onConnect={hl.connectWallet} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
