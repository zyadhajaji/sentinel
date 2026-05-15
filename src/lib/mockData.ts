import type { Signal, ScoreBreakdown, ScoreGrade, SignalSource } from '../types'

const TOKEN_NAMES = [
  'BONK2', 'PEPE3', 'DOGE9', 'SHIB2', 'WIF3', 'POPCAT2', 'BOME2', 'MEW2',
  'SLERF2', 'MOODENG2', 'PNUT3', 'GOAT2', 'ZEREBRO2', 'AI16Z2', 'FARTCOIN',
  'GIGACHAD', 'SIGMA', 'ALPHA', 'BETA', 'OMEGA', 'MOON', 'SOLCAT', 'SOLDOG',
  'BULLRUN', 'PUMP', 'CHAD', 'BASED', 'REKT', 'APE', 'DEGEN',
]

const SOURCES: SignalSource[] = ['pumpfun', 'raydium', 'moonshot', 'jupiter', 'unknown']

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max))
}

function generateCA(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  return Array.from({ length: 44 }, () => chars[randomInt(0, chars.length)]).join('')
}

function generateID(): string {
  return Math.random().toString(36).slice(2, 11)
}

function calcGrade(score: number): ScoreGrade {
  if (score >= 70) return 'SAFE'
  if (score >= 40) return 'WATCH'
  return 'RISK'
}

export function generateSignal(): Signal {
  const breakdown: ScoreBreakdown = {
    liquidity: randomInt(5, 25),
    activity: randomInt(5, 20),
    authority: randomInt(0, 20),
    age: randomInt(2, 15),
    socials: randomInt(0, 10),
    distribution: randomInt(2, 10),
  }
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const clampedScore = Math.min(100, score)

  const mcap = randomBetween(50_000, 5_000_000)
  const liquidity = randomBetween(mcap * 0.05, mcap * 0.4)
  const nameIdx = randomInt(0, TOKEN_NAMES.length)
  const name = TOKEN_NAMES[nameIdx]

  return {
    id: generateID(),
    ca: generateCA(),
    token_name: name,
    token_symbol: name,
    scanner_score: clampedScore,
    score_grade: calcGrade(clampedScore),
    chain: 'solana',
    source: SOURCES[randomInt(0, SOURCES.length)],
    liquidity_usd: liquidity,
    mcap_usd: mcap,
    entry_mcap_usd: mcap,
    holders: randomInt(50, 3000),
    top_holder_pct: randomBetween(3, 35),
    mint_authority_revoked: Math.random() > 0.3 as boolean | null,
    freeze_authority_revoked: Math.random() > 0.3 as boolean | null,
    contract_age_minutes: randomInt(5, 120),
    has_twitter: Math.random() > 0.4,
    has_website: Math.random() > 0.6,
    image_url: null,
    twitter_url: Math.random() > 0.4 ? 'https://x.com/example' : null,
    telegram_url: Math.random() > 0.6 ? 'https://t.me/example' : null,
    website_url: Math.random() > 0.6 ? 'https://example.com' : null,
    price_usd: randomBetween(0.000001, 0.01),
    price_change_1h: randomBetween(-60, 200),
    timestamp: new Date().toISOString(),
    score_breakdown: breakdown,
    dex_url: null,
    narrative_tags: [],
    buy_pressure: randomInt(30, 80),
    volume_1h: randomBetween(0, 50000),
    fees_est_sol: randomBetween(0, 3),
    rug_score: null,
    rug_risks: [],
  }
}

export function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

export function formatPrice(value: number): string {
  if (value < 0.0001) return value.toExponential(2)
  return value.toFixed(6)
}

export function shortCA(ca: string): string {
  return `${ca.slice(0, 4)}...${ca.slice(-4)}`
}

export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}
