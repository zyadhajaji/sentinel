import { useState, useEffect, useRef } from 'react'
import type { Signal } from '../types'
import { fetchTokenPairs } from '../lib/dexscreener'
import { calculateScore } from '../lib/scoreEngine'
import { detectNarratives } from '../lib/narrativeEngine'
import { fetchRugReport } from '../lib/rugcheck'

export type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; signal: Signal }
  | { status: 'not_found' }
  | { status: 'error' }

const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

function genId() { return Math.random().toString(36).slice(2, 11) }

function ageMinutes(ts: number) { return Math.floor((Date.now() - ts) / 60_000) }

function pairToLookupSignal(pair: import('../lib/dexscreener').DexPair, solPrice = 150): Signal {
  const source = pair.dexId?.includes('pump') ? 'pumpfun'
    : pair.dexId?.includes('raydium') ? 'raydium'
    : pair.dexId?.includes('moonshot') ? 'moonshot'
    : 'unknown'
  const twitterUrl = pair.info?.socials?.find(s => s.url?.includes('twitter.com') || s.url?.includes('x.com'))?.url ?? null
  const telegramUrl = pair.info?.socials?.find(s => s.url?.includes('t.me'))?.url ?? null
  const websiteUrl = pair.info?.websites?.[0]?.url ?? null
  const contractAgeMins = pair.pairCreatedAt ? ageMinutes(pair.pairCreatedAt) : 30
  const txns1h = (pair.txns?.h1?.buys ?? 0) + (pair.txns?.h1?.sells ?? 0)
  const liquidity = pair.liquidity?.usd ?? 0
  const totalTxns = txns1h || 1
  const buy_pressure = Math.round(((pair.txns?.h1?.buys ?? 0) / totalTxns) * 100)

  const { score, grade, breakdown } = calculateScore({
    liquidity_usd: liquidity,
    txns_1h: txns1h,
    source,
    contract_age_minutes: contractAgeMins,
    has_twitter: !!twitterUrl,
    has_website: !!websiteUrl,
    has_telegram: !!telegramUrl,
    buy_pressure,
    price_change_1h: pair.priceChange?.h1 ?? 0,
    mint_authority_revoked: source === 'pumpfun' ? true : null,
    freeze_authority_revoked: source === 'pumpfun' ? true : null,
  })

  const volume_1h = pair.volume?.h1 ?? 0
  const fees_est_sol = (volume_1h * 0.01) / solPrice

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
    entry_mcap_usd: pair.marketCap ?? pair.fdv ?? 0,
    holders: null,
    top_holder_pct: null,
    mint_authority_revoked: source === 'pumpfun' ? true : null,
    freeze_authority_revoked: source === 'pumpfun' ? true : null,
    contract_age_minutes: contractAgeMins,
    has_twitter: !!twitterUrl,
    has_website: !!websiteUrl,
    image_url: pair.info?.imageUrl ?? null,
    twitter_url: twitterUrl,
    telegram_url: telegramUrl,
    website_url: websiteUrl,
    price_usd: parseFloat(pair.priceUsd ?? '0') || 0,
    price_change_1h: pair.priceChange?.h1 ?? 0,
    timestamp: new Date().toISOString(),
    score_breakdown: breakdown,
    dex_url: `https://dexscreener.com/solana/${pair.baseToken.address}`,
    narrative_tags: detectNarratives(pair.baseToken.name, pair.baseToken.symbol),
    buy_pressure,
    volume_1h,
    fees_est_sol,
    rug_score: null,
    rug_risks: [],
  }
}

export function useCaLookup(query: string, solPrice = 150) {
  const [state, setState] = useState<LookupState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCA = CA_RE.test(query.trim())

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (!isCA) {
      setState({ status: 'idle' })
      return
    }

    setState({ status: 'loading' })

    timerRef.current = setTimeout(async () => {
      const ca = query.trim()
      try {
        const pair = await fetchTokenPairs(ca)
        if (!pair) { setState({ status: 'not_found' }); return }

        const signal = pairToLookupSignal(pair, solPrice)
        setState({ status: 'found', signal })

        // Enrich with rug data in background (no await on parent)
        fetchRugReport(ca).then(rug => {
          if (!rug) return
          const hasTg = !!signal.telegram_url
          const rescored = calculateScore({
            liquidity_usd: signal.liquidity_usd,
            txns_1h: 0,
            source: signal.source,
            contract_age_minutes: signal.contract_age_minutes,
            has_twitter: signal.has_twitter,
            has_website: signal.has_website,
            has_telegram: hasTg,
            buy_pressure: signal.buy_pressure,
            price_change_1h: signal.price_change_1h,
            rug_score: rug.score,
            mint_authority_revoked: signal.mint_authority_revoked,
            freeze_authority_revoked: signal.freeze_authority_revoked,
          })
          setState({
            status: 'found',
            signal: {
              ...signal,
              rug_score: rug.score,
              rug_risks: rug.risks,
              top_holder_pct: rug.topHolderPct,
              scanner_score: rescored.score,
              score_grade: rescored.grade,
              score_breakdown: rescored.breakdown,
            },
          })
        }).catch(() => {})
      } catch {
        setState({ status: 'error' })
      }
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isCA])

  return { state, isCA }
}
