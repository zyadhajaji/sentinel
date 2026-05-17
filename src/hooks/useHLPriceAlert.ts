/**
 * useHLPriceAlert — price alert system for Hyperliquid markets
 *
 * Registers alerts at price levels. When the market's mid price crosses a
 * threshold, the alert fires a callback and optionally auto-removes itself.
 *
 * Alerts are persisted to localStorage and survive page reloads.
 * Mid prices are sourced from the WebSocket allMids subscription.
 *
 * Usage:
 *   const { alerts, addAlert, removeAlert, clearFired } = useHLPriceAlert()
 *
 *   // Add an alert: fire when BTC crosses above 120,000
 *   addAlert({ coin: 'BTC', targetPrice: 120_000, direction: 'above', label: 'BTC ATH watch' })
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { getHyperliquidWS } from '../lib/hyperliquid/ws'
import { IS_DEMO } from '../lib/appMode'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AlertDirection = 'above' | 'below'

export interface PriceAlert {
  id:          string          // uuid-lite (Date.now + random)
  coin:        string
  targetPrice: number
  direction:   AlertDirection  // fire when price crosses above/below target
  label?:      string          // optional display note
  createdAt:   number          // Unix ms
  firedAt?:    number          // set when triggered
  autoRemove:  boolean         // remove after first fire (default: false)
}

export interface UseHLPriceAlertResult {
  alerts:      PriceAlert[]
  addAlert:    (params: Omit<PriceAlert, 'id' | 'createdAt'>) => string
  removeAlert: (id: string) => void
  clearFired:  () => void
  onFire?:     (alert: PriceAlert, price: number) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

function storageKey() {
  return IS_DEMO ? 'demo_hl_price_alerts' : 'sentinel_hl_price_alerts'
}

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(storageKey())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(alerts))
  } catch { /* quota exceeded — ignore */ }
}

function makeId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export type AlertFireHandler = (alert: PriceAlert, currentPrice: number) => void

export function useHLPriceAlert(onFire?: AlertFireHandler): UseHLPriceAlertResult {
  const [alerts, setAlerts] = useState<PriceAlert[]>(loadAlerts)
  const alertsRef  = useRef<PriceAlert[]>(alerts)
  const onFireRef  = useRef<AlertFireHandler | undefined>(onFire)
  onFireRef.current = onFire

  // Persist to localStorage whenever alerts change
  useEffect(() => {
    alertsRef.current = alerts
    saveAlerts(alerts)
  }, [alerts])

  // Subscribe to live mid prices via WS
  useEffect(() => {
    const ws = getHyperliquidWS()
    const unsub = ws.onAllMids(({ mids }) => {
      const current = alertsRef.current
      // Only check unfired alerts
      const pending = current.filter(a => !a.firedAt)
      if (pending.length === 0) return

      const fired: string[] = []
      for (const alert of pending) {
        const priceStr = mids[alert.coin]
        if (!priceStr) continue
        const price = parseFloat(priceStr)
        if (isNaN(price)) continue

        const triggered =
          (alert.direction === 'above' && price >= alert.targetPrice) ||
          (alert.direction === 'below' && price <= alert.targetPrice)

        if (triggered) {
          fired.push(alert.id)
          onFireRef.current?.({ ...alert, firedAt: Date.now() }, price)
        }
      }

      if (fired.length === 0) return
      setAlerts(prev => {
        const updated = prev.map(a => {
          if (!fired.includes(a.id)) return a
          return { ...a, firedAt: Date.now() }
        })
        // Remove autoRemove alerts that just fired
        return updated.filter(a => !(a.autoRemove && a.firedAt))
      })
    })

    return unsub
  }, [])

  const addAlert = useCallback((
    params: Omit<PriceAlert, 'id' | 'createdAt'>
  ): string => {
    const id = makeId()
    const alert: PriceAlert = {
      ...params,
      id,
      createdAt: Date.now(),
      autoRemove: params.autoRemove ?? false,
    }
    setAlerts(prev => [...prev, alert])
    return id
  }, [])

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  const clearFired = useCallback(() => {
    setAlerts(prev => prev.filter(a => !a.firedAt))
  }, [])

  return { alerts, addAlert, removeAlert, clearFired }
}
