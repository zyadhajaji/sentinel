/**
 * useHLMarkets — real-time Hyperliquid market list
 *
 * Fetches all perp markets and keeps them fresh every 15s.
 * Returns markets sorted by 24h volume descending.
 *
 * Usage:
 *   const { markets, isLoading, getMid } = useHLMarkets()
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMarkets, getAllMids } from '../lib/hyperliquid/client'
import { getHyperliquidWS } from '../lib/hyperliquid/ws'
import type { HLMarketRow, HLAllMidsData } from '../lib/hyperliquid/types'

const POLL_MS = 15_000

export interface UseHLMarketsResult {
  markets:   HLMarketRow[]
  isLoading: boolean
  error:     string | null
  /** Get numeric mid price for a coin. Returns undefined if not yet loaded. */
  getMid:    (coin: string) => number | undefined
  refresh:   () => Promise<void>
}

export function useHLMarkets(): UseHLMarketsResult {
  const [markets,   setMarkets]   = useState<HLMarketRow[]>([])
  const [mids,      setMids]      = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const activeRef = useRef(true)

  const fetchAll = useCallback(async () => {
    try {
      const [rows, midsData] = await Promise.all([getMarkets(), getAllMids()])
      if (!activeRef.current) return
      // Sort by 24h volume descending
      rows.sort((a, b) => b.volume24h - a.volume24h)
      setMarkets(rows)
      const numeric: Record<string, number> = {}
      for (const [coin, px] of Object.entries(midsData.mids)) {
        numeric[coin] = parseFloat(px)
      }
      setMids(numeric)
      setError(null)
    } catch (e) {
      if (activeRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to fetch markets')
      }
    } finally {
      if (activeRef.current) setIsLoading(false)
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    activeRef.current = true
    fetchAll()
    const id = setInterval(fetchAll, POLL_MS)
    return () => {
      activeRef.current = false
      clearInterval(id)
    }
  }, [fetchAll])

  // Live mid price updates via WebSocket
  useEffect(() => {
    const ws = getHyperliquidWS()
    const unsub = ws.onAllMids((data: HLAllMidsData) => {
      const numeric: Record<string, number> = {}
      for (const [coin, px] of Object.entries(data.mids)) {
        numeric[coin] = parseFloat(px)
      }
      setMids(prev => ({ ...prev, ...numeric }))
      // Update markPx in markets table too
      setMarkets(prev =>
        prev.map(m => {
          const newPx = numeric[m.coin]
          if (newPx === undefined || newPx === m.markPx) return m
          return {
            ...m,
            markPx: newPx,
            priceChange24h: m.prevDayPx > 0 ? ((newPx - m.prevDayPx) / m.prevDayPx) * 100 : 0,
          }
        })
      )
    })
    return unsub
  }, [])

  const getMid = useCallback((coin: string) => mids[coin], [mids])

  return { markets, isLoading, error, getMid, refresh: fetchAll }
}
