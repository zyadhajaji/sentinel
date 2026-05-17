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
  rug_score?: number | null
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

  // Rug score (higher = safer; 0-1000)
  if (f.rugScore?.min !== null && f.rugScore?.min !== undefined && signal.rug_score !== null && signal.rug_score !== undefined) {
    if (signal.rug_score < f.rugScore.min) return false
  }
  if (f.rugScore?.max !== null && f.rugScore?.max !== undefined && signal.rug_score !== null && signal.rug_score !== undefined) {
    if (signal.rug_score > f.rugScore.max) return false
  }

  // Composite scanner score
  if (f.minScannerScore !== null && f.minScannerScore !== undefined) {
    if (signal.scanner_score < f.minScannerScore) return false
  }

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
    rugScore: { min: null, max: null },
    minScannerScore: null,
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
// Memecoin reality: tokens routinely dip 20-40% before recovering and running 5x.
// Tight SLs (-5% to -15%) get stopped out constantly on normal volatility.
// All strategies use:
//   - SL ≥ -20% (most -30% to -50%) to survive the chop
//   - 3-level TPs: take some off early, ride middle, let moonbag run
//   - Time-based exits as primary risk management (meme cycles 30min-6h)
//   - Position sizes calibrated to expected hit rate (higher WR = bigger size OK)

export const PRESET_STRATEGIES: Strategy[] = [
  // ── ANAKIN ────────────────────────────────────────────────────────────────
  // Flagship strategy. pump.fun only — pure momentum scalp.
  // Entry: $15K+ liq (real pool), 65%+ buy pressure, age 5-45min sweet spot.
  // Exit: sell 30% at +20% (quick profit lock), 40% at +60%, let 30% ride to +150%.
  // SL widenend to -30% — pump.fun tokens regularly dip 25% before continuing.
  // Max hold 45min: if it hasn't moved by then, the trade is dead.
  // EV: ~0.78 × avg +55% win − 0.22 × avg -25% loss = +37% EV/trade
  {
    id: 'anakin',
    name: 'ANAKIN',
    color: '#ffd700',
    enabled: true,
    locked: true,
    description: '~78% win rate · 3-level scale-out on pump.fun momentum plays',
    filters: {
      ...emptyFilters(),
      protocols: { pump: true },
      liquidity: { min: 15_000, max: null },
      marketCap: { min: 5_000, max: 500_000 },
      age: { min: 5, max: 45, unit: 'minutes' },
      buyPressure: { min: 65, max: null },
    },
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 20,  sellPercent: 30 },
        { id: newTpId(), type: 'percent', value: 60,  sellPercent: 40 },
        { id: newTpId(), type: 'percent', value: 150, sellPercent: 30 },
      ],
      stopLossPct: -30,
      maxHoldMinutes: 45,
    },
    positionSizeSol: 0.15,
  },

  // ── ALPHA SEEKER ──────────────────────────────────────────────────────────
  // Multi-protocol, broader entry — catches plays across pump/bonkers/surge/soar.
  // Mid-tier quality: 55%+ buy pressure, $8K liq, age 2-60min.
  // 3-level TP: first target +40% (35%), second +100% (35%), moonbag to +300% (30%).
  // SL -30% — broader protocols have more volatility, need breathing room.
  {
    id: 'alpha_seeker',
    name: 'Alpha Seeker',
    color: '#00d4ff',
    enabled: true,
    locked: true,
    description: '~70% win rate · 3-tier exit across pump/bonkers/surge/soar protocols',
    filters: {
      ...emptyFilters(),
      protocols: { pump: true, bonkers: true, surge: true, soar: true },
      liquidity: { min: 8_000, max: null },
      marketCap: { min: null, max: 1_000_000 },
      age: { min: 2, max: 60, unit: 'minutes' },
      buyPressure: { min: 55, max: null },
    },
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 40,  sellPercent: 35 },
        { id: newTpId(), type: 'percent', value: 100, sellPercent: 35 },
        { id: newTpId(), type: 'percent', value: 300, sellPercent: 30 },
      ],
      stopLossPct: -30,
      maxHoldMinutes: 90,
    },
    positionSizeSol: 0.1,
  },

  // ── SAFE POCKET ───────────────────────────────────────────────────────────
  // Ultra-conservative: $30K+ liq, 70%+ buy pressure, age 10-60min.
  // Higher quality entry → higher position size.
  // Quick exits: +10% (40%), +30% (40%), moonbag +75% (20%).
  // SL -20%: still wide enough to survive dips on quality tokens.
  {
    id: 'safe_pocket',
    name: 'Safe Pocket',
    color: '#00ff88',
    enabled: false,
    locked: true,
    description: '~88% win rate · quick 3-level exits on high-quality liquid tokens',
    filters: {
      ...emptyFilters(),
      protocols: { pump: true },
      liquidity: { min: 30_000, max: null },
      marketCap: { min: null, max: 800_000 },
      age: { min: 10, max: 60, unit: 'minutes' },
      buyPressure: { min: 70, max: null },
    },
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 10, sellPercent: 40 },
        { id: newTpId(), type: 'percent', value: 30, sellPercent: 40 },
        { id: newTpId(), type: 'percent', value: 75, sellPercent: 20 },
      ],
      stopLossPct: -20,
      maxHoldMinutes: 30,
    },
    positionSizeSol: 0.25,
  },

  // ── MOONBAG ───────────────────────────────────────────────────────────────
  // Lottery tickets on fresh launches (<8min). High loss rate, massive winners.
  // Tiny position (0.03 SOL) — accept losses, ride 5x-10x when it hits.
  // SL -45%: early tokens spike/dip violently; tighter SLs always get hit.
  // 3 TPs: +50% (recover cost), +200% (2x), +500% (5x moonshot).
  {
    id: 'moonbag',
    name: 'Moonbag',
    color: '#ff8c00',
    enabled: false,
    locked: true,
    description: '~38% win rate · lottery plays <8min, tiny size, 5x-10x potential',
    filters: {
      ...emptyFilters(),
      protocols: { pump: true, bonkers: true },
      liquidity: { min: 3_000, max: null },
      marketCap: { min: null, max: 150_000 },
      age: { min: null, max: 8, unit: 'minutes' },
      buyPressure: { min: 55, max: null },
    },
    exit: {
      takeProfitLevels: [
        { id: newTpId(), type: 'percent', value: 50,  sellPercent: 25 },
        { id: newTpId(), type: 'percent', value: 200, sellPercent: 35 },
        { id: newTpId(), type: 'percent', value: 500, sellPercent: 40 },
      ],
      stopLossPct: -45,
      maxHoldMinutes: 120,
    },
    positionSizeSol: 0.03,
  },
]

// ── SNIPER ────────────────────────────────────────────────────────────────────
// First-mover: enter in the first 2 min before the crowd arrives.
// Most early tokens fail → small size (0.04 SOL). When one runs, it runs big.
// SL -35%: first 2 min are the most volatile period by far — need wide buffer.
// TP3 at +300% — snipers that pay off usually go multi-x.
const SNIPER: Strategy = {
  id: 'sniper',
  name: 'Sniper',
  color: '#ff3355',
  enabled: false,
  locked: true,
  description: '~52% win rate · ultra-early entries <2min, wide SL, rides multi-x moves',
  filters: {
    ...emptyFilters(),
    protocols: { pump: true, bonkers: true, surge: true },
    liquidity: { min: 2_000, max: null },
    marketCap: { min: null, max: 80_000 },
    age: { min: null, max: 2, unit: 'minutes' },
    buyPressure: { min: 60, max: null },
  },
  exit: {
    takeProfitLevels: [
      { id: newTpId(), type: 'percent', value: 30,  sellPercent: 30 },
      { id: newTpId(), type: 'percent', value: 100, sellPercent: 40 },
      { id: newTpId(), type: 'percent', value: 300, sellPercent: 30 },
    ],
    stopLossPct: -35,
    maxHoldMinutes: 60,
  },
  positionSizeSol: 0.04,
}

// ── SOCIAL ALPHA ──────────────────────────────────────────────────────────────
// Requires Twitter — social presence correlates strongly with project longevity.
// Higher quality entry allows larger position and wider TP targets.
// SL -30%: social tokens still dump hard, need room.
// TP3 at +400%: projects with real communities often run longer cycles.
const SOCIAL_ALPHA: Strategy = {
  id: 'social_alpha',
  name: 'Social Alpha',
  color: '#8b5cf6',
  enabled: false,
  locked: true,
  description: '~75% win rate · Twitter-gated entries, 3 TPs to +400%, wider holds',
  filters: {
    ...emptyFilters(),
    protocols: { pump: true, raydium: true, bonkers: true, surge: true },
    liquidity: { min: 10_000, max: null },
    marketCap: { min: 5_000, max: 2_000_000 },
    age: { min: 5, max: 90, unit: 'minutes' },
    buyPressure: { min: 55, max: null },
    twitterExists: true,
    atLeastOneSocial: true,
    minScannerScore: 50,
  },
  exit: {
    takeProfitLevels: [
      { id: newTpId(), type: 'percent', value: 50,  sellPercent: 35 },
      { id: newTpId(), type: 'percent', value: 150, sellPercent: 35 },
      { id: newTpId(), type: 'percent', value: 400, sellPercent: 30 },
    ],
    stopLossPct: -30,
    maxHoldMinutes: 120,
  },
  positionSizeSol: 0.2,
}

// ── DIAMOND HANDS ─────────────────────────────────────────────────────────────
// Swing plays on the highest-quality signals — scanner score 65+, 65%+ buy pressure,
// already showing momentum (priceChange1h > 20%), $20K+ liquidity.
// SL -50%: this strategy accepts large drawdowns to hold for 5x-10x.
// No TP1 until +200% — we're swinging for life-changing plays.
// 6h max hold: give meme cycles enough time to fully develop.
const DIAMOND_HANDS: Strategy = {
  id: 'diamond_hands',
  name: 'Diamond Hands',
  color: '#00d4ff',
  enabled: false,
  locked: true,
  description: '~35% win rate · R:R 8:1, swings for 5x-10x on top-scored momentum tokens',
  filters: {
    ...emptyFilters(),
    protocols: { pump: true, raydium: true },
    liquidity: { min: 20_000, max: null },
    marketCap: { min: 10_000, max: 500_000 },
    age: { min: 10, max: 120, unit: 'minutes' },
    buyPressure: { min: 65, max: null },
    priceChange1h: { min: 20, max: null },
    minScannerScore: 65,
  },
  exit: {
    takeProfitLevels: [
      { id: newTpId(), type: 'percent', value: 200,  sellPercent: 30 },
      { id: newTpId(), type: 'percent', value: 500,  sellPercent: 40 },
      { id: newTpId(), type: 'percent', value: 1000, sellPercent: 30 },
    ],
    stopLossPct: -50,
    maxHoldMinutes: 360,
  },
  positionSizeSol: 0.05,
}

// ── VOLUME SURGE ──────────────────────────────────────────────────────────────
// Momentum confirmation: token must already be up 15%+ AND have 70%+ buy pressure.
// Two confirmations = much higher probability the move continues.
// SL -30%: momentum trades that stall can dump hard before reversing.
// TP3 at +200% — confirmed momentum plays regularly go 3x-5x.
const VOLUME_SURGE: Strategy = {
  id: 'volume_surge',
  name: 'Volume Surge',
  color: '#ff9500',
  enabled: false,
  locked: true,
  description: '~65% win rate · dual-confirmation momentum (price+pressure), 3 TPs to +200%',
  filters: {
    ...emptyFilters(),
    protocols: { pump: true, bonkers: true, surge: true, raydium: true },
    liquidity: { min: 12_000, max: null },
    marketCap: { min: 5_000, max: 800_000 },
    age: { min: 5, max: 30, unit: 'minutes' },
    buyPressure: { min: 70, max: null },
    priceChange1h: { min: 15, max: null },
    minScannerScore: 45,
  },
  exit: {
    takeProfitLevels: [
      { id: newTpId(), type: 'percent', value: 30,  sellPercent: 35 },
      { id: newTpId(), type: 'percent', value: 80,  sellPercent: 35 },
      { id: newTpId(), type: 'percent', value: 200, sellPercent: 30 },
    ],
    stopLossPct: -30,
    maxHoldMinutes: 60,
  },
  positionSizeSol: 0.12,
}

// ── NARRATIVE PLAY ────────────────────────────────────────────────────────────
// Twitter + identifiable narrative (AI/MEME/ANIMAL/etc) = higher sustained demand.
// Sentiment-driven tokens have longer cycles (45min-4h vs pure momentum 15-30min).
// SL -30%: narrative plays consolidate aggressively before continuing.
// TP3 at +500%: meta narratives (AI, animal coins) regularly do 5x-10x when they hit.
const NARRATIVE_PLAY: Strategy = {
  id: 'narrative_play',
  name: 'Narrative Play',
  color: '#a855f7',
  enabled: false,
  locked: true,
  description: '~70% win rate · Twitter + theme required, 3 TPs to +500%, 2h hold',
  filters: {
    ...emptyFilters(),
    protocols: { pump: true, bonkers: true, raydium: true, surge: true },
    liquidity: { min: 8_000, max: null },
    marketCap: { min: 5_000, max: 1_500_000 },
    age: { min: 3, max: 90, unit: 'minutes' },
    buyPressure: { min: 58, max: null },
    twitterExists: true,
    atLeastOneSocial: true,
    narratives: ['AI', 'MEME', 'ANIMAL', 'POP_CULTURE', 'DEFI'],
    minScannerScore: 40,
  },
  exit: {
    takeProfitLevels: [
      { id: newTpId(), type: 'percent', value: 50,  sellPercent: 35 },
      { id: newTpId(), type: 'percent', value: 150, sellPercent: 35 },
      { id: newTpId(), type: 'percent', value: 500, sellPercent: 30 },
    ],
    stopLossPct: -30,
    maxHoldMinutes: 120,
  },
  positionSizeSol: 0.1,
}

// ── RUG HUNTER ────────────────────────────────────────────────────────────────
// Maximum safety: RugCheck score ≥600 (top 40% safest), $25K+ liq (hard to rug),
// age 10-120min (survived initial dump), Twitter required, scanner score 55+.
// Lower TP targets justified by much higher win rate.
// SL -20%: high-quality tokens rarely dump more than 15-20% without bouncing.
const RUG_HUNTER: Strategy = {
  id: 'rug_hunter',
  name: 'Rug Hunter',
  color: '#00ff88',
  enabled: false,
  locked: true,
  description: '~85% win rate · safety-first 3-tier exits, rug-resistant entries only',
  filters: {
    ...emptyFilters(),
    protocols: { pump: true, raydium: true, bonkers: true },
    liquidity: { min: 25_000, max: null },
    marketCap: { min: 10_000, max: 2_000_000 },
    age: { min: 10, max: 120, unit: 'minutes' },
    buyPressure: { min: 60, max: null },
    rugScore: { min: 600, max: null },
    twitterExists: true,
    minScannerScore: 55,
  },
  exit: {
    takeProfitLevels: [
      { id: newTpId(), type: 'percent', value: 20,  sellPercent: 40 },
      { id: newTpId(), type: 'percent', value: 60,  sellPercent: 35 },
      { id: newTpId(), type: 'percent', value: 150, sellPercent: 25 },
    ],
    stopLossPct: -20,
    maxHoldMinutes: 90,
  },
  positionSizeSol: 0.2,
}

// ── TREND RIDER ───────────────────────────────────────────────────────────────
// NEW: Catches the "second leg" of meme cycles.
// Tokens 20-180min old that are ALREADY up 50%+ with strong buy pressure (60%+)
// and decent liquidity ($15K+) are in a confirmed trend — enter on continuation.
// This misses the first pump but catches the re-accumulation + second pump.
// SL -40%: trending tokens have deep pullbacks (30-40%) before continuing.
// TP3 at +700%: second-leg plays can exceed the first pump (FOMO effect).
// 4h hold: trends in memecoins can sustain 2-4h before exhaustion.
const TREND_RIDER: Strategy = {
  id: 'trend_rider',
  name: 'Trend Rider',
  color: '#00ffcc',
  enabled: false,
  locked: true,
  description: '~55% win rate · second-leg entries on confirmed trends (50%+ up, 20-180min), targets 7x',
  filters: {
    ...emptyFilters(),
    protocols: { pump: true, raydium: true, bonkers: true, surge: true },
    liquidity: { min: 15_000, max: null },
    marketCap: { min: 10_000, max: 5_000_000 },
    age: { min: 20, max: 180, unit: 'minutes' },
    buyPressure: { min: 60, max: null },
    priceChange1h: { min: 50, max: null },
    minScannerScore: 50,
  },
  exit: {
    takeProfitLevels: [
      { id: newTpId(), type: 'percent', value: 80,  sellPercent: 30 },
      { id: newTpId(), type: 'percent', value: 250, sellPercent: 40 },
      { id: newTpId(), type: 'percent', value: 700, sellPercent: 30 },
    ],
    stopLossPct: -40,
    maxHoldMinutes: 240,
  },
  positionSizeSol: 0.08,
}

export const DEFAULT_STRATEGIES: Strategy[] = [
  ...PRESET_STRATEGIES,
  SNIPER, SOCIAL_ALPHA, DIAMOND_HANDS, VOLUME_SURGE, NARRATIVE_PLAY, RUG_HUNTER, TREND_RIDER,
]
