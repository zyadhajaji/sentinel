import { useState, useEffect } from 'react'

export function useSolPrice(): number {
  const [price, setPrice] = useState(150)

  useEffect(() => {
    async function fetchPrice() {
      // Primary: CoinGecko free tier
      try {
        const r = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
          { signal: AbortSignal.timeout(5000) }
        )
        if (r.ok) {
          const data = await r.json()
          const p = data?.solana?.usd
          if (p && p > 10) { setPrice(p); return }
        }
      } catch {}

      // Fallback: DexScreener SOL/USDC pair on Raydium
      try {
        const r = await fetch(
          'https://api.dexscreener.com/latest/dex/pairs/solana/HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ',
          { signal: AbortSignal.timeout(5000) }
        )
        if (r.ok) {
          const data = await r.json()
          const p = parseFloat(data?.pair?.priceUsd ?? '0')
          if (p > 10) setPrice(p)
        }
      } catch {}
    }

    fetchPrice()
    const t = setInterval(fetchPrice, 60_000)
    return () => clearInterval(t)
  }, [])

  return price
}
