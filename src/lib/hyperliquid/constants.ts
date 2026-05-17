/**
 * Hyperliquid — well-known market constants
 *
 * Provides display metadata, popular market lists, and quick-access
 * coin info used throughout the Markets tab and order form.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Popular / featured markets (shown first in the market selector)
// ─────────────────────────────────────────────────────────────────────────────

/** Coins surfaced prominently in the Markets tab (sorted by expected volume) */
export const POPULAR_MARKETS: readonly string[] = [
  'BTC',
  'ETH',
  'SOL',
  'BNB',
  'XRP',
  'DOGE',
  'WIF',
  'PEPE',
  'ARB',
  'OP',
  'AVAX',
  'MATIC',
  'LINK',
  'NEAR',
  'SUI',
  'APT',
  'TIA',
  'INJ',
  'SEI',
  'TRUMP',
] as const

/** Coins that typically have tight spreads and deep liquidity */
export const LIQUID_MARKETS: readonly string[] = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP',
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Display metadata — colour + full name for known coins
// ─────────────────────────────────────────────────────────────────────────────

export interface CoinMeta {
  fullName:   string
  color:      string    // accent colour for charts / badges (hex)
  emoji?:     string    // optional display emoji
}

export const COIN_META: Record<string, CoinMeta> = {
  BTC:   { fullName: 'Bitcoin',        color: '#f7931a' },
  ETH:   { fullName: 'Ethereum',       color: '#627eea' },
  SOL:   { fullName: 'Solana',         color: '#9945ff' },
  BNB:   { fullName: 'BNB',            color: '#f3ba2f' },
  XRP:   { fullName: 'XRP',            color: '#346aa9' },
  DOGE:  { fullName: 'Dogecoin',       color: '#c2a633' },
  WIF:   { fullName: 'dogwifhat',      color: '#e84142' },
  PEPE:  { fullName: 'Pepe',           color: '#4caf50' },
  ARB:   { fullName: 'Arbitrum',       color: '#28a0f0' },
  OP:    { fullName: 'Optimism',       color: '#ff0420' },
  AVAX:  { fullName: 'Avalanche',      color: '#e84142' },
  MATIC: { fullName: 'Polygon',        color: '#8247e5' },
  LINK:  { fullName: 'Chainlink',      color: '#375bd2' },
  NEAR:  { fullName: 'NEAR Protocol',  color: '#00c08b' },
  SUI:   { fullName: 'Sui',            color: '#4da2ff' },
  APT:   { fullName: 'Aptos',          color: '#00b5d8' },
  TIA:   { fullName: 'Celestia',       color: '#7b2fff' },
  INJ:   { fullName: 'Injective',      color: '#00a3ff' },
  SEI:   { fullName: 'Sei',            color: '#d00c2b' },
  TRUMP: { fullName: 'TRUMP',          color: '#c8102e' },
  LTC:   { fullName: 'Litecoin',       color: '#bfbbbb' },
  DOT:   { fullName: 'Polkadot',       color: '#e6007a' },
  ADA:   { fullName: 'Cardano',        color: '#0033ad' },
  ATOM:  { fullName: 'Cosmos',         color: '#2e3148' },
  FIL:   { fullName: 'Filecoin',       color: '#0090ff' },
  AAVE:  { fullName: 'Aave',           color: '#b6509e' },
  UNI:   { fullName: 'Uniswap',        color: '#ff007a' },
  CRV:   { fullName: 'Curve',          color: '#3366bb' },
  MKR:   { fullName: 'Maker',          color: '#1aab9b' },
  SNX:   { fullName: 'Synthetix',      color: '#00d1ff' },
}

/**
 * Get display colour for a coin. Falls back to a deterministic grey if unknown.
 */
export function getCoinColor(coin: string): string {
  return COIN_META[coin]?.color ?? '#888888'
}

/**
 * Get the full name for a coin, falling back to the coin ticker itself.
 */
export function getCoinFullName(coin: string): string {
  return COIN_META[coin]?.fullName ?? coin
}

// ─────────────────────────────────────────────────────────────────────────────
// Order form defaults
// ─────────────────────────────────────────────────────────────────────────────

/** Default leverage when opening the order form */
export const DEFAULT_LEVERAGE = 10

/** Max leverage we allow in the UI (hard cap, regardless of coin max) */
export const UI_MAX_LEVERAGE = 50

/** Default risk per trade as fraction of account equity */
export const DEFAULT_RISK_PCT = 0.02   // 2%

/** Default TP in R-multiples */
export const DEFAULT_TP_R = 2.0

// ─────────────────────────────────────────────────────────────────────────────
// Demo mode mock data
// ─────────────────────────────────────────────────────────────────────────────

/** Fake balance shown in demo mode (SOL equivalent used for display) */
export const DEMO_DEFAULT_BALANCE_USD = 25_000

/** Markets pre-selected as favourites in demo mode */
export const DEMO_FAVOURITE_MARKETS = ['BTC', 'ETH', 'SOL', 'WIF', 'PEPE']
