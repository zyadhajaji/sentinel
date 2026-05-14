const BASE = 'https://api.dexscreener.com'

export interface DexPair {
  chainId: string
  dexId: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  priceUsd: string
  txns: { h1: { buys: number; sells: number }; h24: { buys: number; sells: number } }
  volume: { h24: number; h1: number }
  priceChange: { h1: number; h24: number }
  liquidity: { usd: number }
  fdv: number
  marketCap: number
  pairCreatedAt: number
  info?: {
    imageUrl?: string
    socials?: { type: string; url: string }[]
    websites?: { url: string }[]
  }
}

export interface TokenProfile {
  url: string
  chainId: string
  tokenAddress: string
  icon?: string
  description?: string
  links?: { type: string; label: string; url: string }[]
}

export async function fetchTokenProfiles(): Promise<TokenProfile[]> {
  try {
    const res = await fetch(`${BASE}/token-profiles/latest/v1`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []).filter((t: TokenProfile) => t.chainId === 'solana')
  } catch {
    return []
  }
}

export async function fetchTokenPairs(tokenAddress: string): Promise<DexPair | null> {
  try {
    const res = await fetch(`${BASE}/latest/dex/tokens/${tokenAddress}`)
    if (!res.ok) return null
    const data = await res.json()
    const pairs: DexPair[] = data.pairs ?? []
    const solana = pairs.filter(p => p.chainId === 'solana')
    if (solana.length === 0) return null
    return solana.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null
  } catch {
    return null
  }
}
