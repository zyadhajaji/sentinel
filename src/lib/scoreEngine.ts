import type { ScoreBreakdown, ScoreGrade, SignalSource } from '../types'

interface ScoreInput {
  liquidity_usd: number
  txns_1h: number
  source: SignalSource
  contract_age_minutes: number
  has_twitter: boolean
  has_website: boolean
}

export function calculateScore(input: ScoreInput): { score: number; grade: ScoreGrade; breakdown: ScoreBreakdown } {
  const liquidity = scoreLiquidity(input.liquidity_usd)
  const activity = scoreActivity(input.txns_1h)
  const authority = scoreAuthority(input.source)
  const age = scoreAge(input.contract_age_minutes)
  const socials = (input.has_twitter ? 5 : 0) + (input.has_website ? 5 : 0)
  const distribution = 5

  const total = liquidity + activity + authority + age + socials + distribution
  const score = Math.min(100, Math.round(total))
  const grade: ScoreGrade = score >= 70 ? 'SAFE' : score >= 40 ? 'WATCH' : 'RISK'

  return {
    score,
    grade,
    breakdown: { liquidity, activity, authority, age, socials, distribution },
  }
}

function scoreLiquidity(usd: number): number {
  if (usd >= 100_000) return 25
  if (usd >= 50_000) return 20
  if (usd >= 15_000) return 15
  if (usd >= 5_000) return 8
  return 0
}

function scoreActivity(txns: number): number {
  if (txns >= 200) return 20
  if (txns >= 50) return 17
  if (txns >= 10) return 12
  return 5
}

function scoreAuthority(source: SignalSource): number {
  if (source === 'pumpfun') return 20
  return 10
}

function scoreAge(minutes: number): number {
  if (minutes > 30) return 15
  if (minutes > 15) return 12
  if (minutes > 5) return 8
  return 2
}
