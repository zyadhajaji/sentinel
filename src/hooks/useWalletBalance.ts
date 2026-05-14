import { useEffect, useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'

export function useWalletBalance() {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!publicKey) { setBalance(null); return }

    let cancelled = false

    async function fetchBalance() {
      try {
        setLoading(true)
        const lamports = await connection.getBalance(publicKey!)
        if (!cancelled) setBalance(lamports / 1e9)
      } catch {
        // RPC error — keep previous balance
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchBalance()
    const id = setInterval(fetchBalance, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [publicKey, connection])

  return { balance, loading }
}
