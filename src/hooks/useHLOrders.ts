/**
 * useHLOrders — open orders for a Hyperliquid account
 * Polls every 5s. Returns parsed order rows ready for a table.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getParsedOpenOrders } from '../lib/hyperliquid/client'
import type { HLOrderRow } from '../lib/hyperliquid/types'

const POLL_MS = 5_000

export interface UseHLOrdersResult {
  orders:    HLOrderRow[]
  isLoading: boolean
  error:     string | null
  refresh:   () => Promise<void>
}

export function useHLOrders(address: string | null | undefined): UseHLOrdersResult {
  const [orders,    setOrders]    = useState<HLOrderRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const activeRef = useRef(true)

  const fetchOrders = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    try {
      const rows = await getParsedOpenOrders(address)
      if (activeRef.current) { setOrders(rows); setError(null) }
    } catch (e) {
      if (activeRef.current) setError(e instanceof Error ? e.message : 'Failed to fetch orders')
    } finally {
      if (activeRef.current) setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    activeRef.current = true
    if (!address) { setOrders([]); return }
    fetchOrders()
    const id = setInterval(fetchOrders, POLL_MS)
    return () => { activeRef.current = false; clearInterval(id) }
  }, [address, fetchOrders])

  return { orders, isLoading, error, refresh: fetchOrders }
}
