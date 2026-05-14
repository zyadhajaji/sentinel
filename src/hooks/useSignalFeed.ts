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
import { fetchRugReport } from '../lib/rugcheck'
import { useSolPrice } from './useSolPrice'
import { loadStorage, saveStorage } from '../lib/storage'

const MAX_SIGNALS = 50
const PROFILE_POLL_MS = 20_000
const REFRESH_MS = 90_000      // re-fetch top signals from DexScreener
const REFRESH_BATCH = 15       // how many signals to refresh per cycle
const REFRESH_DELAY_MS = 400   // gap between DexScreener calls to avoid rate limiting
const SEEN_TTL_MS = 10 * 60 * 1000

function genId() {
  return Math.random().toString(36).slice(2, 11)
}

function ageMinutes(createdAt: number): number {
  return Math.floor((Date.now() - createdAt) / 60_000)
}

function pairToSignal(pair: DexPair, profile?: TokenProfile, solPrice = 150): Signal {
  const source: SignalSource = pair.dexId?.includes('pump') ? 'pumpfun'
    : pair.dexId?.includes('raydium') ? 'raydium'
    : pair.dexId?.includes('moonshot') ? 'moonshot'
    : pair.dexId?.includes('jupiter') ? 'jupiter'
    : 'unknown'

  const twitterUrl = (
    pair.info?.socials?.find(s => s.type === 'twitter' || s.url?.includes('twitter.com') || s.url?.includes('x.com'))?.url
    ?? profile?.links?.find(l => l.type === 'twitter' || l.url?.includes('twitter.com') || l.url?.includes('x.com'))?.url
    ?? null
  )
  const telegramUrl = (
    pair.info?.socials?.find(s => s.type === 'telegram' || s.url?.includes('t.me'))?.url
    ?? profile?.links?.find(l => l.type === 'telegram' || l.url?.includes('t.me'))?.url
    ?? null
  )
  const websiteUrl = (
    pair.info?.websites?.[0]?.url
    ?? profile?.links?.find(l => l.type === 'website' && !l.url?.includes('twitter') && !l.url?.includes('t.me') && !l.url?.includes('x.com'))?.url
    ?? null
  )
  const hasTwitter = !!twitterUrl
  const hasWebsite = !!websiteUrl

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
  const fees_est_sol = (volume_1h * 0.01) / solPrice
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
    twitter_url: twitterUrl,
    telegram_url: telegramUrl,
    website_url: websiteUrl,
    price_usd: parseFloat(pair.priceUsd ?? '0') || 0,
    price_change_1h: pair.priceChange?.h1 ?? 0,
    timestamp: new Date().toISOString(),
    score_breakdown: breakdown,
    dex_url: `https://dexscreener.com/solana/${pair.baseToken.address}`,
    narrative_tags,
    buy_pressure,
    volume_1h,
    fees_est_sol,
    rug_score: null,
    rug_risks: [],
  }
}

function pumpFunToSignal(token: PumpFunToken, solPrice = 150): Signal {
  const mcapSolUsd = (token.marketCapSol ?? 0) * solPrice
  const liquidityUsd = (token.vSolInBondingCurve ?? 0) * solPrice * 2

  const { score, grade, breakdown } = calculateScore({
    liquidity_usd: liquidityUsd,
    txns_1h: 5,
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
    twitter_url: null,
    telegram_url: null,
    website_url: null,
    price_usd: 0,
    price_change_1h: 0,
    timestamp: new Date().toISOString(),
    score_breakdown: breakdown,
    dex_url: `https://pump.fun/${token.mint}`,
    narrative_tags: detectNarratives(token.name || token.symbol, token.symbol),
    buy_pressure: 50,
    volume_1h: 0,
    fees_est_sol: 0,
    rug_score: null,
    rug_risks: [],
  }
}

export function useSignalFeed() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [newSignalId, setNewSignalId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() =>
    // Merge saved settings with defaults so new fields (e.g. browserNotifEnabled) are always present
    { return { ...DEFAULT_ALERT_SETTINGS, ...loadStorage<Partial<AlertSettings>>('sentinel_alert_settings', {}) } }
  )

  // Persist whenever alert settings change
  useEffect(() => { saveStorage('sentinel_alert_settings', alertSettings) }, [alertSettings])

  const solPrice = useSolPrice()
  const solPriceRef = useRef(solPrice)
  solPriceRef.current = solPrice

  const seenCAs = useRef<Map<string, number>>(new Map())
  const alertSettingsRef = useRef(alertSettings)
  alertSettingsRef.current = alertSettings
  const signalsRef = useRef<Signal[]>([])

  // Keep signalsRef in sync for use inside intervals
  useEffect(() => { signalsRef.current = signals }, [signals])

  const addSignal = useCallback((signal: Signal) => {
    const now = Date.now()
    const last = seenCAs.current.get(signal.ca)
    if (last && now - last < SEEN_TTL_MS) return
    seenCAs.current.set(signal.ca, now)
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
      const signal = pumpFunToSignal(token, solPriceRef.current)
      addSignal(signal)

      // After 45s: enrich with DexScreener + RugCheck
      setTimeout(async () => {
        const pair = await fetchTokenPairs(token.mint)
        if (!pair) return
        const enriched = pairToSignal(pair, undefined, solPriceRef.current)

        // Fetch rug report in parallel
        const rug = await fetchRugReport(token.mint)
        const withRug: Signal = rug
          ? { ...enriched, rug_score: rug.score, rug_risks: rug.risks, top_holder_pct: rug.topHolderPct }
          : enriched

        setSignals(prev => prev.map(s => s.ca === token.mint ? { ...withRug, id: s.id } : s))
      }, 45_000)
    })

    return () => pf.destroy()
  }, [addSignal])

  // DexScreener token profiles — polls every 20s
  useEffect(() => {
    let active = true

    async function pollProfiles() {
      const profiles = await fetchTokenProfiles()
      if (!active) return

      for (const profile of profiles.slice(0, 10)) {
        const pair = await fetchTokenPairs(profile.tokenAddress)
        if (!active || !pair) continue
        const signal = pairToSignal(pair, profile, solPriceRef.current)
        addSignal(signal)
      }
    }

    pollProfiles()
    const timer = setInterval(pollProfiles, PROFILE_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [addSignal])

  // Signal refresh — keep prices/mcap live on existing cards
  useEffect(() => {
    let active = true

    async function refreshSignals() {
      const current = signalsRef.current.slice(0, REFRESH_BATCH)
      for (const s of current) {
        if (!active) break
        try {
          const pair = await fetchTokenPairs(s.ca)
          if (!pair) continue
          const enriched = pairToSignal(pair, undefined, solPriceRef.current)
          // Preserve rug data and original id from existing signal
          setSignals(prev => prev.map(p =>
            p.ca === s.ca
              ? { ...enriched, id: p.id, rug_score: p.rug_score, rug_risks: p.rug_risks, top_holder_pct: p.top_holder_pct }
              : p
          ))
          await new Promise(r => setTimeout(r, REFRESH_DELAY_MS))
        } catch {}
      }
    }

    const timer = setInterval(refreshSignals, REFRESH_MS)
    return () => { active = false; clearInterval(timer) }
  }, [])

  // ── Custom CA Watchlist ───────────────────────────────────────────────────
  const [watchedCAs, setWatchedCAs] = useState<string[]>(() =>
    loadStorage<string[]>('sentinel_watched_cas', [])
  )
  useEffect(() => { saveStorage('sentinel_watched_cas', watchedCAs) }, [watchedCAs])

  useEffect(() => {
    if (watchedCAs.length === 0) return
    let active = true

    async function pollWatched() {
      for (const ca of watchedCAs) {
        if (!active) break
        try {
          const pair = await fetchTokenPairs(ca)
          if (!pair) continue
          const signal = pairToSignal(pair, undefined, solPriceRef.current)
          // Force-refresh: clear from seenCAs so watched CAs always update
          seenCAs.current.delete(ca)
          addSignal(signal)
        } catch {}
        await new Promise(r => setTimeout(r, 500))
      }
    }

    pollWatched()
    const timer = setInterval(pollWatched, 60_000)
    return () => { active = false; clearInterval(timer) }
  }, [watchedCAs, addSignal])

  const addWatchedCA = useCallback((ca: string) => {
    const trimmed = ca.trim()
    if (!trimmed) return
    setWatchedCAs(prev => [...new Set([...prev, trimmed])])
  }, [])

  const removeWatchedCA = useCallback((ca: string) => {
    setWatchedCAs(prev => prev.filter(c => c !== ca))
  }, [])

  return { signals, newSignalId, connected, alertSettings, setAlertSettings, solPrice, watchedCAs, addWatchedCA, removeWatchedCA }
}
