/**
 * WalletModal — EVM wallet connection picker
 *
 * Shows all registered wagmi connectors (MetaMask, Coinbase, WalletConnect, Safe).
 * Used by the Markets tab (and any other place that needs an EVM wallet).
 */

import { useState } from 'react'
import { useHyperliquid } from '../contexts/HyperliquidContext'

// ─────────────────────────────────────────────────────────────────────────────
// Connector icons (inline SVG — no external deps)
// ─────────────────────────────────────────────────────────────────────────────

function ConnectorIcon({ id, name }: { id: string; name: string }) {
  // MetaMask fox
  if (id === 'injected' || name.toLowerCase().includes('metamask')) {
    return (
      <svg width="28" height="28" viewBox="0 0 318 318" fill="none">
        <path d="M274.1 35.5l-99.7 74.1 18.4-43.5z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M44 35.5l98.9 74.8-17.6-44.2zM238.3 206.8l-26.5 40.6 56.7 15.6 16.3-55.3zM33.4 207.7l16.2 55.3 56.7-15.6-26.5-40.6z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M103.6 138.2l-15.8 23.9 56.3 2.5-2-60.5zM214.4 138.2l-39.4-34.8-2.4 61.2 56.2-2.5zM106.3 247.4l33.8-16.5-29.2-22.8zM178 230.9l33.9 16.5-4.7-39.3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M211.9 247.4l-33.9-16.5 2.7 22.1-.3 9.3zM106.3 247.4l31.5 14.9-.2-9.3 2.6-22.1z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M138.3 193.5l-28.2-8.3 19.9-9.1zM179.8 193.5l8.3-17.4 20 9.1z" fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M106.3 247.4l4.8-40.6-31.3.9zM207 206.8l4.9 40.6 26.5-39.7zM228.9 162.1l-56.2 2.5 5.2 28.9 8.3-17.4 20 9.1zM110.1 185.2l20-9.1 8.2 17.4 5.3-28.9-56.3-2.5z" fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M87.8 162.1l23.6 46.1-.8-22.9zM207.6 185.3l-1 22.9 23.7-46.1zM144.1 164.6l-5.3 28.9 6.6 34.1 1.5-44.9zM173.9 164.6l-2.7 18 1.2 45 6.7-34.1z" fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M179.8 193.5l-6.7 34.1 4.8 3.3 29.2-22.8 1-22.9zM110.1 185.2l.8 22.9 29.2 22.8 4.8-3.3-6.6-34.1z" fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M180.3 262.3l.3-9.3-2.5-2.2h-37.7l-2.4 2.2.2 9.3-31.5-14.9 11 9 22.3 15.5h38.3l22.4-15.5 11-9z" fill="#C0AD9E" stroke="#C0AD9E" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M178 230.9l-4.8-3.3h-26.4l-4.8 3.3-2.6 22.1 2.4-2.2h37.7l2.5 2.2z" fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M278.3 114.2l8.5-40.8-12.7-37.9-99.1 73.5 38.2 32.3 53.9 15.7 11.9-13.9-5.1-3.7 8.2-7.5-6.3-4.9 8.2-6.3zM31.2 73.4l8.5 40.8-5.4 4 8.2 6.3-6.2 4.9 8.2 7.5-5.1 3.7 11.8 13.9 53.9-15.7 38.2-32.3-99-73.5z" fill="#763D16" stroke="#763D16" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M267.2 157l-53.9-15.7 16.3 24.8-23.7 46.1 31.2-.4h46.5zM104.7 141.3l-53.9 15.7-16.2 54.8h46.4l31.1.4-23.6-46.1zM172.8 164.6l3.5-59.8 15.9-43.2h-70.8l15.7 43.2 3.7 59.8 1.2 18.2.1 44.8h26.4l.2-44.8z" fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  // Coinbase Wallet
  if (id === 'coinbaseWallet' || name.toLowerCase().includes('coinbase')) {
    return (
      <svg width="28" height="28" viewBox="0 0 1024 1024" fill="none">
        <rect width="1024" height="1024" rx="200" fill="#0052FF"/>
        <circle cx="512" cy="512" r="280" fill="white"/>
        <rect x="392" y="432" width="240" height="160" rx="50" fill="#0052FF"/>
      </svg>
    )
  }

  // WalletConnect
  if (id === 'walletConnect' || name.toLowerCase().includes('walletconnect')) {
    return (
      <svg width="28" height="28" viewBox="0 0 300 185" fill="none">
        <path d="M61.4 36.7C109.8-11.2 188.3-11.2 236.7 36.7L242.5 42.4C244.9 44.8 244.9 48.7 242.5 51.1L221.9 71.4C220.7 72.6 218.8 72.6 217.6 71.4L209.7 63.5C176 30 100.1 30 66.4 63.5L57.9 72C56.7 73.2 54.8 73.2 53.6 72L32.9 51.6C30.5 49.2 30.5 45.3 32.9 42.9L61.4 36.7Z" fill="#3B99FC"/>
        <path d="M257 55.2L276.1 74.1C278.5 76.5 278.5 80.4 276.1 82.8L196.1 161.9C193.7 164.3 189.8 164.3 187.4 161.9L129.5 104.2C128.9 103.6 127.9 103.6 127.3 104.2L69.5 161.9C67.1 164.3 63.2 164.3 60.8 161.9L24 82.8C21.6 80.4 21.6 76.5 24 74.1L43 55.2C45.4 52.8 49.3 52.8 51.7 55.2L109.5 112.9C110.1 113.5 111.1 113.5 111.7 112.9L169.5 55.2C171.9 52.8 175.8 52.8 178.2 55.2L236 112.9C236.6 113.5 237.6 113.5 238.2 112.9L257 55.2Z" fill="#3B99FC"/>
      </svg>
    )
  }

  // Safe / Gnosis
  if (id === 'safe' || name.toLowerCase().includes('safe')) {
    return (
      <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="20" fill="#12FF80"/>
        <path d="M50 15C31 15 15 31 15 50s16 35 35 35 35-16 35-35S69 15 50 15zm0 12c7.2 0 13.5 3.2 17.8 8.3L35.3 67.8C30.2 63.5 27 57.2 27 50c0-12.7 10.3-23 23-23zm0 46c-7.2 0-13.5-3.2-17.8-8.3l32.5-32.5C69.8 36.5 73 42.8 73 50c0 12.7-10.3 23-23 23z" fill="#121312"/>
      </svg>
    )
  }

  // Generic fallback
  return (
    <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#555] text-[10px] font-mono font-bold">
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WalletModal
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function WalletModal({ onClose }: Props) {
  const hl = useHyperliquid()
  const [connecting, setConnecting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect(index: number) {
    setConnecting(index)
    setError(null)
    try {
      await hl.connectWallet(index)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setConnecting(null)
    }
  }

  const connectors = hl.walletConnectors

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full sm:w-[360px] bg-[#0d0d0d] border border-[#1e1e1e] rounded-t-3xl sm:rounded-2xl p-5 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[14px] font-bold text-[#e6e6e6]">Connect EVM Wallet</h2>
            <p className="text-[10px] font-mono text-[#444] mt-0.5">Required for Hyperliquid perp trading</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-[#888] transition-colors cursor-pointer rounded-lg"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Connector list */}
        <div className="space-y-2">
          {connectors.length === 0 ? (
            <p className="text-[11px] font-mono text-[#444] text-center py-4">
              No wallets available. Install MetaMask or Rabby.
            </p>
          ) : (
            connectors.map((connector, i) => (
              <button
                key={connector.id}
                onClick={() => handleConnect(i)}
                disabled={connecting !== null}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111] border border-[#1a1a1a] hover:bg-[#161616] hover:border-[#2a2a2a] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                <ConnectorIcon id={connector.id} name={connector.name} />
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-medium text-[#e6e6e6]">{connector.name}</p>
                  <p className="text-[10px] font-mono text-[#444]">
                    {connector.id === 'injected' && 'Browser extension wallet'}
                    {connector.id === 'walletConnect' && 'QR code · mobile wallets'}
                    {connector.id === 'coinbaseWallet' && 'Coinbase Wallet SDK'}
                    {connector.id === 'safe' && 'Gnosis Safe multi-sig'}
                  </p>
                </div>
                {connecting === i ? (
                  <div className="w-4 h-4 rounded-full border-2 border-[#00d4ff] border-t-transparent animate-spin shrink-0" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"
                    className="shrink-0 group-hover:stroke-[#555] transition-colors">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>

        {error && (
          <div className="mt-3 bg-[#ff335510] border border-[#ff335525] rounded-xl px-3 py-2">
            <p className="text-[10px] font-mono text-[#ff3355]">{error}</p>
          </div>
        )}

        <p className="text-[9px] font-mono text-[#2a2a2a] text-center mt-4 leading-relaxed">
          Hyperliquid uses EIP-712 signatures — no gas fees for orders.<br />
          Your funds stay in your wallet at all times.
        </p>
      </div>
    </div>
  )
}
