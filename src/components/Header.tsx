import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { shortPublicKey } from '../lib/walletDisplay'

interface Props {
  feedConnected: boolean
}

export function Header({ feedConnected }: Props) {
  const { publicKey, disconnecting } = useWallet()
  const { setVisible } = useWalletModal()
  const walletPk = publicKey?.toBase58()

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-[#1e1e1e] shrink-0 bg-[#0a0a0a]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded border border-[#00d4ff30] flex items-center justify-center bg-[#00d4ff08]">
          <span className="text-[#00d4ff] text-[11px] font-display font-bold">S</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-[13px] text-[#e6e6e6] tracking-wider">SENTINEL</span>
          <span className="text-[#2a2a2a] font-display text-[9px] tracking-widest hidden sm:block">TERMINAL</span>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <div className={`w-2 h-2 rounded-full ${feedConnected ? 'bg-[#00ff88] animate-pulse-green' : 'bg-[#ff3355]'}`} />
        <span className={feedConnected ? 'text-[#00ff88]' : 'text-[#ff3355]'}>
          {feedConnected ? 'LIVE' : 'connecting...'}
        </span>
      </div>

      {/* Wallet button */}
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={disconnecting}
        className="min-h-[44px] px-3 py-2 text-[11px] font-mono font-bold rounded border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] active:bg-[#00d4ff25] hover:border-[#00d4ff60] transition-all disabled:opacity-50"
      >
        {walletPk ? shortPublicKey(walletPk) : 'CONNECT'}
      </button>
    </header>
  )
}
