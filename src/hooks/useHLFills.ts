/**
 * useHLFills — trade fill history for a Hyperliquid address
 *
 * Fetches historical fills via REST and subscribes to live fill events via
 * WebSocket. Parses closed P&L, fee, and direction from raw HL fill data.
 *
 * Usage:
 *   const { fills, isLoading, error, refetch } = useHLFills(address)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getUserFills } from '../lib/hyperliquid/client'
import { getHyperliquidWS } from '../lib/hyperliquid/ws'
import type { HLFill } from '../lib/hyperliquid/types'

// ─────────────────────────────────────────────────────────────────────────────
// Parsed fill shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedFill {
  tid:         number       // trade id (unique)
  coin:        string
  side:        'Buy' | 'Sell'
  price:       number
  size:        number       // in coin units
  notional:    number       // price × size
  closedPnl:   number       // realised P&L (USD). 0 for opening fills.
  fee:         number       // fee paid (positive = paid)
  feeToken:    string       // usually "USDC"
  isTaker:     boolean      // crossed = taker
  isLiquidation: boolean
  time:        number       // Unix ms
  hash:        string       // tx hash
}

function parseFill(f: HLFill): ParsedFill {
  const price   = parseFloat(f.px)
  const size    = parseFloat(f.sz)
  return {
    tid:            f.tid,
    coin:           f.coin,
    side:           f.side === 'B' ? 'Buy' : 'Sell',
    price,
    size,
    notional:       price * size,
    closedPnl:      parseFloat(f.closedPnl),
    fee:            parseFloat(f.fee),
    feeToken:       f.feeToken,
    isTaker:        f.crossed,
    isLiquidation:  f.liquidationMarkPx !== null,
    time:           f.time,
    hash:           f.hash,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/** How many days back to fetch on initial load */
const INITIAL_HISTORY_DAYS = 30

export interface UseHLFillsResult {
  fills:     ParsedFill[]     // newest first
  isLoading: boolean
  error:     string | null
  refetch:   () => void
}

export function useHLFills(address: string | undefined): UseHLFillsResult {
  const [fills,     setFills]     = useState<ParsedFill[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const activeRef  = useRef(true)
  const seenTids   = useRef(new Set<number>())

  const fetchFills = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    try {
      const startTime = Date.now() - INITIAL_HISTORY_DAYS * 24 * 60 * 60_000
      const raw = await getUserFills(address, startTime)
      if (!activeRef.current) return

      // Sort newest first, deduplicate by tid
      const parsed = raw
        .map(parseFill)
        .sort((a, b) => b.time - a.time)

      seenTids.current = new Set(parsed.map(f => f.tid))
      setFills(parsed)
    } catch (e) {
      if (activeRef.current) {
        setError(e instanceof Error ? e.message : 'Fill fetch failed')
      }
    } finally {
      if (activeRef.current) setIsLoading(false)
    }
  }, [address])

  // Initial fetch + refetch on address change
  useEffect(() => {
    activeRef.current = true
    seenTids.current = new Set()
    setFills([])
    fetchFills()
    return () => { activeRef.current = false }
  }, [fetchFills])

  // Live fill updates via WebSocket
  useEffect(() => {
    if (!address) return
    const ws = getHyperliquidWS()

    const unsub = ws.onUserFills(address, (rawFills: HLFill[]) => {
      const newFills = rawFills
        .map(parseFill)
        .filter(f => !seenTids.current.has(f.tid))

      if (newFills.length === 0) return
      newFills.forEach(f => seenTids.current.add(f.tid))

      setFills(prev => {
        const combined = [...newFills, ...prev]
        combined.sort((a, b) => b.time - a.time)
        return combined
      })
    })

    return unsub
  }, [address])

  return {
    fills,
    isLoading,
    error,
    refetch: fetchFills,
  }
}
