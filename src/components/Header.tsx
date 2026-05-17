import { useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { shortPublicKey } from '../lib/walletDisplay'
import type { BotActivity } from '../hooks/useBacktest'
import { useAdmin } from '../contexts/AdminContext'
import { IS_DEMO } from '../lib/appMode'

interface Props {
  feedConnected: boolean
  solPrice: number
  botActivity: BotActivity
  openPositions: number
  onAdminOpen: () => void
  onProfileOpen: () => void
}

export function Header({ feedConnected, solPrice, botActivity, openPositions, onAdminOpen, onProfileOpen }: Props) {
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

  const avatarInitials = (profile.username || 'T').slice(0, 2).toUpperCase()

  return (
    <header
      className="flex items-center justify-between px-4 border-b border-[#141414] shrink-0 bg-[#080808]"
      style={{ height: '56px', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: Logo + wordmark */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleLogoTap}
          className="relative w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: profile.isUnlocked ? '#ffd70040' : '#00d4ff25',
            background: profile.isUnlocked ? '#ffd70008' : '#00d4ff06',
          }}
          aria-label="Open admin panel"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={profile.isUnlocked ? '#ffd700' : '#00d4ff'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          {profile.isUnlocked && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#ffd700] flex items-center justify-center">
              <svg width="5" height="5" viewBox="0 0 24 24" fill="#080808" stroke="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-[13px] text-[#e6e6e6] tracking-[0.12em]">SENTINEL</span>
          <span className="text-[#1e1e1e] font-mono text-[8px] tracking-widest hidden sm:block">TERMINAL</span>
          {IS_DEMO && (
            <span className="text-[8px] font-mono text-[#555] bg-[#141414] border border-[#222] px-1.5 py-0.5 rounded-md tracking-widest">DEMO</span>
          )}
        </div>
      </div>

      {/* Center: live stats pill */}
      <div className="flex items-center gap-1 text-[10px] font-mono">
        {/* Feed status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0a0a] border border-[#141414]">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            feedConnected ? 'bg-[#00ff88]' : 'bg-[#ff3355]'
          }`}
            style={feedConnected ? { animation: 'pulse-glow 2s ease-in-out infinite' } : undefined}
          />
          <span className={`hidden sm:block ${feedConnected ? 'text-[#00ff88]' : 'text-[#ff3355]'}`}>
            {feedConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* Bot status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0a0a] border border-[#141414]">
          <div
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${botActivity.isRunning ? 'bg-[#00d4ff]' : 'bg-[#2a2a2a]'}`}
            style={botActivity.isRunning ? { animation: 'pulse 2s ease-in-out infinite', boxShadow: '0 0 4px #00d4ff80' } : undefined}
          />
          <span className={`hidden sm:block ${botActivity.isRunning ? 'text-[#00d4ff]' : 'text-[#333]'}`}>
            BOT
          </span>
          {openPositions > 0 && (
            <span className="text-[#00d4ff] font-bold tabular-nums">{openPositions}</span>
          )}
        </div>

        {/* SOL price */}
        {solPrice > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0a0a] border border-[#141414]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9945ff" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span className="text-[#555]">SOL</span>
            <span className="text-[#e6e6e6] tabular-nums font-bold">${solPrice.toFixed(0)}</span>
          </div>
        )}
      </div>

      {/* Right: profile avatar + wallet */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onProfileOpen}
          aria-label="Edit profile"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer transition-all hover:opacity-80 active:scale-95 select-none shrink-0"
          style={{
            background: `${profile.avatarColor}1a`,
            border: `1.5px solid ${profile.avatarColor}40`,
            color: profile.avatarColor,
          }}
        >
          {avatarInitials}
        </button>

        <button
          type="button"
          onClick={() => setVisible(true)}
          disabled={disconnecting}
          className="min-h-[36px] px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: walletPk ? '#00d4ff25' : '#00d4ff40',
            background: walletPk ? '#00d4ff06' : '#00d4ff0d',
            color: '#00d4ff',
          }}
        >
          {walletPk ? shortPublicKey(walletPk) : 'CONNECT'}
        </button>
      </div>
    </header>
  )
}
