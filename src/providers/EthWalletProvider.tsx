/**
 * EVM Wallet Provider — wagmi v3 setup
 *
 * Supports:
 *   - MetaMask / any injected wallet (Rabby, Frame, etc.)
 *   - Coinbase Wallet (built-in SDK, no project ID needed)
 *   - WalletConnect v2 (if VITE_WC_PROJECT_ID env var is set)
 *   - Safe (Gnosis) multi-sig
 *
 * Chains:
 *   - Arbitrum One  ← Hyperliquid USDC deposits go through Arbitrum bridge
 *   - Ethereum mainnet ← ENS + wallet identity
 *
 * Environment variables (optional — add to Vercel project settings):
 *   VITE_WC_PROJECT_ID    WalletConnect project ID (get free at cloud.walletconnect.com)
 *   VITE_ARBITRUM_RPC     Custom Arbitrum RPC (Alchemy/Infura for reliability)
 *   VITE_MAINNET_RPC      Custom mainnet RPC
 */

import { type ReactNode } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, arbitrum } from 'wagmi/chains'
import { injected, coinbaseWallet, walletConnect, safe } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─────────────────────────────────────────────────────────────────────────────
// Connectors
// ─────────────────────────────────────────────────────────────────────────────

const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID as string | undefined

const connectors = [
  // Any injected wallet: MetaMask, Rabby, Frame, Brave, etc.
  injected({ shimDisconnect: true }),

  // WalletConnect — enables QR code + mobile wallets (requires project ID)
  ...(WC_PROJECT_ID
    ? [walletConnect({ projectId: WC_PROJECT_ID, showQrModal: true })]
    : []
  ),

  // Coinbase Wallet — built-in passkey + Smart Wallet support, no project ID needed
  coinbaseWallet({
    appName: 'Sentinel Terminal',
    appLogoUrl: 'https://sentinel-terminal.vercel.app/favicon.ico',
  }),

  // Safe — Gnosis multisig support
  safe(),
]

// ─────────────────────────────────────────────────────────────────────────────
// wagmi config
// ─────────────────────────────────────────────────────────────────────────────

export const wagmiConfig = createConfig({
  chains: [arbitrum, mainnet],
  connectors,
  transports: {
    // Arbitrum is the primary chain for Hyperliquid USDC bridge deposits
    [arbitrum.id]: http(
      (import.meta.env.VITE_ARBITRUM_RPC as string | undefined)
        ?? 'https://arb1.arbitrum.io/rpc',
    ),
    // Mainnet for ENS + wallet identity checks
    [mainnet.id]: http(
      (import.meta.env.VITE_MAINNET_RPC as string | undefined) ?? undefined,
    ),
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// React Query (shared across all HL hooks)
// ─────────────────────────────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function EthWalletProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  )
}
