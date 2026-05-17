/**
 * Hyperliquid Risk Calculator — Pure Math Utilities
 *
 * No API calls, no side effects. All inputs are numbers.
 * Used by the order form, position display, and strategy engine.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default maintenance margin rate (0.5% = 0.005). HL actual rate varies by tier. */
export const DEFAULT_MAINTENANCE_MARGIN = 0.005

/** Taker fee rate on Hyperliquid (0.035%) */
export const TAKER_FEE_RATE = 0.00035

/** Maker fee rate on Hyperliquid (0.01%) */
export const MAKER_FEE_RATE = 0.0001

// ─────────────────────────────────────────────────────────────────────────────
// Position sizing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate safe position size in coin units given a risk budget.
 *
 * @param accountBalance  Total account equity in USD
 * @param riskPct         Fraction of account to risk on this trade (e.g. 0.02 = 2%)
 * @param entryPrice      Entry price per coin
 * @param stopLossPrice   Stop loss price (the price where you'll exit if wrong)
 * @returns Size in coin units
 */
export function calcPositionSize(
  accountBalance: number,
  riskPct: number,
  entryPrice: number,
  stopLossPrice: number,
): number {
  if (entryPrice <= 0 || stopLossPrice <= 0) return 0
  const riskPerCoin = Math.abs(entryPrice - stopLossPrice)
  if (riskPerCoin === 0) return 0
  const dollarRisk = accountBalance * riskPct
  return dollarRisk / riskPerCoin
}

/**
 * Calculate required initial margin for a position.
 *
 * @param size      Position size in coin units
 * @param price     Entry price
 * @param leverage  Leverage multiplier (e.g. 10 = 10x)
 * @returns Required margin in USD
 */
export function calcRequiredMargin(size: number, price: number, leverage: number): number {
  if (leverage <= 0) return 0
  return (size * price) / leverage
}

/**
 * Calculate effective leverage for a position given current margin.
 */
export function calcEffectiveLeverage(size: number, price: number, margin: number): number {
  if (margin <= 0) return 0
  return (size * price) / margin
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquidation price
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate liquidation price for an isolated margin position.
 *
 * Formula: Liquidation occurs when mark price moves against position
 * until remaining margin < maintenance margin.
 *
 * Long:  liquidationPx = entryPx * (1 - 1/leverage + maintenanceRate)
 * Short: liquidationPx = entryPx * (1 + 1/leverage - maintenanceRate)
 *
 * @param entryPrice          Average entry price
 * @param leverage            Position leverage
 * @param isLong              Direction of the trade
 * @param maintenanceMargin   Maintenance margin rate (default 0.5%)
 */
export function calcLiquidationPrice(
  entryPrice: number,
  leverage: number,
  isLong: boolean,
  maintenanceMargin = DEFAULT_MAINTENANCE_MARGIN,
): number {
  if (leverage <= 0 || entryPrice <= 0) return 0
  const factor = 1 / leverage - maintenanceMargin
  return isLong
    ? entryPrice * (1 - factor)
    : entryPrice * (1 + factor)
}

/**
 * Distance from current price to liquidation (in percentage).
 * Positive = safe (liquidation is further away from current).
 */
export function calcLiquidationDistance(
  currentPrice: number,
  liquidationPrice: number,
  isLong: boolean,
): number {
  if (currentPrice <= 0 || liquidationPrice <= 0) return 0
  const pct = ((liquidationPrice - currentPrice) / currentPrice) * 100
  return isLong ? -pct : pct  // long: liq below current (negative); short: above
}

// ─────────────────────────────────────────────────────────────────────────────
// P&L
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate unrealized P&L in USD for an open position.
 */
export function calcUnrealizedPnl(
  entryPrice: number,
  markPrice: number,
  size: number,       // coin units
  isLong: boolean,
): number {
  const direction = isLong ? 1 : -1
  return direction * size * (markPrice - entryPrice)
}

/**
 * Calculate P&L as a percentage of initial margin.
 */
export function calcPnlPct(pnlUsd: number, initialMargin: number): number {
  if (initialMargin <= 0) return 0
  return (pnlUsd / initialMargin) * 100
}

/**
 * Calculate break-even price after fees (taker + taker).
 */
export function calcBreakEvenPrice(entryPrice: number, isLong: boolean): number {
  const totalFeeRate = TAKER_FEE_RATE * 2
  return isLong
    ? entryPrice * (1 + totalFeeRate)
    : entryPrice * (1 - totalFeeRate)
}

// ─────────────────────────────────────────────────────────────────────────────
// TP / SL helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate take-profit price given a target R multiple.
 * rMultiple = reward / risk. So 2R means TP gives 2× what SL risks.
 *
 * @param entryPrice   Entry price
 * @param stopLoss     Stop loss price
 * @param rMultiple    Reward-to-risk ratio (e.g. 2.0 for 2R)
 * @param isLong       Direction
 */
export function calcTPFromR(
  entryPrice: number,
  stopLoss: number,
  rMultiple: number,
  isLong: boolean,
): number {
  const risk = Math.abs(entryPrice - stopLoss)
  return isLong
    ? entryPrice + risk * rMultiple
    : entryPrice - risk * rMultiple
}

/**
 * Calculate the R-multiple of a trade outcome.
 * Positive = profit in multiples of risk, negative = loss.
 */
export function calcRMultiple(
  entryPrice: number,
  exitPrice: number,
  stopLoss: number,
  isLong: boolean,
): number {
  const risk = Math.abs(entryPrice - stopLoss)
  if (risk === 0) return 0
  const outcome = isLong
    ? exitPrice - entryPrice
    : entryPrice - exitPrice
  return outcome / risk
}

// ─────────────────────────────────────────────────────────────────────────────
// Funding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate funding cost over a holding period.
 *
 * @param hourlyFundingRate  e.g. 0.0001 = 0.01% per hour
 * @param positionValueUsd   Position notional in USD
 * @param hours              How many hours to hold
 * @param isLong             Long pays positive funding, short receives it
 */
export function calcFundingCost(
  hourlyFundingRate: number,
  positionValueUsd: number,
  hours: number,
  isLong: boolean,
): number {
  const totalRate = hourlyFundingRate * hours
  const cost = positionValueUsd * totalRate
  return isLong ? -cost : cost  // long pays when rate > 0, short receives
}

// ─────────────────────────────────────────────────────────────────────────────
// Fees
// ─────────────────────────────────────────────────────────────────────────────

export function calcTakerFee(notionalUsd: number): number {
  return notionalUsd * TAKER_FEE_RATE
}

export function calcMakerFee(notionalUsd: number): number {
  return notionalUsd * MAKER_FEE_RATE
}

/**
 * Round-trip fee (enter + exit both as taker).
 */
export function calcRoundTripFee(notionalUsd: number): number {
  return calcTakerFee(notionalUsd) * 2
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a price for display. Adjusts decimal places based on magnitude. */
export function fmtHLPrice(price: number): string {
  if (!isFinite(price)) return '—'
  if (price >= 10_000)  return price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (price >= 100)     return price.toFixed(2)
  if (price >= 1)       return price.toFixed(4)
  return price.toFixed(6)
}

/** Format a USD value (e.g. P&L, balance). */
export function fmtHLUsd(value: number): string {
  if (!isFinite(value)) return '$—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(2)}K`
  return `${sign}$${abs.toFixed(2)}`
}

/** Format a percentage with sign (e.g. +12.5%, -3.2%) */
export function fmtHLPct(value: number, decimals = 2): string {
  if (!isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/** Format position size (coin units) */
export function fmtHLSize(size: number, szDecimals = 4): string {
  return size.toFixed(szDecimals)
}

/** Format funding rate as annualised % for human readability */
export function fmtFundingRate(hourlyRate: number): string {
  const annualised = hourlyRate * 24 * 365 * 100
  return `${annualised >= 0 ? '+' : ''}${annualised.toFixed(2)}% APR`
}
