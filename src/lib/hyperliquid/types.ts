/**
 * Hyperliquid API — TypeScript Types
 * Mirrors the Hyperliquid REST + WebSocket API surface exactly.
 * Used as the single source of truth for all HL data shapes in the app.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Market Metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface HLAssetMeta {
  name: string         // e.g. "BTC", "ETH", "SOL"
  szDecimals: number   // size precision
  maxLeverage: number  // max allowed leverage (e.g. 50)
  onlyIsolated?: boolean
}

export interface HLAssetContext {
  funding: string         // hourly funding rate (string float)
  openInterest: string    // open interest in coin units
  prevDayPx: string       // price 24h ago
  dayNtlVlm: string       // 24h notional volume in USD
  premium: string | null
  oraclePx: string        // oracle price
  markPx: string          // mark price
  midPx: string | null    // mid price (null if no liquidity)
  impactPxs: [string, string] | null  // [bid impact, ask impact]
}

export interface HLMeta {
  universe: HLAssetMeta[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Account / Positions
// ─────────────────────────────────────────────────────────────────────────────

export interface HLLeverage {
  type: 'isolated' | 'cross'
  value: number
  rawUsd: string
}

export interface HLCumFunding {
  allTime: string
  sinceOpen: string
  sinceChange: string
}

export interface HLPosition {
  coin: string
  szi: string            // signed size (negative = short)
  leverage: HLLeverage
  entryPx: string | null
  positionValue: string  // in USD
  unrealizedPnl: string  // in USD
  returnOnEquity: string // as fraction (0.05 = 5%)
  liquidationPx: string | null
  marginUsed: string
  maxTradeSzs: [string, string]
  cumFunding: HLCumFunding
}

export interface HLAssetPosition {
  position: HLPosition
  type: 'oneWay'
}

export interface HLMarginSummary {
  accountValue: string
  totalNtlPos: string
  totalRawUsd: string
  totalMarginUsed: string
}

export interface HLClearinghouseState {
  assetPositions: HLAssetPosition[]
  crossMaintenanceMarginUsed: string
  crossMarginSummary: HLMarginSummary
  marginSummary: HLMarginSummary
  time: number
  withdrawable: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

export type HLTimeInForce = 'Gtc' | 'Alo' | 'Ioc'

export type HLOrderType =
  | { limit: { tif: HLTimeInForce } }
  | { trigger: { isMarket: boolean; tpsl: 'tp' | 'sl'; triggerPx: string } }

export interface HLOrderRequest {
  a: number           // asset index
  b: boolean          // is_buy
  p: string           // price
  s: string           // size
  r: boolean          // reduce_only
  t: HLOrderType
  c?: string          // client order id (optional hex string)
}

export interface HLPlaceOrderAction {
  type: 'order'
  orders: HLOrderRequest[]
  grouping: 'na' | 'normalTpsl' | 'positionTpsl'
}

export interface HLCancelOrderAction {
  type: 'cancel'
  cancels: { a: number; o: number }[]
}

export interface HLUpdateLeverageAction {
  type: 'updateLeverage'
  asset: number
  isCross: boolean
  leverage: number
}

export type HLAction = HLPlaceOrderAction | HLCancelOrderAction | HLUpdateLeverageAction

export interface HLOpenOrder {
  coin: string
  limitPx: string
  sz: string
  side: 'A' | 'B'
  timestamp: number
  origSz: string
  oid: number
  cloid: string | null
  orderType: string
  reduceOnly: boolean
  tif: string | null
  triggerCondition: string
  triggerPx: string
  isTrigger: boolean
  isPositionTpsl: boolean
}

export interface HLOrderStatus {
  resting?: { oid: number }
  filled?: { totalSz: string; avgPx: string; oid: number }
  error?: string
}

export interface HLExchangeResponse {
  status: 'ok' | 'err'
  response: {
    type: 'order' | 'cancel' | 'error'
    data?: { statuses: HLOrderStatus[] }
    msg?: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Fills
// ─────────────────────────────────────────────────────────────────────────────

export interface HLFill {
  coin: string
  px: string
  sz: string
  side: 'A' | 'B'   // A = ask/sell, B = bid/buy
  time: number
  startPosition: string
  dir: string
  closedPnl: string
  hash: string
  oid: number
  crossed: boolean
  fee: string
  liquidationMarkPx: string | null
  tid: number
  feeToken: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Book (L2)
// ─────────────────────────────────────────────────────────────────────────────

export interface HLLevel {
  px: string   // price
  sz: string   // size
  n: number    // number of orders at this level
}

export interface HLL2Book {
  coin: string
  levels: [HLLevel[], HLLevel[]]   // [bids, asks]
  time: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Candles / OHLCV
// ─────────────────────────────────────────────────────────────────────────────

export type HLInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '2w' | '1M'

export interface HLCandle {
  t: number   // open time (ms)
  T: number   // close time (ms)
  s: string   // symbol (coin name)
  i: string   // interval
  o: string   // open price
  c: string   // close price
  h: string   // high price
  l: string   // low price
  v: string   // volume (base coin)
  n: number   // number of trades
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket
// ─────────────────────────────────────────────────────────────────────────────

export type HLWsSubscription =
  | { type: 'allMids' }
  | { type: 'l2Book'; coin: string }
  | { type: 'trades'; coin: string }
  | { type: 'candle'; coin: string; interval: HLInterval }
  | { type: 'userFills'; user: string }
  | { type: 'userEvents'; user: string }
  | { type: 'userNonFundingLedgerUpdates'; user: string }

export interface HLAllMidsData {
  mids: Record<string, string>   // coin → mid price string
}

export interface HLTradeData {
  coin: string
  side: 'A' | 'B'
  px: string
  sz: string
  time: number
  hash: string
  tid: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight-Charts Compatible
// ─────────────────────────────────────────────────────────────────────────────

/** OHLCV bar in the format expected by lightweight-charts */
export interface OHLCVBar {
  time: number    // Unix seconds
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

/** Enriched market row — combination of HLAssetMeta + HLAssetContext */
export interface HLMarketRow {
  coin: string
  index: number
  maxLeverage: number
  markPx: number
  oraclePx: number
  prevDayPx: number
  priceChange24h: number    // percentage
  fundingRate: number       // hourly as fraction (e.g. 0.0001)
  openInterest: number      // in coin units
  volume24h: number         // in USD
}

/** Derived position with numeric values + PnL */
export interface HLPositionRow {
  coin: string
  side: 'Long' | 'Short'
  size: number              // absolute size in coin
  sizeUsd: number           // position value in USD
  entryPrice: number
  markPrice: number
  unrealizedPnl: number     // in USD
  unrealizedPnlPct: number  // as percentage
  liquidationPrice: number | null
  leverage: number
  leverageType: 'cross' | 'isolated'
  marginUsed: number        // in USD
  fundingPaidTotal: number  // cumulative funding
}

/** Parsed open order */
export interface HLOrderRow {
  oid: number
  coin: string
  side: 'Buy' | 'Sell'
  size: number
  price: number
  orderType: 'Limit' | 'Market' | 'TP' | 'SL'
  reduceOnly: boolean
  timestamp: number
}
