import { useState, useEffect, useRef, useCallback } from 'react'
import type { Signal, SignalSource } from '../types'
import { PumpFunWS } from '../lib/pumpfun'
import type { PumpFunToken } from '../lib/pumpfun'
import { fetchTokenPairs, fetchTokenProfiles } from '../lib/dexscreener'
import type { DexPair, TokenProfile } from '../lib/dexscreener'
import { calculateScore } from '../lib/scoreEngine'
import { detectNarratives } from '../lib/narrativeEngine'
import { triggerAlert, DEFAULT_ALERT_SETTINGS } from '../lib/alertEngine'
import type { AlertSettings } from '../lib/alertEngine'

const MAX_SIGNALS = 50
const PROFILE_POLL_MS = 20_000
const SEEN_TTL_MS = 10 * 60 * 1000

function genId() {
  return Math.random().toString(36).slice(2, 11)
}

function ageMinutes(createdAt: number): number {
  return Math.floor((Date.now() - createdAt) / 60_000)
}

function pairToSignal(pair: DexPair, profile?: TokenProfile): Signal {
  const source: SignalSource = pair.dexId?.includes('pump') ? 'pumpfun'
    : pair.dexId?.includes('raydium') ? 'raydium'
    : pair.dexId?.includes('moonshot') ? 'moonshot'
    : pair.dexId?.includes('jupiter') ? 'jupiter'
    : 'unknown'

  const hasTwitter = !!(profile?.links?.some(l => l.type === 'twitter' || l.url?.includes('twitter') || l.url?.includes('x.com'))
    || pair.info?.socials?.some(s => s.type === 'twitter'))
  const hasWebsite = !!(profile?.links?.some(l => l.type === 'website' || (!l.url?.includes('twitter') && !l.url?.includes('t.me')))
    || (pair.info?.websites?.length ?? 0) > 0)

  const contractAgeMins = pair.pairCreatedAt ? ageMinutes(pair.pairCreatedAt) : 30
  const txns1h = (pair.txns?.h1?.buys ?? 0) + (pair.txns?.h1?.sells ?? 0)
  const liquidity = pair.liquidity?.usd ?? 0

  const { score, grade, breakdown } = calculateScore({
    liquidity_usd: liquidity,
    txns_1h: txns1h,
    source,
    contract_age_minutes: contractAgeMins,
    has_twitter: hasTwitter,
    has_website: hasWebsite,
  })

  const txnsH1 = pair.txns?.h1 ?? { buys: 0, sells: 0 }
  const totalTxns = txnsH1.buys + txnsH1.sells
  const buy_pressure = totalTxns > 0 ? Math.round((txnsH1.buys / totalTxns) * 100) : 50
  const volume_1h = pair.volume?.h1 ?? 0
  const fees_est_sol = (volume_1h * 0.01) / 150
  const narrative_tags = detectNarratives(pair.baseToken.name, pair.baseToken.symbol)

  return {
    id: genId(),
    ca: pair.baseToken.address,
    token_name: pair.baseToken.name,
    token_symbol: pair.baseToken.symbol,
    scanner_score: score,
    score_grade: grade,
    chain: 'solana',
    source,
    liquidity_usd: liquidity,
    mcap_usd: pair.marketCap ?? pair.fdv ?? 0,
    holders: null,
    top_holder_pct: null,
    mint_authority_revoked: source === 'pumpfun' ? true : null,
    freeze_authority_revoked: source === 'pumpfun' ? true : null,
    contract_age_minutes: contractAgeMins,
    has_twitter: hasTwitter,
    has_website: hasWebsite,
    price_usd: parseFloat(pair.priceUsd ?? '0') || 0,
    price_change_1h: pair.priceChange?.h1 ?? 0,
    timestamp: new Date().toISOString(),
    score_breakdown: breakdown,
    dex_url: `https://dexscreener.com/solana/${pair.baseToken.address}`,
    narrative_tags,
    buy_pressure,
    volume_1h,
    fees_est_sol,
  }
}

function pumpFunToSignal(token: PumpFunToken): Signal {
  // Before DexScreener indexes the token — estimate from bonding curve
  const solPrice = 150 // rough estimate; replace with live feed later
  const mcapSolUsd = (token.marketCapSol ?? 0) * solPrice
  const liquidityUsd = (token.vSolInBondingCurve ?? 0) * solPrice * 2

  const { score, grade, breakdown } = calculateScore({
    liquidity_usd: liquidityUsd,
    txns_1h: 5, // very new, assume low
    source: 'pumpfun',
    contract_age_minutes: 0,
    has_twitter: false,
    has_website: false,
  })

  return {
    id: genId(),
    ca: token.mint,
    token_name: token.name || token.symbol,
    token_symbol: token.symbol,
    scanner_score: score,
    score_grade: grade,
    chain: 'solana',
    source: 'pumpfun',
    liquidity_usd: liquidityUsd,
    mcap_usd: mcapSolUsd,
    holders: null,
    top_holder_pct: null,
    mint_authority_revoked: true,
    freeze_authority_revoked: true,
    contract_age_minutes: 0,
    has_twitter: false,
    has_website: false,
    price_usd: 0,
    price_change_1h: 0,
    timestamp: new Date().toISOString(),
    score_breakdown: breakdown,
    dex_url: `https://pump.fun/${token.mint}`,
    narrative_tags: detectNarratives(token.name || token.symbol, token.symbol),
    buy_pressure: 50,
    volume_1h: 0,
    fees_est_sol: 0,
  }
}

export function useSignalFeed() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [newSignalId, setNewSignalId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS)
  const seenCAs = useRef<Map<string, number>>(new Map())
  const alertSettingsRef = useRef(alertSettings)
  alertSettingsRef.current = alertSettings

  const addSignal = useCallback((signal: Signal) => {
    const now = Date.now()
    // Deduplicate
    const last = seenCAs.current.get(signal.ca)
    if (last && now - last < SEEN_TTL_MS) return
    seenCAs.current.set(signal.ca, now)
    // Prune old entries from seen map
    for (const [ca, ts] of seenCAs.current) {
      if (now - ts > SEEN_TTL_MS) seenCAs.current.delete(ca)
    }

    setSignals(prev => [signal, ...prev.slice(0, MAX_SIGNALS - 1)])
    setNewSignalId(signal.id)
    setTimeout(() => setNewSignalId(null), 1500)
    triggerAlert(signal, alertSettingsRef.current)
  }, [])

  // Pump.fun WebSocket — instant new token events
  useEffect(() => {
    const pf = new PumpFunWS((token: PumpFunToken) => {
      setConnected(true)
      const signal = pumpFunToSignal(token)
      addSignal(signal)

      // Enrich with DexScreener after 45s (time to index)
      setTimeout(async () => {
        const pair = await fetchTokenPairs(token.mint)
        if (!pair) return
        const enriched = pairToSignal(pair)
        // Replace the original by CA if still in list
        setSignals(prev => prev.map(s => s.ca === token.mint ? { ...enriched, id: s.id } : s))
      }, 45_000)
    })

    return () => pf.destroy()
  }, [addSignal])

  // DexScreener token profiles — polls every 20s for new tokens not from pump.fun
  useEffect(() => {
    let active = true

    async function pollProfiles() {
      const profiles = await fetchTokenProfiles()
      if (!active) return

      for (const profile of profiles.slice(0, 10)) {
        const pair = await fetchTokenPairs(profile.tokenAddress)
        if (!active || !pair) continue
        const signal = pairToSignal(pair, profile)
        addSignal(signal)
      }
    }

    pollProfiles()
    const timer = setInterval(pollProfiles, PROFILE_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [addSignal])

  return { signals, newSignalId, connected, alertSettings, setAlertSettings }
}
