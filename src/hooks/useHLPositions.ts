/**
 * useHLPositions — live open positions for a Hyperliquid account
 *
 * Polls every 5s and applies real-time mid price updates from WebSocket
 * for instant unrealizedPnl changes between polls.
 *
 * Usage:
 *   const { positions, totalPnl, isLoading } = useHLPositions(address)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getPositions, getAllMids } from '../lib/hyperliquid/client'
import { getHyperliquidWS } from '../lib/hyperliquid/ws'
import type { HLPositionRow, HLAllMidsData } from '../lib/hyperliquid/types'

const POLL_MS = 5_000

export interface UseHLPositionsResult {
  positions:  HLPositionRow[]
  totalPnl:   number    // sum of unrealized PnL (USD)
  totalValue: number    // sum of position values (USD)
  isLoading:  boolean
  error:      string | null
  refresh:    () => Promise<void>
}

export function useHLPositions(address: string | null | undefined): UseHLPositionsResult {
  const [positions,  setPositions]  = useState<HLPositionRow[]>([])
  const [isLoading,  setIsLoading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const midsRef    = useRef<Record<string, number>>({})
  const activeRef  = useRef(true)

  const fetchPositions = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    try {
      const midsData = await getAllMids()
      midsRef.current = Object.fromEntries(
        Object.entries(midsData.mids).map(([k, v]) => [k, parseFloat(v)])
      )
      const rows = await getPositions(address, midsData.mids)
      if (activeRef.current) {
        setPositions(rows)
        setError(null)
      }
    } catch (e) {
      if (activeRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to fetch positions')
      }
    } finally {
      if (activeRef.current) setIsLoading(false)
    }
  }, [address])

  // Poll on address change
  useEffect(() => {
    activeRef.current = true
    if (!address) {
      setPositions([])
      return
    }
    fetchPositions()
    const id = setInterval(fetchPositions, POLL_MS)
    return () => {
      activeRef.current = false
      clearInterval(id)
    }
  }, [address, fetchPositions])

  // Apply live mid price updates to positions (instant PnL updates)
  useEffect(() => {
    if (!address) return
    const ws = getHyperliquidWS()
    const unsub = ws.onAllMids((data: HLAllMidsData) => {
      const newMids: Record<string, number> = {}
      for (const [coin, px] of Object.entries(data.mids)) {
        newMids[coin] = parseFloat(px)
      }
      midsRef.current = { ...midsRef.current, ...newMids }

      setPositions(prev =>
        prev.map(pos => {
          const newMark = newMids[pos.coin]
          if (newMark === undefined) return pos

          const size = pos.side === 'Long' ? pos.size : -pos.size
          const newPnl = (newMark - pos.entryPrice) * size
          const newPnlPct = pos.marginUsed > 0 ? (newPnl / pos.marginUsed) * 100 : 0

          return {
            ...pos,
            markPrice: newMark,
            unrealizedPnl: newPnl,
            unrealizedPnlPct: newPnlPct,
          }
        })
      )
    })
    return unsub
  }, [address])

  const totalPnl   = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
  const totalValue = positions.reduce((sum, p) => sum + p.sizeUsd, 0)

  return { positions, totalPnl, totalValue, isLoading, error, refresh: fetchPositions }
}
