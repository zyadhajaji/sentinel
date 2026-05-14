import { Connection, VersionedTransaction } from '@solana/web3.js'
import type { WalletContextState } from '@solana/wallet-adapter-react'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com'

export interface JupiterQuote {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  priceImpactPct: string
  otherAmountThreshold: string
  swapMode: string
  routePlan: Array<{
    percent: number
    swapInfo: { ammKey: string; label: string; inputMint: string; outputMint: string; inAmount: string; outAmount: string; feeAmount: string; feeMint: string }
  }>
}

export type SwapResult =
  | { status: 'ok'; txid: string }
  | { status: 'error'; message: string }

export async function getJupiterQuote(
  outputMint: string,
  solAmount: number,
  slippageBps: number
): Promise<JupiterQuote | null> {
  try {
    const lamports = Math.floor(solAmount * 1_000_000_000)
    const url =
      `https://api.jup.ag/swap/v6/quote?` +
      `inputMint=${SOL_MINT}&outputMint=${outputMint}` +
      `&amount=${lamports}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json() as JupiterQuote
  } catch {
    return null
  }
}

export async function executeJupiterBuy(
  quote: JupiterQuote,
  wallet: WalletContextState,
  priorityFee: 'auto' | number = 'auto'
): Promise<SwapResult> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    return { status: 'error', message: 'Wallet not connected' }
  }

  try {
    const body = {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: priorityFee,
      dynamicComputeUnitLimit: true,
    }

    const swapRes = await fetch('https://api.jup.ag/swap/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!swapRes.ok) {
      const errText = await swapRes.text()
      return { status: 'error', message: errText.slice(0, 120) }
    }

    const { swapTransaction } = (await swapRes.json()) as { swapTransaction: string }
    const txBytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0))
    const tx = VersionedTransaction.deserialize(txBytes)
    const signed = await wallet.signTransaction(tx)

    const connection = new Connection(RPC_ENDPOINT, { commitment: 'confirmed' })
    const txid = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    })

    return { status: 'ok', txid }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg.slice(0, 200) }
  }
}

export function formatTokenAmount(raw: string, decimals = 6): string {
  const n = Number(raw) / 10 ** decimals
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
