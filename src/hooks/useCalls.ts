import { useState, useCallback, useMemo } from 'react'
import type { Signal } from '../types'
import { loadStorage, saveStorage } from '../lib/storage'
import { storageKey } from '../lib/appMode'

export interface CallRecord {
  id: string
  ca: string
  token_symbol: string
  token_name: string
  image_url: string | null
  source: string
  entry_mcap_usd: number
  entry_price_usd: number
  current_mcap_usd: number
  current_price_usd: number
  buy_pressure: number
  price_change_1h: number
  timestamp: string  // ISO
  dex_url: string | null
  twitter_url: string | null
}

const KEY = storageKey('sentinel_calls')
const MAX_CALLS = 100

function genId() {
  return Math.random().toString(36).slice(2, 11)
}

function loadCalls(): CallRecord[] {
  return loadStorage<CallRecord[]>(KEY, [])
}

function saveCalls(calls: CallRecord[]) {
  saveStorage(KEY, calls)
}

export function useCalls() {
  const [calls, setCalls] = useState<CallRecord[]>(loadCalls)

  /** Add a new call from a live signal (idempotent — won't duplicate same CA within 60s) */
  const addCall = useCallback((signal: Signal) => {
    const now = Date.now()
    setCalls(prev => {
      // Prevent duplicate call for same CA within 60s
      const recent = prev.find(c => c.ca === signal.ca && now - new Date(c.timestamp).getTime() < 60_000)
      if (recent) return prev

      const record: CallRecord = {
        id: genId(),
        ca: signal.ca,
        token_symbol: signal.token_symbol,
        token_name: signal.token_name,
        image_url: signal.image_url,
        source: signal.source,
        entry_mcap_usd: signal.entry_mcap_usd,
        entry_price_usd: signal.price_usd,
        current_mcap_usd: signal.mcap_usd,
        current_price_usd: signal.price_usd,
        buy_pressure: signal.buy_pressure,
        price_change_1h: signal.price_change_1h,
        timestamp: new Date().toISOString(),
        dex_url: signal.dex_url,
        twitter_url: signal.twitter_url,
      }

      const next = [record, ...prev].slice(0, MAX_CALLS)
      saveCalls(next)
      return next
    })
  }, [])

  /** Remove a call by CA */
  const removeCall = useCallback((ca: string) => {
    setCalls(prev => {
      const next = prev.filter(c => c.ca !== ca)
      saveCalls(next)
      return next
    })
  }, [])

  /** Update live prices for calls that have a matching live signal */
  const refreshCalls = useCallback((signals: Signal[]) => {
    const map = new Map(signals.map(s => [s.ca, s]))
    setCalls(prev => {
      let changed = false
      const next = prev.map(c => {
        const live = map.get(c.ca)
        if (!live) return c
        if (live.mcap_usd === c.current_mcap_usd && live.price_usd === c.current_price_usd) return c
        changed = true
        return { ...c, current_mcap_usd: live.mcap_usd, current_price_usd: live.price_usd, buy_pressure: live.buy_pressure }
      })
      if (changed) saveCalls(next)
      return next
    })
  }, [])

  /** Clear all calls */
  const clearCalls = useCallback(() => {
    setCalls([])
    saveCalls([])
  }, [])

  const calledCAs = useMemo(() => new Set(calls.map(c => c.ca)), [calls])

  const getCallCAs = useCallback(() => calls.map(c => c.ca), [calls])

  return { calls, calledCAs, addCall, removeCall, refreshCalls, clearCalls, getCallCAs }
}
