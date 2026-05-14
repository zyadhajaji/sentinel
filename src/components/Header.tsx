import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { shortPublicKey } from '../lib/walletDisplay'
import type { BotActivity } from '../hooks/useBacktest'

interface Props {
  feedConnected: boolean
  solPrice: number
  botActivity: BotActivity
  openPositions: number
}


export function Header({ feedConnected, solPrice, botActivity, openPositions }: Props) {
  const { publicKey, disconnecting } = useWallet()
  const { setVisible } = useWalletModal()
  const walletPk = publicKey?.toBase58()

  return (
    <header
      className="flex items-center justify-between px-4 h-14 border-b border-[#1a1a1a] shrink-0 bg-[#080808]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded border border-[#00d4ff30] flex items-center justify-center bg-[#00d4ff08]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-[13px] text-[#e6e6e6] tracking-wider">SENTINEL</span>
          <span className="text-[#222222] font-mono text-[9px] tracking-widest hidden sm:block">TERMINAL</span>
        </div>
      </div>

      {/* Center: feed status + bot status + SOL price */}
      <div className="flex items-center gap-3 text-[11px] font-mono">
        {/* Feed status */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${feedConnected ? 'bg-[#00ff88] animate-pulse-green' : 'bg-[#ff3355]'}`} />
          <span className={`hidden sm:block ${feedConnected ? 'text-[#00ff88]' : 'text-[#ff3355]'}`}>
            {feedConnected ? 'LIVE' : 'connecting'}
          </span>
        </div>

        {/* Bot status */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${botActivity.isRunning ? 'bg-[#00d4ff]' : 'bg-[#444444]'}`}
            style={botActivity.isRunning ? { animation: 'pulse 2s ease-in-out infinite' } : undefined} />
          <span className="text-[#555555] hidden sm:block">
            BOT{openPositions > 0 ? <span className="text-[#00d4ff] ml-1">{openPositions}</span> : null}
          </span>
        </div>

        {solPrice > 0 && (
          <>
            <span className="text-[#1e1e1e]">·</span>
            <span className="text-[#555555] hidden sm:block">
              SOL <span className="text-[#e6e6e6]">${solPrice.toFixed(0)}</span>
            </span>
          </>
        )}
      </div>

      {/* Wallet button */}
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={disconnecting}
        className="min-h-[44px] px-3 py-2 text-[11px] font-mono font-bold rounded border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] active:bg-[#00d4ff25] hover:border-[#00d4ff60] transition-all disabled:opacity-50 cursor-pointer"
      >
        {walletPk ? shortPublicKey(walletPk) : 'CONNECT'}
      </button>
    </header>
  )
}
