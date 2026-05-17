/**
 * useHLCandles — OHLCV data for lightweight-charts
 *
 * Fetches historical bars then subscribes to live candle updates via WebSocket.
 * Returns bars in lightweight-charts format (time in Unix seconds).
 *
 * Usage:
 *   const { bars, isLoading } = useHLCandles('BTC', '15m')
 *   // Pass `bars` directly to lightweight-charts setData()
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getCandleSnapshot } from '../lib/hyperliquid/client'
import { getHyperliquidWS } from '../lib/hyperliquid/ws'
import type { OHLCVBar, HLCandle, HLInterval } from '../lib/hyperliquid/types'

// How many historical bars to fetch
const HISTORY_BARS: Record<HLInterval, number> = {
  '1m':  500,
  '3m':  500,
  '5m':  500,
  '15m': 300,
  '30m': 300,
  '1h':  200,
  '2h':  200,
  '4h':  150,
  '8h':  150,
  '12h': 100,
  '1d':  100,
  '3d':  100,
  '1w':  52,
  '2w':  52,
  '1M':  24,
}

// Interval in milliseconds for start-time calculation
const INTERVAL_MS: Record<HLInterval, number> = {
  '1m':  60_000,
  '3m':  3 * 60_000,
  '5m':  5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h':  60 * 60_000,
  '2h':  2 * 60 * 60_000,
  '4h':  4 * 60 * 60_000,
  '8h':  8 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1d':  24 * 60 * 60_000,
  '3d':  3 * 24 * 60 * 60_000,
  '1w':  7 * 24 * 60 * 60_000,
  '2w':  14 * 24 * 60 * 60_000,
  '1M':  30 * 24 * 60 * 60_000,
}

function hlCandleToBar(c: HLCandle): OHLCVBar {
  return {
    time:   Math.floor(c.t / 1000),   // ms → seconds for lightweight-charts
    open:   parseFloat(c.o),
    high:   parseFloat(c.h),
    low:    parseFloat(c.l),
    close:  parseFloat(c.c),
    volume: parseFloat(c.v),
  }
}

export interface UseHLCandlesResult {
  bars:      OHLCVBar[]
  isLoading: boolean
  error:     string | null
}

export function useHLCandles(coin: string, interval: HLInterval): UseHLCandlesResult {
  const [bars,      setBars]      = useState<OHLCVBar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const barsRef   = useRef<OHLCVBar[]>([])
  const activeRef = useRef(true)

  // Fetch historical bars
  useEffect(() => {
    activeRef.current = true
    setIsLoading(true)
    setBars([])
    barsRef.current = []

    const numBars  = HISTORY_BARS[interval] ?? 200
    const ms       = INTERVAL_MS[interval] ?? 60_000
    const endTime  = Date.now()
    const startTime = endTime - numBars * ms

    getCandleSnapshot(coin, interval, startTime, endTime)
      .then(candles => {
        if (!activeRef.current) return
        const converted = candles.map(hlCandleToBar)
        barsRef.current = converted
        setBars(converted)
        setError(null)
      })
      .catch(e => {
        if (activeRef.current) setError(e instanceof Error ? e.message : 'Candle fetch failed')
      })
      .finally(() => {
        if (activeRef.current) setIsLoading(false)
      })

    return () => { activeRef.current = false }
  }, [coin, interval])

  // Subscribe to live candle updates via WebSocket
  useEffect(() => {
    const ws = getHyperliquidWS()
    const unsub = ws.onCandle(coin, interval, (candle: HLCandle) => {
      const bar = hlCandleToBar(candle)
      setBars(prev => {
        const last = prev[prev.length - 1]
        if (!last) return [bar]

        if (last.time === bar.time) {
          // Update the current (in-progress) bar
          const next = [...prev]
          next[next.length - 1] = bar
          barsRef.current = next
          return next
        } else if (bar.time > last.time) {
          // New bar
          const next = [...prev, bar]
          barsRef.current = next
          return next
        }
        return prev  // out-of-order — ignore
      })
    })
    return unsub
  }, [coin, interval])

  return { bars, isLoading, error }
}
