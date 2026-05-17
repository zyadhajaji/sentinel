/**
 * Hyperliquid WebSocket Manager
 *
 * Single persistent WebSocket connection multiplexed across many subscribers.
 * Features:
 *   - Auto-reconnect with exponential backoff
 *   - Ping/pong keepalive (every 30s)
 *   - Re-subscribe all active channels after reconnect
 *   - Type-safe subscription + callback pattern
 *   - Singleton per app session
 */

import type {
  HLWsSubscription, HLAllMidsData, HLL2Book,
  HLCandle, HLTradeData, HLFill, HLInterval,
} from './types'

const HL_WS = 'wss://api.hyperliquid.xyz/ws'
const PING_INTERVAL_MS = 30_000
const BASE_RECONNECT_MS = 1_000
const MAX_RECONNECT_MS  = 30_000

type AnyHandler = (data: unknown) => void

interface ActiveSub {
  sub: HLWsSubscription
  handlers: Set<AnyHandler>
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket class
// ─────────────────────────────────────────────────────────────────────────────

export class HyperliquidWS {
  private ws: WebSocket | null = null
  private subs = new Map<string, ActiveSub>()
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectMs = BASE_RECONNECT_MS
  private destroyed = false

  constructor() {
    this.connect()
  }

  // ── Connection lifecycle ──────────────────────────────────────────────────

  private connect() {
    if (this.destroyed) return

    this.ws = new WebSocket(HL_WS)

    this.ws.onopen = () => {
      this.reconnectMs = BASE_RECONNECT_MS  // reset backoff on success

      // Re-subscribe all active channels after reconnect
      for (const { sub } of this.subs.values()) {
        this.sendRaw({ method: 'subscribe', subscription: sub })
      }

      // Start keepalive
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ method: 'ping' }))
        }
      }, PING_INTERVAL_MS)
    }

    this.ws.onmessage = (event: MessageEvent<string>) => {
      try {
        this.handleMessage(JSON.parse(event.data))
      } catch { /* malformed JSON — ignore */ }
    }

    this.ws.onclose = () => {
      clearInterval(this.pingTimer!)
      this.pingTimer = null
      if (!this.destroyed) this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      // Let onclose handle reconnect
      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectMs = Math.min(this.reconnectMs * 2, MAX_RECONNECT_MS)
      this.connect()
    }, this.reconnectMs)
  }

  private sendRaw(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  // ── Message routing ───────────────────────────────────────────────────────

  private handleMessage(msg: { channel?: string; data?: unknown }) {
    if (!msg.channel || msg.channel === 'pong') return
    const { channel, data } = msg

    for (const { sub, handlers } of this.subs.values()) {
      if (this.matches(channel, data, sub)) {
        for (const h of handlers) h(data)
      }
    }
  }

  private matches(channel: string, data: unknown, sub: HLWsSubscription): boolean {
    switch (sub.type) {
      case 'allMids':
        return channel === 'allMids'
      case 'l2Book':
        return channel === 'l2Book' && (data as HLL2Book).coin === sub.coin
      case 'trades': {
        if (channel !== 'trades') return false
        const trades = data as HLTradeData[]
        return trades.length > 0 && trades[0]!.coin === sub.coin
      }
      case 'candle': {
        if (channel !== 'candle') return false
        const c = data as HLCandle
        return c.s === sub.coin && c.i === sub.interval
      }
      case 'userFills':
        return channel === 'userFills'
      case 'userEvents':
        return channel === 'userEvents'
      case 'userNonFundingLedgerUpdates':
        return channel === 'userNonFundingLedgerUpdates'
      default:
        return false
    }
  }

  // ── Subscription management ───────────────────────────────────────────────

  private subKey(sub: HLWsSubscription): string {
    return JSON.stringify(sub)
  }

  /** Subscribe to a channel. Returns cleanup function. */
  subscribe(sub: HLWsSubscription, handler: AnyHandler): () => void {
    const key = this.subKey(sub)

    if (!this.subs.has(key)) {
      this.subs.set(key, { sub, handlers: new Set() })
      this.sendRaw({ method: 'subscribe', subscription: sub })
    }
    this.subs.get(key)!.handlers.add(handler)

    return () => {
      const s = this.subs.get(key)
      if (!s) return
      s.handlers.delete(handler)
      if (s.handlers.size === 0) {
        this.subs.delete(key)
        this.sendRaw({ method: 'unsubscribe', subscription: sub })
      }
    }
  }

  // ── Typed subscription helpers ────────────────────────────────────────────

  /** Real-time mid prices for ALL assets */
  onAllMids(handler: (data: HLAllMidsData) => void): () => void {
    return this.subscribe({ type: 'allMids' }, handler as AnyHandler)
  }

  /** Real-time L2 order book for a specific coin */
  onL2Book(coin: string, handler: (data: HLL2Book) => void): () => void {
    return this.subscribe({ type: 'l2Book', coin }, handler as AnyHandler)
  }

  /** Real-time trades for a coin */
  onTrades(coin: string, handler: (data: HLTradeData[]) => void): () => void {
    return this.subscribe({ type: 'trades', coin }, handler as AnyHandler)
  }

  /** Real-time candle updates for a coin + interval */
  onCandle(coin: string, interval: HLInterval, handler: (data: HLCandle) => void): () => void {
    return this.subscribe({ type: 'candle', coin, interval }, handler as AnyHandler)
  }

  /** Real-time fills for a user (requires subscribed address) */
  onUserFills(user: string, handler: (data: HLFill[]) => void): () => void {
    return this.subscribe({ type: 'userFills', user: user.toLowerCase() }, handler as AnyHandler)
  }

  /** Real-time account events (position changes, liquidations) */
  onUserEvents(user: string, handler: (data: unknown) => void): () => void {
    return this.subscribe({ type: 'userEvents', user: user.toLowerCase() }, handler as AnyHandler)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  destroy() {
    this.destroyed = true
    clearInterval(this.pingTimer!)
    clearTimeout(this.reconnectTimer!)
    this.ws?.close()
    _instance = null
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton — shared across all hooks
// ─────────────────────────────────────────────────────────────────────────────

let _instance: HyperliquidWS | null = null

/** Get (or create) the singleton WebSocket connection */
export function getHyperliquidWS(): HyperliquidWS {
  if (!_instance) _instance = new HyperliquidWS()
  return _instance
}

/** Destroy the singleton (call on app unmount or logout) */
export function destroyHyperliquidWS() {
  _instance?.destroy()
  _instance = null
}
