/**
 * useHLOrderBook — live L2 order book for a Hyperliquid market
 *
 * Subscribes to WebSocket L2 book updates. Returns bids and asks
 * as sorted numeric arrays, ready to render a depth chart or order book table.
 *
 * Usage:
 *   const { bids, asks, spread, midPrice } = useHLOrderBook('BTC')
 */

import { useState, useEffect } from 'react'
import { getHyperliquidWS } from '../lib/hyperliquid/ws'
import type { HLL2Book, HLLevel } from '../lib/hyperliquid/types'

export interface OrderBookLevel {
  price:     number
  size:      number
  total:     number   // running cumulative size
  pctOfMax:  number   // for depth bar rendering (0-100)
}

export interface UseHLOrderBookResult {
  bids:      OrderBookLevel[]  // sorted high → low
  asks:      OrderBookLevel[]  // sorted low → high
  spread:    number            // ask[0].price - bid[0].price
  spreadPct: number            // spread as % of mid
  midPrice:  number
  isLoading: boolean
}

const MAX_LEVELS = 20

function parseLevels(raw: HLLevel[]): { price: number; size: number }[] {
  return raw.slice(0, MAX_LEVELS).map(l => ({
    price: parseFloat(l.px),
    size:  parseFloat(l.sz),
  }))
}

function enrichLevels(levels: { price: number; size: number }[]): OrderBookLevel[] {
  let running = 0
  const withTotal = levels.map(l => {
    running += l.size
    return { ...l, total: running }
  })
  const maxTotal = running
  return withTotal.map(l => ({
    ...l,
    pctOfMax: maxTotal > 0 ? (l.total / maxTotal) * 100 : 0,
  }))
}

export function useHLOrderBook(coin: string): UseHLOrderBookResult {
  const [bids,      setBids]      = useState<OrderBookLevel[]>([])
  const [asks,      setAsks]      = useState<OrderBookLevel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    setBids([])
    setAsks([])

    const ws = getHyperliquidWS()
    const unsub = ws.onL2Book(coin, (book: HLL2Book) => {
      // book.levels = [bids, asks]
      // bids: sorted high → low (best bid first)
      // asks: sorted low → high (best ask first)
      const rawBids = parseLevels(book.levels[0])
      const rawAsks = parseLevels(book.levels[1])
      setBids(enrichLevels(rawBids))
      setAsks(enrichLevels(rawAsks))
      setIsLoading(false)
    })

    return unsub
  }, [coin])

  // Derived values
  const bestBid  = bids[0]?.price ?? 0
  const bestAsk  = asks[0]?.price ?? 0
  const spread   = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0
  const midPrice = bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : 0
  const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0

  return { bids, asks, spread, spreadPct, midPrice, isLoading }
}
