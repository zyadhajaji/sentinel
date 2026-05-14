import { useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { shortPublicKey } from '../lib/walletDisplay'
import type { BotActivity } from '../hooks/useBacktest'
import { useAdmin } from '../contexts/AdminContext'

interface Props {
  feedConnected: boolean
  solPrice: number
  botActivity: BotActivity
  openPositions: number
  onAdminOpen: () => void
}

export function Header({ feedConnected, solPrice, botActivity, openPositions, onAdminOpen }: Props) {
  const { publicKey, disconnecting } = useWallet()
  const { setVisible } = useWalletModal()
  const walletPk = publicKey?.toBase58()
  const { profile, unlock } = useAdmin()

  // Logo tap-to-unlock: 5 taps within 3 seconds
  const tapCount = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleLogoTap() {
    if (profile.isUnlocked) { onAdminOpen(); return }
    tapCount.current += 1
    if (tapTimer.current) clearTimeout(tapTimer.current)
    if (tapCount.current >= 5) {
      tapCount.current = 0
      unlock()
      onAdminOpen()
      return
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0 }, 3000)
  }

  return (
    <header
      className="flex items-center justify-between px-4 h-14 border-b border-[#1a1a1a] shrink-0 bg-[#080808]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Logo — tap 5× to unlock admin */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={handleLogoTap}
          className="relative w-7 h-7 rounded border flex items-center justify-center transition-all cursor-pointer select-none"
          style={{
            borderColor: profile.isUnlocked ? '#ffd70040' : '#00d4ff30',
            background: profile.isUnlocked ? '#ffd70008' : '#00d4ff08',
          }}
          aria-label="Open admin panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={profile.isUnlocked ? '#ffd700' : '#00d4ff'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          {profile.isUnlocked && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#ffd700] flex items-center justify-center">
              <svg width="6" height="6" viewBox="0 0 24 24" fill="#080808" stroke="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </span>
          )}
        </button>
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
