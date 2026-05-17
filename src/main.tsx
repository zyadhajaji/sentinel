import { Buffer } from 'buffer'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { WalletProviders } from './providers/WalletProviders'
import { WatchlistProvider } from './contexts/WatchlistContext'
import { EthWalletProvider } from './providers/EthWalletProvider'
import { HyperliquidProvider } from './contexts/HyperliquidContext'
import App from './App'

;(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* EVM wallet (wagmi) wraps everything — sits outside Solana providers */}
    <EthWalletProvider>
      {/* Solana wallet (Phantom / Solflare) */}
      <WalletProviders>
        <WatchlistProvider>
          {/* Hyperliquid state + trading functions */}
          <HyperliquidProvider>
            <App />
          </HyperliquidProvider>
        </WatchlistProvider>
      </WalletProviders>
    </EthWalletProvider>
  </StrictMode>,
)
