import { useState, useEffect, useRef, useCallback } from 'react'
import type { Signal } from '../types'
import type { Strategy, Position, StrategyStats } from '../types/backtest'
import { DEFAULT_STRATEGIES, evaluateEntry, processExits, calcStats, genPositionId } from '../lib/strategyEngine'
import { fetchTokenPairs } from '../lib/dexscreener'

const PRICE_POLL_MS = 30_000
const MAX_POSITIONS = 500

export function useBacktest(signals: Signal[]) {
  const [strategies, setStrategies] = useState<Strategy[]>(DEFAULT_STRATEGIES)
  const [positions, setPositions] = useState<Position[]>([])
  const [stats, setStats] = useState<Record<string, StrategyStats>>({})
  const processedSignals = useRef<Set<string>>(new Set())

  useEffect(() => {
    const latest = signals[0]
    if (!latest || processedSignals.current.has(latest.id)) return
    if (latest.price_usd <= 0) return
    processedSignals.current.add(latest.id)

    const newPositions: Position[] = []
    for (const strategy of strategies) {
      if (!evaluateEntry(strategy, latest)) continue
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
    }
  }, [signals, strategies])

  useEffect(() => {
    const newStats: Record<string, StrategyStats> = {}
    for (const s of strategies) {
      newStats[s.id] = calcStats(s.id, positions)
    }
    setStats(newStats)
  }, [positions, strategies])

  useEffect(() => {
    let active = true

    async function updatePrices() {
      const openPositions = positions.filter(p => p.status === 'open')
      const uniqueCAs = [...new Set(openPositions.map(p => p.ca))]
      if (uniqueCAs.length === 0) return

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

  const updateStrategy = useCallback((updated: Strategy) => {
    setStrategies(prev => prev.map(s => s.id === updated.id ? updated : s))
  }, [])

  const addStrategy = useCallback((strategy: Strategy) => {
    setStrategies(prev => [...prev, strategy])
  }, [])

  const deleteStrategy = useCallback((id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id))
    setPositions(prev => prev.filter(p => p.strategyId !== id))
  }, [])

  const clearPositions = useCallback(() => {
    setPositions([])
    processedSignals.current.clear()
  }, [])

  return { strategies, positions, stats, updateStrategy, addStrategy, deleteStrategy, clearPositions }
}
