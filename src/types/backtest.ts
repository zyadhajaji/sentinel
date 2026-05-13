import type { ScoreGrade } from './index'

export type Protocol =
  | 'pump' | 'pumpAmm' | 'raydium' | 'bonkers' | 'surge' | 'soar'
  | 'printr' | 'liquidAf' | 'liquidAfAmm' | 'moonshot' | 'moonshotApp'
  | 'bonk' | 'mayhem' | 'heaven' | 'daosFun' | 'orca' | 'launchLab'
  | 'virtualCurve' | 'launchACoin' | 'boop' | 'meteoraAmm' | 'meteoraAmmV2'
  | 'candle' | 'sugar' | 'jupiterStudio' | 'bags'

export type ProtocolMap = Partial<Record<Protocol, boolean>>

export interface RangeFilter {
  min: number | null
  max: number | null
}

export interface StrategyFilters {
  protocols: ProtocolMap
  searchKeywords: string[]
  excludeKeywords: string[]
  age: RangeFilter & { unit: 'minutes' | 'hours' }
  top10Holders: RangeFilter
  devHolding: RangeFilter
  snipers: RangeFilter
  insiders: RangeFilter
  bundle: RangeFilter
  holders: RangeFilter
  liquidity: RangeFilter
  marketCap: RangeFilter
  volume: RangeFilter
  txns: RangeFilter
  numBuys: RangeFilter
  numSells: RangeFilter
  twitterExists: boolean
  website: boolean
  telegram: boolean
  atLeastOneSocial: boolean
  narratives: string[]
  buyPressure: RangeFilter
  priceChange1h: RangeFilter
  feesEstSol: RangeFilter
}

export interface TakeProfitLevel {
  id: string
  type: 'percent' | 'mcap_usd'
  value: number
  sellPercent: number
}

export interface StrategyExit {
  takeProfitLevels: TakeProfitLevel[]
  stopLossPct: number | null
  maxHoldMinutes: number | null
}

export interface Strategy {
  id: string
  name: string
  color: string
  enabled: boolean
  filters: StrategyFilters
  exit: StrategyExit
  positionSizeSol: number
}

export type PositionStatus = 'open' | 'closed_tp' | 'closed_sl' | 'closed_timeout' | 'closed_rug'

export interface PartialExit {
  tpLevelId: string
  price: number
  mcap: number
  sizePct: number
  pnlPct: number
  pnlSol: number
  time: string
}

export interface Position {
  id: string
  strategyId: string
  strategyName: string
  ca: string
  tokenSymbol: string
  tokenName: string
  entryPrice: number
  entryMcap: number
  entryTime: string
  currentPrice: number
  currentMcap: number
  lastUpdated: string
  status: PositionStatus
  exitPrice: number | null
  exitTime: string | null
  remainingPct: number
  partialExits: PartialExit[]
  realizedPnlSol: number
  unrealizedPnlPct: number
  unrealizedPnlSol: number
  totalPnlSol: number
  positionSizeSol: number
  scannerScore: number
  scoreGrade: ScoreGrade
  source: string
  liquidityAtEntry: number
  dexUrl: string | null
}

export interface StrategyStats {
  strategyId: string
  totalTrades: number
  openTrades: number
  wins: number
  losses: number
  winRate: number
  totalPnlSol: number
  avgWinPct: number
  avgLossPct: number
  best: number
  worst: number
  equityCurve: { time: number; value: number }[]
}
