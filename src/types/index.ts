export type ScoreGrade = 'SAFE' | 'WATCH' | 'RISK'
export type SignalSource = 'pumpfun' | 'raydium' | 'moonshot' | 'jupiter' | 'unknown'

export interface Signal {
  id: string
  ca: string
  token_name: string
  token_symbol: string
  scanner_score: number
  score_grade: ScoreGrade
  chain: 'solana'
  source: SignalSource
  liquidity_usd: number
  mcap_usd: number
  holders: number | null
  top_holder_pct: number | null
  mint_authority_revoked: boolean | null
  freeze_authority_revoked: boolean | null
  contract_age_minutes: number
  has_twitter: boolean
  has_website: boolean
  price_usd: number
  price_change_1h: number
  timestamp: string
  score_breakdown: ScoreBreakdown
  dex_url: string | null
  narrative_tags: string[]
  buy_pressure: number
  volume_1h: number
  fees_est_sol: number
  rug_score: number | null  // 0-1000 from RugCheck, higher = safer
  rug_risks: string[]       // danger/warn risk names
}

export interface ScoreBreakdown {
  liquidity: number    // 0-25
  activity: number     // 0-20 (replaces "holders" since we don't have holder count from free API)
  authority: number    // 0-20
  age: number          // 0-15
  socials: number      // 0-10
  distribution: number // 0-10
}
