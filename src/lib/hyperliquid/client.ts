/**
 * Hyperliquid Info Client — Public REST API
 * No authentication required. CORS-friendly (Hyperliquid allows browser calls).
 * All endpoints POST to https://api.hyperliquid.xyz/info
 */

import type {
  HLMeta, HLAssetContext, HLClearinghouseState, HLOpenOrder,
  HLFill, HLL2Book, HLCandle, HLInterval, HLAllMidsData,
  HLMarketRow, HLPositionRow, HLOrderRow,
} from './types'

const HL_INFO = 'https://api.hyperliquid.xyz/info'

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

async function hlPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(HL_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Hyperliquid API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Market data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all perp market metadata + current asset contexts in one call.
 * Returns [meta, assetContexts] — indices align (meta.universe[i] ↔ assetContexts[i]).
 */
export async function getMetaAndAssetCtxs(): Promise<[HLMeta, HLAssetContext[]]> {
  return hlPost<[HLMeta, HLAssetContext[]]>({ type: 'metaAndAssetCtxs' })
}

/** Get market metadata only (no prices). Lighter call for index lookups. */
export async function getMeta(): Promise<HLMeta> {
  return hlPost<HLMeta>({ type: 'meta' })
}

/** Get all current mid prices for all assets */
export async function getAllMids(): Promise<HLAllMidsData> {
  return hlPost<HLAllMidsData>({ type: 'allMids' })
}

/** Get L2 order book for a coin (top 20 bids + asks) */
export async function getL2Book(coin: string): Promise<HLL2Book> {
  return hlPost<HLL2Book>({ type: 'l2Book', coin, nSigFigs: 5 })
}

/**
 * Get OHLCV candle data.
 * @param coin    e.g. "BTC"
 * @param interval e.g. "15m", "1h", "1d"
 * @param startTime Unix ms timestamp
 * @param endTime   Unix ms timestamp
 */
export async function getCandleSnapshot(
  coin: string,
  interval: HLInterval,
  startTime: number,
  endTime: number,
): Promise<HLCandle[]> {
  return hlPost<HLCandle[]>({
    type: 'candleSnapshot',
    req: { coin, interval, startTime, endTime },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Account data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a user's full clearinghouse state — positions, margin summary, P&L.
 * @param address EVM wallet address (0x...)
 */
export async function getUserState(address: string): Promise<HLClearinghouseState> {
  return hlPost<HLClearinghouseState>({
    type: 'clearinghouseState',
    user: address.toLowerCase(),
  })
}

/** Get all open orders for a user */
export async function getOpenOrders(address: string): Promise<HLOpenOrder[]> {
  return hlPost<HLOpenOrder[]>({
    type: 'openOrders',
    user: address.toLowerCase(),
  })
}

/**
 * Get a user's trade fill history.
 * @param startTime  Optional Unix ms — fetch fills after this time
 */
export async function getUserFills(address: string, startTime?: number): Promise<HLFill[]> {
  return hlPost<HLFill[]>({
    type: 'userFills',
    user: address.toLowerCase(),
    ...(startTime !== undefined && { startTime }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Index helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Coin → asset index map. Cached + refreshed every 5 minutes. */
let _coinMap: Map<string, number> | null = null
let _coinMapTs = 0

export async function getCoinIndexMap(): Promise<Map<string, number>> {
  if (!_coinMap || Date.now() - _coinMapTs > 5 * 60_000) {
    const meta = await getMeta()
    _coinMap = new Map(meta.universe.map((a, i) => [a.name, i]))
    _coinMapTs = Date.now()
  }
  return _coinMap
}

/** Get the integer asset index for a coin name (throws if not found) */
export async function getCoinIndex(coin: string): Promise<number> {
  const map = await getCoinIndexMap()
  const idx = map.get(coin)
  if (idx === undefined) throw new Error(`Hyperliquid: unknown coin "${coin}"`)
  return idx
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived / enriched data helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch and enrich all markets into HLMarketRow[].
 * Combines meta + asset contexts into a flat, numeric structure.
 */
export async function getMarkets(): Promise<HLMarketRow[]> {
  const [meta, ctxs] = await getMetaAndAssetCtxs()
  return meta.universe.map((asset, i) => {
    const ctx = ctxs[i]!
    const markPx   = parseFloat(ctx.markPx)
    const prevPx   = parseFloat(ctx.prevDayPx)
    return {
      coin:          asset.name,
      index:         i,
      maxLeverage:   asset.maxLeverage,
      markPx,
      oraclePx:      parseFloat(ctx.oraclePx),
      prevDayPx:     prevPx,
      priceChange24h: prevPx > 0 ? ((markPx - prevPx) / prevPx) * 100 : 0,
      fundingRate:   parseFloat(ctx.funding),
      openInterest:  parseFloat(ctx.openInterest),
      volume24h:     parseFloat(ctx.dayNtlVlm),
    }
  })
}

/**
 * Fetch and parse user positions into HLPositionRow[].
 * Filters out zero-size positions.
 */
export async function getPositions(address: string, allMids?: Record<string, string>): Promise<HLPositionRow[]> {
  const state = await getUserState(address)
  const mids = allMids ?? (await getAllMids()).mids

  return state.assetPositions
    .filter(ap => parseFloat(ap.position.szi) !== 0)
    .map(ap => {
      const pos = ap.position
      const size = parseFloat(pos.szi)
      const isLong = size > 0
      const absSize = Math.abs(size)
      const entryPrice = parseFloat(pos.entryPx ?? '0')
      const markPrice = parseFloat(mids[pos.coin] ?? pos.positionValue)
      const unrealizedPnl = parseFloat(pos.unrealizedPnl)
      const posValue = parseFloat(pos.positionValue)
      const marginUsed = parseFloat(pos.marginUsed)
      const fundingPaid = parseFloat(pos.cumFunding.sinceOpen)

      return {
        coin:             pos.coin,
        side:             isLong ? 'Long' : 'Short',
        size:             absSize,
        sizeUsd:          posValue,
        entryPrice,
        markPrice,
        unrealizedPnl,
        unrealizedPnlPct: marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0,
        liquidationPrice: pos.liquidationPx ? parseFloat(pos.liquidationPx) : null,
        leverage:         pos.leverage.value,
        leverageType:     pos.leverage.type,
        marginUsed,
        fundingPaidTotal: fundingPaid,
      } satisfies HLPositionRow
    })
}

/**
 * Fetch and parse open orders into HLOrderRow[].
 */
export async function getParsedOpenOrders(address: string): Promise<HLOrderRow[]> {
  const orders = await getOpenOrders(address)
  return orders.map(o => {
    let orderType: HLOrderRow['orderType'] = 'Limit'
    if (o.isTrigger) {
      orderType = o.triggerCondition.toLowerCase().includes('tp') ? 'TP' : 'SL'
    } else if (o.orderType?.toLowerCase().includes('market')) {
      orderType = 'Market'
    }
    return {
      oid:       o.oid,
      coin:      o.coin,
      side:      o.side === 'B' ? 'Buy' : 'Sell',
      size:      parseFloat(o.sz),
      price:     parseFloat(o.limitPx),
      orderType,
      reduceOnly: o.reduceOnly,
      timestamp: o.timestamp,
    } satisfies HLOrderRow
  })
}
