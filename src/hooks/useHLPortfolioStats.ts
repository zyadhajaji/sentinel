/**
 * useHLPortfolioStats — aggregate trading performance stats for Hyperliquid
 *
 * Derived from useHLFills. Computes win rate, profit factor, average R,
 * max drawdown, streak, fee totals, and best/worst individual trades.
 *
 * Purely derived — no fetching, no side effects. Pass fills from useHLFills.
 *
 * Usage:
 *   const { fills } = useHLFills(address)
 *   const stats = useHLPortfolioStats(fills)
 */

import { useMemo } from 'react'
import type { ParsedFill } from './useHLFills'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HLCoinStats {
  coin:       string
  tradeCount: number
  realizedPnl: number
  totalFees:  number
  winRate:    number   // 0-100
}

export interface HLPortfolioStats {
  // Counts
  totalTrades:    number
  winCount:       number
  lossCount:      number
  breakEvenCount: number

  // P&L
  totalRealizedPnl: number   // USD, net of fees
  totalGross:       number   // gross PnL before fees
  totalFees:        number   // total fees paid
  avgPnlPerTrade:   number   // net, per closing fill

  // Rates
  winRate:      number   // 0-100 percentage
  profitFactor: number   // gross wins / gross losses (Infinity if no losses)
  avgWin:       number   // avg USD gain on winning trades
  avgLoss:      number   // avg USD loss on losing trades (positive number)
  avgRR:        number   // average reward:risk (avgWin / avgLoss)

  // Streaks
  currentStreak: number   // positive = win streak, negative = loss streak
  maxWinStreak:  number
  maxLossStreak: number

  // Best / worst
  bestTrade:  { coin: string; pnl: number; time: number } | null
  worstTrade: { coin: string; pnl: number; time: number } | null

  // Volume
  totalNotional: number  // total USD traded (sum of all fills)
  avgTradeSize:  number  // avg fill notional

  // Per-coin breakdown (top 10 by trade count)
  byCoins: HLCoinStats[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useHLPortfolioStats(fills: ParsedFill[]): HLPortfolioStats {
  return useMemo(() => {
    // Only closing fills carry closedPnl != 0
    const closingFills = fills.filter(f => f.closedPnl !== 0)

    const totalTrades    = closingFills.length
    const totalFees      = fills.reduce((sum, f) => sum + f.fee, 0)
    const totalNotional  = fills.reduce((sum, f) => sum + f.notional, 0)
    const totalGross     = closingFills.reduce((sum, f) => sum + f.closedPnl, 0)
    const totalRealizedPnl = totalGross - totalFees

    const avgTradeSize = fills.length > 0 ? totalNotional / fills.length : 0

    // Win / loss split
    const winFills  = closingFills.filter(f => f.closedPnl > 0)
    const lossFills = closingFills.filter(f => f.closedPnl < 0)
    const breakEvenFills = closingFills.filter(f => f.closedPnl === 0)

    const winCount       = winFills.length
    const lossCount      = lossFills.length
    const breakEvenCount = breakEvenFills.length
    const winRate        = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0

    const grossWins   = winFills.reduce((sum, f) => sum + f.closedPnl, 0)
    const grossLosses = Math.abs(lossFills.reduce((sum, f) => sum + f.closedPnl, 0))
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? Infinity : 0)

    const avgWin  = winCount  > 0 ? grossWins   / winCount  : 0
    const avgLoss = lossCount > 0 ? grossLosses / lossCount : 0
    const avgRR   = avgLoss   > 0 ? avgWin / avgLoss : 0

    const avgPnlPerTrade = totalTrades > 0 ? totalRealizedPnl / totalTrades : 0

    // Best / worst
    let bestTrade:  HLPortfolioStats['bestTrade']  = null
    let worstTrade: HLPortfolioStats['worstTrade'] = null
    if (closingFills.length > 0) {
      const best  = closingFills.reduce((a, b) => b.closedPnl > a.closedPnl ? b : a)
      const worst = closingFills.reduce((a, b) => b.closedPnl < a.closedPnl ? b : a)
      bestTrade  = { coin: best.coin,  pnl: best.closedPnl,  time: best.time }
      worstTrade = { coin: worst.coin, pnl: worst.closedPnl, time: worst.time }
    }

    // Streaks (oldest → newest for chronological order)
    const chronological = [...closingFills].sort((a, b) => a.time - b.time)
    let currentStreak = 0
    let maxWinStreak  = 0
    let maxLossStreak = 0
    let streak        = 0
    for (const f of chronological) {
      if (f.closedPnl > 0) {
        streak = streak > 0 ? streak + 1 : 1
      } else if (f.closedPnl < 0) {
        streak = streak < 0 ? streak - 1 : -1
      } else {
        streak = 0
      }
      if (streak > maxWinStreak)       maxWinStreak  = streak
      if (streak < -maxLossStreak)     maxLossStreak = -streak
    }
    currentStreak = streak

    // Per-coin stats
    const coinMap = new Map<string, { trades: number; pnl: number; fees: number; wins: number }>()
    for (const f of closingFills) {
      const entry = coinMap.get(f.coin) ?? { trades: 0, pnl: 0, fees: 0, wins: 0 }
      entry.trades++
      entry.pnl += f.closedPnl
      entry.wins += f.closedPnl > 0 ? 1 : 0
      coinMap.set(f.coin, entry)
    }
    // Add fees from all fills (not just closing)
    for (const f of fills) {
      const entry = coinMap.get(f.coin)
      if (entry) entry.fees += f.fee
    }

    const byCoins: HLCoinStats[] = Array.from(coinMap.entries())
      .map(([coin, data]) => ({
        coin,
        tradeCount:  data.trades,
        realizedPnl: data.pnl,
        totalFees:   data.fees,
        winRate:     data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      }))
      .sort((a, b) => b.tradeCount - a.tradeCount)
      .slice(0, 10)

    return {
      totalTrades,
      winCount,
      lossCount,
      breakEvenCount,
      totalRealizedPnl,
      totalGross,
      totalFees,
      avgPnlPerTrade,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      avgRR,
      currentStreak,
      maxWinStreak,
      maxLossStreak,
      bestTrade,
      worstTrade,
      totalNotional,
      avgTradeSize,
      byCoins,
    }
  }, [fills])
}
