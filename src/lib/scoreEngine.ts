/**
 * Signal Scoring Engine v2
 * ─────────────────────────────────────────────────────────────────
 * Grounded in Memecoin Trading Ecosystem 2026 research:
 *   §4.1  Momentum-Based Trading  — buy pressure + price momentum
 *   §4.3  Sentiment-Driven        — social presence
 *   §7.2  Rug Pull Indicators     — rug score + authority flags
 *   §3.3  Market Characteristics  — liquidity depth
 *
 * Breakdown (100 pts total):
 *   momentum    0-20  buy pressure (primary momentum signal)
 *   distribution 0-10  price change 1h (trend confirmation)
 *   liquidity   0-20  pool depth (execution quality)
 *   authority   0-20  rug safety: rug_score + mint/freeze flags
 *   age         0-15  sweet-spot window 5-45 min
 *   socials     0-15  Twitter + Telegram + Website
 *
 * Grades:
 *   SAFE  ≥ 70  — high-conviction signal
 *   WATCH ≥ 45  — worth tracking
 *   RISK  < 45  — speculative / new launch
 */

import type { ScoreBreakdown, ScoreGrade } from '../types'

export interface ScoreInput {
  liquidity_usd: number
  txns_1h: number
  source: string
  contract_age_minutes: number
  has_twitter: boolean
  has_website: boolean
  // Extended fields — all optional for backward compat with legacy callers
  buy_pressure?: number        // 0-100 (% of buys vs total txns)
  price_change_1h?: number     // % price change over last hour
  rug_score?: number | null    // 0-1000 from RugCheck (higher = safer)
  mint_authority_revoked?: boolean | null
  freeze_authority_revoked?: boolean | null
  has_telegram?: boolean
}

export function calculateScore(input: ScoreInput): {
  score: number
  grade: ScoreGrade
  breakdown: ScoreBreakdown
} {
  const momentum     = scoreMomentum(input.buy_pressure)
  const distribution = scorePriceChange(input.price_change_1h)
  const liquidity    = scoreLiquidity(input.liquidity_usd)
  const authority    = scoreSafety(input.rug_score, input.mint_authority_revoked, input.freeze_authority_revoked)
  const age          = scoreAge(input.contract_age_minutes)
  const socials      = scoreSocials(input.has_twitter, input.has_website, input.has_telegram)

  const total = momentum + distribution + liquidity + authority + age + socials
  const score = Math.min(100, Math.round(total))
  const grade: ScoreGrade = score >= 70 ? 'SAFE' : score >= 45 ? 'WATCH' : 'RISK'

  return {
    score,
    grade,
    breakdown: { liquidity, activity: momentum, authority, age, socials, distribution },
  }
}

// ── Momentum: buy pressure (§4.1 — "entries on volume spikes") ────────────────
// Buy pressure is the #1 leading indicator — percentage of buys vs total txns.
// Research: strategies require ≥58-72% buy pressure for reliable entries.
function scoreMomentum(buyPressure = 50): number {
  if (buyPressure >= 80) return 20   // Dominated by buyers — strong conviction
  if (buyPressure >= 70) return 16   // ANAKIN / Volume Surge threshold zone
  if (buyPressure >= 60) return 12   // Alpha Seeker / Social Alpha range
  if (buyPressure >= 55) return 8    // Minimum viable signal
  if (buyPressure >= 45) return 3    // Balanced — no real edge
  return 0                            // Sell pressure dominant — avoid
}

// ── Price momentum: 1h price change (§5.2 — sentiment correlation) ───────────
// Confirms the move is already happening. Research: 10-50% moves on 5x volume.
function scorePriceChange(change = 0): number {
  if (change >= 100) return 10   // Multi-x in 1h — high momentum (also risky late)
  if (change >= 50)  return 9    // Very strong uptrend
  if (change >= 20)  return 7    // Good confirmation
  if (change >= 5)   return 4    // Mild positive
  if (change >= 0)   return 1    // Flat
  if (change >= -10) return 0    // Slight dip
  return 0                        // Downtrending — skip
}

// ── Liquidity depth (§3.3 — "thin liquidity = large price impact") ────────────
// Larger pools allow real position sizes without slippage killing the trade.
function scoreLiquidity(usd: number): number {
  if (usd >= 100_000) return 20
  if (usd >= 50_000)  return 17
  if (usd >= 25_000)  return 13
  if (usd >= 10_000)  return 8
  if (usd >= 3_000)   return 3
  return 0
}

// ── Safety score (§7.2 — rug pull indicators) ────────────────────────────────
// rug_score from RugCheck: 0-1000, higher = safer.
// Mint/freeze authority revocation prevents rug-type attacks.
// Research: 30-40% of memecoins are scams — filtering here is critical.
function scoreSafety(
  rugScore: number | null | undefined,
  mintRevoked: boolean | null | undefined,
  freezeRevoked: boolean | null | undefined,
): number {
  let pts = 0

  // rug_score component (0-15)
  if (rugScore !== null && rugScore !== undefined) {
    if (rugScore >= 800) pts += 15      // Very safe by RugCheck
    else if (rugScore >= 600) pts += 11 // Above average safety
    else if (rugScore >= 400) pts += 6  // Moderate risk
    else if (rugScore >= 200) pts += 2  // High risk
    // <200: 0 — likely flagged
  } else {
    pts += 5  // Unknown = neutral (no data ≠ bad)
  }

  // Authority flags (0-5)
  if (mintRevoked && freezeRevoked) pts += 5   // Both revoked = max safety
  else if (mintRevoked)              pts += 3   // Mint revoked only
  else if (freezeRevoked)            pts += 2   // Freeze revoked only
  // Neither: +0

  return Math.min(20, pts)
}

// ── Age sweet spot (research: 5-45 min is optimal entry window) ───────────────
// Too early (<5 min): rug risk high, price discovery not started.
// Too late (>2h): most momentum already played out.
// §4.1: "exit as momentum slows" — catches the sweet spot before reversal.
function scoreAge(minutes: number): number {
  if (minutes >= 5  && minutes < 45)  return 15  // Prime momentum window
  if (minutes >= 45 && minutes < 120) return 10  // Still viable but later
  if (minutes >= 2  && minutes < 5)   return 6   // Very early — risky but possible
  if (minutes >= 120 && minutes < 240) return 5  // 2-4h: late stage
  if (minutes < 2)                     return 2  // Instant — sniper territory only
  return 1                                         // >4h: stale
}

// ── Socials (§4.3 — social presence correlates with sustained runs) ───────────
// Sentiment-driven trading requires active social channels.
// Research: tokens with Twitter + community channels sustain moves longer.
function scoreSocials(twitter: boolean, website: boolean, telegram = false): number {
  const count = (twitter ? 1 : 0) + (website ? 1 : 0) + (telegram ? 1 : 0)
  if (count === 3) return 15   // Full social stack — best quality signal
  if (twitter && telegram) return 12  // The key combo for sentiment plays
  if (twitter && website)  return 10  // Twitter + site
  if (twitter)              return 7  // Twitter only
  if (telegram)             return 5  // Telegram only
  if (website)              return 3  // Website only
  return 0                             // No socials — avoid
}
