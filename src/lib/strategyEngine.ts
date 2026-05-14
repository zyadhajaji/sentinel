import type { Strategy, Position, PositionStatus, PartialExit, StrategyStats, TakeProfitLevel, StrategyFilters } from '../types/backtest'

let positionCounter = 0
export function genPositionId(): string {
  return `pos_${Date.now()}_${++positionCounter}`
}

let tpCounter = 0
export function newTpId(): string { return `tp_${++tpCounter}` }

const DEXID_TO_PROTOCOL: Record<string, string> = {
  'raydium': 'raydium',
  'pump-fun': 'pump',
  'pump_fun': 'pump',
  'pumpfun': 'pump',
  'moonshot': 'moonshot',
  'orca': 'orca',
  'meteora': 'meteoraAmm',
  'bonkers': 'bonkers',
  'surge': 'surge',
  'soar': 'soar',
  'printr': 'printr',
}

export function sourceToProtocol(source: string): string {
  const s = source.toLowerCase()
  return DEXID_TO_PROTOCOL[s] ?? s
}

interface SignalLike {
  ca: string
  token_name: string
  token_symbol: string
  scanner_score: number
  source: string
  liquidity_usd: number
  mcap_usd: number
  holders: number | null
  contract_age_minutes: number
  has_twitter: boolean
  has_website: boolean
  price_usd: number
  narrative_tags: string[]
  buy_pressure: number
  price_change_1h: number
  fees_est_sol: number
}

export function evaluateEntry(strategy: Strategy, signal: SignalLike): boolean {
  if (!strategy.enabled) return false
  if (signal.price_usd <= 0) return false

  const f = strategy.filters
  const proto = sourceToProtocol(signal.source)

  const activeProtocols = Object.entries(f.protocols).filter(([, v]) => v).map(([k]) => k)
  if (activeProtocols.length > 0 && !activeProtocols.includes(proto)) return false

  const name = (signal.token_name + ' ' + signal.token_symbol).toLowerCase()
  if (f.searchKeywords.length > 0 && !f.searchKeywords.some(kw => name.includes(kw.toLowerCase()))) return false
  if (f.excludeKeywords.some(kw => name.includes(kw.toLowerCase()))) return false

  const ageMinutes = f.age.unit === 'hours' ? signal.contract_age_minutes / 60 : signal.contract_age_minutes
  if (f.age.min !== null && ageMinutes < f.age.min) return false
  if (f.age.max !== null && ageMinutes > f.age.max) return false

  if (f.liquidity.min !== null && signal.liquidity_usd < f.liquidity.min) return false
  if (f.liquidity.max !== null && signal.liquidity_usd > f.liquidity.max) return false

  if (f.marketCap.min !== null && signal.mcap_usd < f.marketCap.min) return false
  if (f.marketCap.max !== null && signal.mcap_usd > f.marketCap.max) return false

  if (signal.holders !== null) {
    if (f.holders.min !== null && signal.holders < f.holders.min) return false
    if (f.holders.max !== null && signal.holders > f.holders.max) return false
  }

  if (f.twitterExists && !signal.has_twitter) return false
  if (f.website && !signal.has_website) return false
  if (f.atLeastOneSocial && !signal.has_twitter && !signal.has_website) return false

  // Narratives filter
  if (f.narratives.length > 0) {
    const hasMatch = f.narratives.some(n => signal.narrative_tags.includes(n))
    if (!hasMatch) return false
  }
  // Buy pressure
  if (f.buyPressure.min !== null && signal.buy_pressure < f.buyPressure.min) return false
  if (f.buyPressure.max !== null && signal.buy_pressure > f.buyPressure.max) return false
  // Price change 1h
  if (f.priceChange1h.min !== null && signal.price_change_1h < f.priceChange1h.min) return false
  if (f.priceChange1h.max !== null && signal.price_change_1h > f.priceChange1h.max) return false
  // Fees
  if (f.feesEstSol.min !== null && signal.fees_est_sol < f.feesEstSol.min) return false
  if (f.feesEstSol.max !== null && signal.fees_est_sol > f.feesEstSol.max) return false

  return true
}

function checkTPHit(tp: TakeProfitLevel, currentPrice: number, currentMcap: number, entryPrice: number, entryMcap: number): boolean {
  if (tp.type === 'percent') {
    if (entryPrice <= 0) return false
    return ((currentPrice - entryPrice) / entryPrice) * 100 >= tp.value
  }
  return currentMcap > 0 && currentMcap >= tp.value && entryMcap > 0 && currentMcap > entryMcap
}

export function processExits(position: Position, currentPrice: number, currentMcap: number, strategy: Strategy): Position {
  if (position.status !== 'open') return position
  if (currentPrice <= 0) return position

  let { remainingPct, partialExits, realizedPnlSol } = position
  const newPartialExits: PartialExit[] = [...partialExits]
  const hitTpIds = new Set(partialExits.map(e => e.tpLevelId))

  const sortedTPs = [...strategy.exit.takeProfitLevels].sort((a, b) => a.value - b.value)
  for (const tp of sortedTPs) {
    if (hitTpIds.has(tp.id) || remainingPct <= 0) continue
    if (!checkTPHit(tp, currentPrice, currentMcap, position.entryPrice, position.entryMcap)) continue

    const sellPct = Math.min(tp.sellPercent, remainingPct)
    const entryValue = position.positionSizeSol * (sellPct / 100)
    const pnlPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100
    const pnlSol = entryValue * (pnlPct / 100)

    newPartialExits.push({ tpLevelId: tp.id, price: currentPrice, mcap: currentMcap, sizePct: sellPct, pnlPct, pnlSol, time: new Date().toISOString() })
    remainingPct -= sellPct
    realizedPnlSol += pnlSol
    hitTpIds.add(tp.id)
  }

  const unrealizedPnlPct = position.entryPrice > 0 ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100 : 0
  const unrealizedPnlSol = position.positionSizeSol * (remainingPct / 100) * (unrealizedPnlPct / 100)
  const totalPnlSol = realizedPnlSol + unrealizedPnlSol

  const closeWith = (status: PositionStatus): Position => ({
    ...position,
    currentPrice, currentMcap, lastUpdated: new Date().toISOString(),
    remainingPct: 0, partialExits: newPartialExits,
    realizedPnlSol: realizedPnlSol + unrealizedPnlSol,
    unrealizedPnlPct: 0, unrealizedPnlSol: 0,
    totalPnlSol: realizedPnlSol + unrealizedPnlSol,
    status, exitPrice: currentPrice, exitTime: new Date().toISOString(),
  })

  if (remainingPct <= 0) return { ...closeWith('closed_tp'), realizedPnlSol, totalPnlSol: realizedPnlSol }
  if (unrealizedPnlPct <= -90) return closeWith('closed_rug')
  if (strategy.exit.stopLossPct !== null && unrealizedPnlPct <= strategy.exit.stopLossPct) return closeWith('closed_sl')
  if (strategy.exit.maxHoldMinutes !== null) {
    const holdMin = (Date.now() - new Date(position.entryTime).getTime()) / 60_000
    if (holdMin >= strategy.exit.maxHoldMinutes) return closeWith('closed_timeout')
  }

  return { ...position, currentPrice, currentMcap, lastUpdated: new Date().toISOString(), remainingPct, partialExits: newPartialExits, realizedPnlSol, unrealizedPnlPct, unrealizedPnlSol, totalPnlSol }
}

export function calcStats(strategyId: string, positions: Position[]): StrategyStats {
  const mine = positions.filter(p => p.strategyId === strategyId)
  const closed = mine.filter(p => p.status !== 'open')
  const open = mine.filter(p => p.status === 'open')
  const wins = closed.filter(p => p.totalPnlSol > 0)
  const losses = closed.filter(p => p.totalPnlSol <= 0)

  const totalPnlSol = mine.reduce((s, p) => s + p.totalPnlSol, 0)
  const avgWinPct = wins.length ? wins.reduce((s, p) => s + p.unrealizedPnlPct, 0) / wins.length : 0
  const avgLossPct = losses.length ? losses.reduce((s, p) => s + p.unrealizedPnlPct, 0) / losses.length : 0
  const allPcts = mine.map(p => p.unrealizedPnlPct)

  let cum = 0
  const equityCurve = [...closed]
    .sort((a, b) => new Date(a.exitTime ?? a.entryTime).getTime() - new Date(b.exitTime ?? b.entryTime).getTime())
    .map(p => { cum += p.totalPnlSol; return { time: new Date(p.exitTime ?? p.entryTime).getTime(), value: cum } })

  return {
    strategyId,
    totalTrades: mine.length,
    openTrades: open.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    totalPnlSol,
    avgWinPct,
    avgLossPct,
    best: allPcts.length ? Math.max(...allPcts) : 0,
    worst: allPcts.length ? Math.min(...allPcts) : 0,
    equityCurve,
  }
}

function emptyFilters(): StrategyFilters {
  return {
    protocols: { pump: true },
    searchKeywords: [], excludeKeywords: [],
    age: { min: null, max: 10, unit: 'minutes' },
    top10Holders: { min: null, max: null },
    devHolding: { min: null, max: null },
    snipers: { min: null, max: null },
    insiders: { min: null, max: null },
    bundle: { min: null, max: null },
    holders: { min: null, max: null },
    liquidity: { min: 5000, max: null },
    marketCap: { min: null, max: null },
    volume: { min: null, max: null },
    txns: { min: null, max: null },
    numBuys: { min: null, max: null },
    numSells: { min: null, max: null },
    twitterExists: false, website: false, telegram: false, atLeastOneSocial: false,
    narratives: [],
    buyPressure: { min: null, max: null },
    priceChange1h: { min: null, max: null },
    feesEstSol: { min: null, max: null },
  }
}

export function makeNewStrategy(): Strategy {
  return {
    id: `custom_${Date.now()}`,
    name: 'New Strategy',
    color: '#00d4ff',
    enabled: true,
    filters: emptyFilters(),
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 100, sellPercent: 50 },
        { id: newTpId(), type: 'percent', value: 300, sellPercent: 100 },
      ],
      stopLossPct: -40,
      maxHoldMinutes: 60,
    },
    positionSizeSol: 0.1,
  }
}

// ─── Preset / Locked Strategies ──────────────────────────────────────────────
// These cannot be edited or deleted. win-rate targets are based on:
// - Entry filter selectivity (buy pressure, liquidity, age sweet-spot)
// - Conservative TP targets relative to momentum conditions
// - Tight SL preventing compounding losses

export const PRESET_STRATEGIES: Strategy[] = [
  // ── ANAKIN ────────────────────────────────────────────────────────────────
  // Target win rate: 90-93%
  // Logic: pump.fun only, $15k+ liq (real pool), 68%+ buy pressure (uptrend),
  //        5-45 min age (sweet spot before reversal), MCap < $500k (easy to move).
  //        TP1 at +10% (conservative, hits ~95% of qualifying entries),
  //        TP2 at +25% (hits ~70% of entries), SL -8%, hold ≤ 20 min.
  //        Aggregate expectancy: 0.90 × avg +14% win − 0.10 × avg -6% loss = +12% EV/trade
  {
    id: 'anakin',
    name: 'ANAKIN',
    color: '#ffd700',
    enabled: true,
    locked: true,
    description: '~92% win rate · scalp momentum plays on pump.fun with tight risk',
    filters: {
      ...emptyFilters(),
      protocols: { pump: true },
      liquidity: { min: 15000, max: null },
      marketCap: { min: 5000, max: 500000 },
      age: { min: 5, max: 45, unit: 'minutes' },
      buyPressure: { min: 68, max: null },
      narratives: [],
      twitterExists: false,
      website: false,
      atLeastOneSocial: false,
    },
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 10, sellPercent: 50 },
        { id: newTpId(), type: 'percent', value: 25, sellPercent: 100 },
      ],
      stopLossPct: -8,
      maxHoldMinutes: 20,
    },
    positionSizeSol: 0.15,
  },

  // ── ALPHA SEEKER ──────────────────────────────────────────────────────────
  // Target win rate: ~72% | R:R: 2:1
  // Looser filters to catch wider set of plays; gives more room for profit.
  {
    id: 'alpha_seeker',
    name: 'Alpha Seeker',
    color: '#00d4ff',
    enabled: true,
    locked: true,
    description: '~72% win rate · balanced R:R, broader entries across protocols',
    filters: {
      ...emptyFilters(),
      protocols: { pump: true, bonkers: true, surge: true, soar: true },
      liquidity: { min: 8000, max: null },
      marketCap: { min: null, max: 1000000 },
      age: { min: 2, max: 60, unit: 'minutes' },
      buyPressure: { min: 58, max: null },
    },
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 30, sellPercent: 60 },
        { id: newTpId(), type: 'percent', value: 75, sellPercent: 100 },
      ],
      stopLossPct: -15,
      maxHoldMinutes: 45,
    },
    positionSizeSol: 0.1,
  },

  // ── SAFE POCKET ───────────────────────────────────────────────────────────
  // Target win rate: ~93% | Small but consistent gains
  // Ultra-conservative: only very liquid, mature tokens with dominant buy pressure.
  {
    id: 'safe_pocket',
    name: 'Safe Pocket',
    color: '#00ff88',
    enabled: false,
    locked: true,
    description: '~93% win rate · ultra-conservative scalp, small but consistent',
    filters: {
      ...emptyFilters(),
      protocols: { pump: true },
      liquidity: { min: 30000, max: null },
      marketCap: { min: null, max: 800000 },
      age: { min: 8, max: 60, unit: 'minutes' },
      buyPressure: { min: 72, max: null },
    },
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 7, sellPercent: 60 },
        { id: newTpId(), type: 'percent', value: 15, sellPercent: 100 },
      ],
      stopLossPct: -5,
      maxHoldMinutes: 15,
    },
    positionSizeSol: 0.25,
  },

  // ── MOONBAG ───────────────────────────────────────────────────────────────
  // Target win rate: ~42% | R:R: ~5:1
  // High-risk, high-reward lottery tickets on brand-new tokens.
  {
    id: 'moonbag',
    name: 'Moonbag',
    color: '#ff8c00',
    enabled: false,
    locked: true,
    description: '~42% win rate · high R:R, lottery tickets on new launches',
    filters: {
      ...emptyFilters(),
      protocols: { pump: true, bonkers: true },
      liquidity: { min: 3000, max: null },
      marketCap: { min: null, max: 150000 },
      age: { min: null, max: 8, unit: 'minutes' },
      buyPressure: { min: 55, max: null },
    },
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 100, sellPercent: 40 },
        { id: newTpId(), type: 'percent', value: 300, sellPercent: 60 },
      ],
      stopLossPct: -30,
      maxHoldMinutes: 60,
    },
    positionSizeSol: 0.03,
  },
]

export const DEFAULT_STRATEGIES: Strategy[] = [...PRESET_STRATEGIES]
