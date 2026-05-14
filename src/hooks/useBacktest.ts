import { useState, useEffect, useRef, useCallback } from 'react'
import type { Signal } from '../types'
import type { Strategy, Position, StrategyStats } from '../types/backtest'
import { DEFAULT_STRATEGIES, evaluateEntry, processExits, calcStats, genPositionId } from '../lib/strategyEngine'
import { fetchTokenPairs } from '../lib/dexscreener'
import { loadStorage, saveStorage } from '../lib/storage'
import { storageKey } from '../lib/appMode'

const PRICE_POLL_MS = 30_000
const MAX_POSITIONS = 500

export interface BotActivity {
  totalTrades: number
  lastTradeTime: string | null
  lastTickTime: string | null
  isRunning: boolean
}

function mergeStrategies(saved: Strategy[]): Strategy[] {
  if (saved.length === 0) return DEFAULT_STRATEGIES
  const lockedMap = new Map(DEFAULT_STRATEGIES.filter(s => s.locked).map(s => [s.id, s]))
  // Keep preset definitions authoritative for locked strategies, but preserve enabled state from saved
  const result: Strategy[] = DEFAULT_STRATEGIES.map(s => {
    if (!s.locked) return s
    const savedVersion = saved.find(sv => sv.id === s.id)
    return savedVersion ? { ...s, enabled: savedVersion.enabled, autoTrade: savedVersion.autoTrade } : s
  })
  // Append custom (non-locked) strategies from saved
  for (const sv of saved) {
    if (!lockedMap.has(sv.id)) result.push(sv)
  }
  return result
}

export function useBacktest(signals: Signal[], maxCapital?: number) {
  const [strategies, setStrategies] = useState<Strategy[]>(() =>
    mergeStrategies(loadStorage<Strategy[]>(storageKey('sentinel_strategies'), []))
  )
  const [positions, setPositions] = useState<Position[]>(() =>
    loadStorage<Position[]>(storageKey('sentinel_positions'), [])
  )
  const [stats, setStats] = useState<Record<string, StrategyStats>>({})
  const [botActivity, setBotActivity] = useState<BotActivity>(() => ({
    totalTrades: 0,
    lastTradeTime: loadStorage<string | null>(storageKey('sentinel_last_trade_time'), null),
    lastTickTime: null,
    isRunning: true,
  }))

  const processedSignals = useRef<Set<string>>(new Set())

  useEffect(() => { saveStorage(storageKey('sentinel_strategies'), strategies) }, [strategies])
  useEffect(() => { saveStorage(storageKey('sentinel_positions'), positions) }, [positions])
  useEffect(() => {
    if (botActivity.lastTradeTime) saveStorage(storageKey('sentinel_last_trade_time'), botActivity.lastTradeTime)
  }, [botActivity.lastTradeTime])

  // Process new signals → open positions
  useEffect(() => {
    const latest = signals[0]
    if (!latest || processedSignals.current.has(latest.id)) return
    if (latest.price_usd <= 0) return
    processedSignals.current.add(latest.id)

    const newPositions: Position[] = []
    const currentOpenCapital = positions
      .filter(p => p.status === 'open')
      .reduce((s, p) => s + p.positionSizeSol * (p.remainingPct / 100), 0)

    for (const strategy of strategies) {
      if (!evaluateEntry(strategy, latest)) continue
      // Respect capital limit — don't open if it would exceed available funds
      if (maxCapital !== undefined) {
        const committed = newPositions.reduce((s, p) => s + p.positionSizeSol, 0)
        if (currentOpenCapital + committed + strategy.positionSizeSol > maxCapital) continue
      }
      newPositions.push({
        id: genPositionId(),
        strategyId: strategy.id,
        strategyName: strategy.name,
        ca: latest.ca,
        tokenSymbol: latest.token_symbol,
        tokenName: latest.token_name,
        entryPrice: latest.price_usd,
        entryMcap: latest.mcap_usd,
        entryTime: new Date().toISOString(),
        currentPrice: latest.price_usd,
        currentMcap: latest.mcap_usd,
        lastUpdated: new Date().toISOString(),
        status: 'open',
        exitPrice: null,
        exitTime: null,
        remainingPct: 100,
        partialExits: [],
        realizedPnlSol: 0,
        unrealizedPnlPct: 0,
        unrealizedPnlSol: 0,
        totalPnlSol: 0,
        positionSizeSol: strategy.positionSizeSol,
        scannerScore: latest.scanner_score,
        scoreGrade: latest.score_grade,
        source: latest.source,
        liquidityAtEntry: latest.liquidity_usd,
        dexUrl: latest.dex_url,
      })
    }

    if (newPositions.length > 0) {
      setPositions(prev => [...newPositions, ...prev].slice(0, MAX_POSITIONS))
      setBotActivity(prev => ({
        ...prev,
        totalTrades: prev.totalTrades + newPositions.length,
        lastTradeTime: new Date().toISOString(),
      }))
    }
  }, [signals, strategies])

  // Recalculate stats whenever positions or strategies change
  useEffect(() => {
    const newStats: Record<string, StrategyStats> = {}
    for (const s of strategies) newStats[s.id] = calcStats(s.id, positions)
    setStats(newStats)
  }, [positions, strategies])

  // Live price polling — runs in background even when tab is not focused
  useEffect(() => {
    let active = true

    async function updatePrices() {
      const openPositions = positions.filter(p => p.status === 'open')
      const uniqueCAs = [...new Set(openPositions.map(p => p.ca))]
      if (uniqueCAs.length === 0) return

      setBotActivity(prev => ({ ...prev, lastTickTime: new Date().toISOString() }))

      const priceMap: Record<string, { price: number; mcap: number }> = {}
      for (let i = 0; i < uniqueCAs.length; i += 5) {
        if (!active) return
        const batch = uniqueCAs.slice(i, i + 5)
        const results = await Promise.all(batch.map(ca => fetchTokenPairs(ca)))
        for (let j = 0; j < batch.length; j++) {
          const pair = results[j]
          if (pair?.priceUsd) {
            priceMap[batch[j]!] = { price: parseFloat(pair.priceUsd) || 0, mcap: pair.marketCap ?? pair.fdv ?? 0 }
          }
        }
      }

      if (!active || Object.keys(priceMap).length === 0) return

      setPositions(prev =>
        prev.map(position => {
          if (position.status !== 'open') return position
          const data = priceMap[position.ca]
          if (!data || data.price <= 0) return position
          const strategy = strategies.find(s => s.id === position.strategyId)
          if (!strategy) return position
          return processExits(position, data.price, data.mcap, strategy)
        })
      )
    }

    const timer = setInterval(updatePrices, PRICE_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [positions, strategies])

  // Keep bot running indicator alive
  useEffect(() => {
    const timer = setInterval(() => {
      setBotActivity(prev => ({ ...prev, isRunning: true }))
    }, 10_000)
    return () => clearInterval(timer)
  }, [])

  const updateStrategy = useCallback((updated: Strategy) => {
    setStrategies(prev => prev.map(s => {
      if (s.id !== updated.id) return s
      // Locked strategies: only allow safe operational fields to change
      if (s.locked) return { ...s, enabled: updated.enabled, autoTrade: updated.autoTrade, positionSizeSol: updated.positionSizeSol }
      return updated
    }))
  }, [])

  const updatePositionSize = useCallback((id: string, size: number) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, positionSizeSol: Math.max(0.001, size) } : s))
  }, [])

  const toggleAutoTrade = useCallback((id: string) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, autoTrade: !s.autoTrade } : s))
  }, [])

  const updateStrategyEnabled = useCallback((id: string, enabled: boolean) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, enabled } : s))
  }, [])

  const addStrategy = useCallback((strategy: Strategy) => {
    setStrategies(prev => [...prev, strategy])
  }, [])

  const deleteStrategy = useCallback((id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id || s.locked))
    setPositions(prev => prev.filter(p => p.strategyId !== id))
  }, [])

  const clearPositions = useCallback(() => {
    setPositions([])
    processedSignals.current.clear()
    setBotActivity(prev => ({ ...prev, totalTrades: 0 }))
  }, [])

  return {
    strategies, positions, stats, botActivity,
    updateStrategy, toggleAutoTrade, updateStrategyEnabled,
    updatePositionSize, addStrategy, deleteStrategy, clearPositions,
  }
}
