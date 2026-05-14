import { Buffer } from 'buffer'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { WalletProviders } from './providers/WalletProviders'
import { WatchlistProvider } from './contexts/WatchlistContext'
import App from './App'

;(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProviders>
      <WatchlistProvider>
        <App />
      </WatchlistProvider>
    </WalletProviders>
  </StrictMode>,
)
