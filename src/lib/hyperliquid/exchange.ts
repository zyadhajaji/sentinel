/**
 * Hyperliquid Exchange Client — Authenticated Trading
 *
 * All functions require a connected viem WalletClient.
 * Orders are signed locally (EIP-712) and sent to api.hyperliquid.xyz/exchange.
 * No API keys needed — fully non-custodial.
 */

import type { WalletClient } from 'viem'
import { signHLAction } from './signing'
import { getAllMids, getCoinIndexMap } from './client'
import type {
  HLPlaceOrderAction, HLCancelOrderAction, HLUpdateLeverageAction,
  HLOrderRequest, HLExchangeResponse, HLOrderType,
} from './types'

const HL_EXCHANGE = 'https://api.hyperliquid.xyz/exchange'

// ─────────────────────────────────────────────────────────────────────────────
// Core exchange POST
// ─────────────────────────────────────────────────────────────────────────────

async function hlExchangePost(signed: Awaited<ReturnType<typeof signHLAction>>): Promise<HLExchangeResponse> {
  const body: Record<string, unknown> = {
    action:    signed.action,
    nonce:     signed.nonce,
    signature: signed.signature,
  }
  if (signed.vaultAddress) body.vaultAddress = signed.vaultAddress

  const res = await fetch(HL_EXCHANGE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Hyperliquid exchange ${res.status}: ${text}`)
  }
  const data = await res.json() as HLExchangeResponse
  if (data.status === 'err') {
    throw new Error(`Hyperliquid rejected: ${data.response.msg ?? JSON.stringify(data.response)}`)
  }
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// Price formatting helper
// ─────────────────────────────────────────────────────────────────────────────

function fmtPrice(price: number): string {
  if (price >= 10_000) return price.toFixed(1)
  if (price >= 100)    return price.toFixed(2)
  if (price >= 1)      return price.toFixed(4)
  return price.toFixed(6)
}

function fmtSize(size: number, szDecimals = 4): string {
  return size.toFixed(szDecimals)
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaceOrderParams {
  coin: string            // e.g. "BTC", "ETH", "SOL"
  isBuy: boolean          // true = long, false = short
  size: number            // in coin units (e.g. 0.001 BTC)
  price?: number          // undefined = market order (uses Ioc + 5% slippage buffer)
  reduceOnly?: boolean    // close-only mode
  leverage?: number       // 1-100. If set, updateLeverage is called first
  isCross?: boolean       // true = cross margin (default), false = isolated
  tpPrice?: number        // take-profit trigger price
  slPrice?: number        // stop-loss trigger price
  szDecimals?: number     // size decimal precision (from meta, default 4)
}

/**
 * Place a market or limit order on Hyperliquid perps.
 * Optionally sets leverage and attaches TP/SL orders in the same group.
 */
export async function placeOrder(
  walletClient: WalletClient,
  params: PlaceOrderParams,
): Promise<HLExchangeResponse> {
  const coinMap = await getCoinIndexMap()
  const assetIdx = coinMap.get(params.coin)
  if (assetIdx === undefined) throw new Error(`Hyperliquid: unknown coin "${params.coin}"`)

  // Set leverage first if requested
  if (params.leverage !== undefined) {
    await updateLeverage(walletClient, params.coin, params.leverage, params.isCross ?? true)
  }

  const orders: HLOrderRequest[] = []
  const szDec = params.szDecimals ?? 4
  const sizeStr = fmtSize(params.size, szDec)
  const hasTpSl = params.tpPrice !== undefined || params.slPrice !== undefined

  // ── Main order ───────────────────────────────────────────────────────────
  let mainOrderType: HLOrderType
  let priceStr: string

  if (params.price === undefined) {
    // Market order: Ioc with aggressive price (5% slippage buffer)
    const mids = await getAllMids()
    const midPx = parseFloat(mids.mids[params.coin] ?? '0')
    if (midPx === 0) throw new Error(`Hyperliquid: no mid price for "${params.coin}"`)
    const aggressive = params.isBuy ? midPx * 1.05 : midPx * 0.95
    priceStr = fmtPrice(aggressive)
    mainOrderType = { limit: { tif: 'Ioc' } }
  } else {
    priceStr = fmtPrice(params.price)
    mainOrderType = { limit: { tif: 'Gtc' } }
  }

  orders.push({
    a: assetIdx,
    b: params.isBuy,
    p: priceStr,
    s: sizeStr,
    r: params.reduceOnly ?? false,
    t: mainOrderType,
  })

  // ── Take Profit ──────────────────────────────────────────────────────────
  if (params.tpPrice !== undefined) {
    orders.push({
      a: assetIdx,
      b: !params.isBuy,   // opposite side (closing)
      p: fmtPrice(params.tpPrice),
      s: sizeStr,
      r: true,
      t: { trigger: { isMarket: true, tpsl: 'tp', triggerPx: fmtPrice(params.tpPrice) } },
    })
  }

  // ── Stop Loss ────────────────────────────────────────────────────────────
  if (params.slPrice !== undefined) {
    orders.push({
      a: assetIdx,
      b: !params.isBuy,
      p: fmtPrice(params.slPrice),
      s: sizeStr,
      r: true,
      t: { trigger: { isMarket: true, tpsl: 'sl', triggerPx: fmtPrice(params.slPrice) } },
    })
  }

  const action: HLPlaceOrderAction = {
    type: 'order',
    orders,
    grouping: hasTpSl ? 'positionTpsl' : 'na',
  }

  const signed = await signHLAction(walletClient, action)
  return hlExchangePost(signed)
}

/**
 * Close an entire open position at market price.
 * @param isLong true if the position is long (sell to close), false if short (buy to close)
 */
export async function closePosition(
  walletClient: WalletClient,
  coin: string,
  size: number,
  isLong: boolean,
  szDecimals?: number,
): Promise<HLExchangeResponse> {
  return placeOrder(walletClient, {
    coin,
    isBuy:      !isLong,
    size,
    reduceOnly: true,
    szDecimals,
  })
}

/**
 * Cancel one or more open orders by oid.
 */
export async function cancelOrders(
  walletClient: WalletClient,
  cancels: { coin: string; oid: number }[],
): Promise<HLExchangeResponse> {
  const coinMap = await getCoinIndexMap()
  const action: HLCancelOrderAction = {
    type: 'cancel',
    cancels: cancels.map(({ coin, oid }) => {
      const a = coinMap.get(coin)
      if (a === undefined) throw new Error(`Hyperliquid: unknown coin "${coin}"`)
      return { a, o: oid }
    }),
  }
  const signed = await signHLAction(walletClient, action)
  return hlExchangePost(signed)
}

/**
 * Set leverage for a specific coin.
 * @param isCross true = cross margin, false = isolated
 */
export async function updateLeverage(
  walletClient: WalletClient,
  coin: string,
  leverage: number,
  isCross = true,
): Promise<HLExchangeResponse> {
  const coinMap = await getCoinIndexMap()
  const assetIdx = coinMap.get(coin)
  if (assetIdx === undefined) throw new Error(`Hyperliquid: unknown coin "${coin}"`)

  const action: HLUpdateLeverageAction = {
    type: 'updateLeverage',
    asset: assetIdx,
    isCross,
    leverage: Math.round(leverage),
  }
  const signed = await signHLAction(walletClient, action)
  return hlExchangePost(signed)
}
