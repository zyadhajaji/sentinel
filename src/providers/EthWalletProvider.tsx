/**
 * EVM Wallet Provider — wagmi v2 setup
 *
 * Wraps the app with wagmi + react-query for EVM wallet connectivity.
 * Supports: MetaMask, Rabby, Coinbase Wallet, any injected EVM wallet.
 *
 * Chains configured:
 *   - mainnet: for wallet identity + ENS
 *   - arbitrum: for USDC deposits to Hyperliquid bridge
 *
 * This sits OUTSIDE the Solana WalletProviders so both wallet types
 * coexist independently — users can have Phantom (Solana) + MetaMask (EVM).
 */

import { type ReactNode } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, arbitrum } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─────────────────────────────────────────────────────────────────────────────
// wagmi config — injected wallet only (MetaMask, Rabby, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum],
  connectors: [
    injected(),   // MetaMask, Rabby, Coinbase Wallet, Frame, etc.
  ],
  transports: {
    [mainnet.id]:  http(),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  },
})

// Shared QueryClient — also used by useHLMarkets, useHLPositions, etc.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,       // 10s before refetch
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Provider component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode
}

export function EthWalletProvider({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  )
}
