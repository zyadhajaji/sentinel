import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import type { Signal } from '../types'
import { ScoreRing } from './ScoreRing'
import { formatUSD, formatPrice, shortCA } from '../lib/mockData'

interface Props {
  signal: Signal | null
  onClose: () => void
}

export function TradePanel({ signal, onClose }: Props) {
  const [solAmount, setSolAmount] = useState('0.1')
  const [slippage, setSlippage] = useState('1')
  const [side] = useState<'buy' | 'sell'>('buy')
  const { connected } = useWallet()
  const { setVisible } = useWalletModal()

  if (!signal) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#0a0a0a] border border-[#141414] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="1.5">
            <path d="M3 3h18v18H3z" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
          </svg>
        </div>
        <div>
          <p className="text-[#444] text-[12px] font-mono">No signal selected</p>
          <p className="text-[#2a2a2a] text-[10px] font-mono mt-1">Click TRADE on any signal</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#141414] shrink-0">
        <span className="text-[10px] font-mono text-[#444] uppercase tracking-wider">Order</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-[#333] hover:text-[#888] transition-colors cursor-pointer rounded"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
        {/* Token card */}
        <div className="bg-[#0a0a0a] border border-[#141414] rounded-xl p-3 flex items-center gap-3">
          <ScoreRing score={signal.scanner_score} grade={signal.score_grade} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-[13px] text-[#e6e6e6]">{signal.token_symbol}</p>
            <p className="text-[9px] text-[#333] font-mono truncate mt-0.5">{shortCA(signal.ca)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-mono text-[#e6e6e6] tabular-nums">${formatPrice(signal.price_usd)}</p>
            <p className="text-[10px] font-mono tabular-nums mt-0.5" style={{
              color: signal.price_change_1h >= 0 ? '#00ff88' : '#ff3355'
            }}>
              {signal.price_change_1h >= 0 ? '+' : ''}{signal.price_change_1h.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'MCap', value: formatUSD(signal.mcap_usd) },
            { label: 'Liquidity', value: formatUSD(signal.liquidity_usd) },
          ].map(s => (
            <div key={s.label} className="bg-[#0a0a0a] border border-[#141414] rounded-xl p-2.5">
              <p className="text-[9px] font-mono text-[#333] uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-[11px] font-mono text-[#888] tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Buy/Sell tabs */}
        <div className="grid grid-cols-2 gap-1 bg-[#0a0a0a] border border-[#141414] p-1 rounded-xl">
          <button className="py-2 rounded-lg text-[11px] font-mono font-bold text-[#0a0a0a] bg-[#00ff88] cursor-default transition-all">
            BUY
          </button>
          <button className="py-2 rounded-lg text-[11px] font-mono font-bold text-[#333] hover:text-[#555] transition-all cursor-pointer">
            SELL
          </button>
        </div>

        {/* SOL amount input */}
        <div>
          <label className="text-[9px] font-mono text-[#444] uppercase tracking-wider block mb-1.5">
            Amount (SOL)
          </label>
          <input
            type="number"
            value={solAmount}
            onChange={e => setSolAmount(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-[12px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#00d4ff40] transition-colors"
            placeholder="0.1"
            step="0.01"
            min="0"
          />
          <div className="flex gap-1 mt-1.5">
            {['0.05', '0.1', '0.25', '0.5'].map(amt => (
              <button
                key={amt}
                onClick={() => setSolAmount(amt)}
                className="flex-1 text-[9px] font-mono py-1.5 rounded-lg border border-[#141414] text-[#333] hover:text-[#888] hover:border-[#222] transition-all cursor-pointer"
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Slippage */}
        <div>
          <label className="text-[9px] font-mono text-[#444] uppercase tracking-wider block mb-1.5">
            Slippage
          </label>
          <div className="flex gap-1">
            {['0.5', '1', '2', '5'].map(s => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`flex-1 text-[9px] font-mono py-1.5 rounded-lg border transition-all cursor-pointer ${
                  slippage === s
                    ? 'border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08]'
                    : 'border-[#141414] text-[#333] hover:border-[#222] hover:text-[#666]'
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        {/* Fee disclosure */}
        <div className="bg-[#0a0a0a] border border-[#141414] rounded-xl p-3 space-y-1.5">
          {[
            { label: 'Platform fee', value: '0.7%' },
            { label: 'Jupiter routing', value: 'Best route' },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-[9px] font-mono">
              <span className="text-[#333]">{r.label}</span>
              <span className="text-[#555]">{r.value}</span>
            </div>
          ))}
          <div className="flex justify-between text-[9px] font-mono pt-1 border-t border-[#141414]">
            <span className="text-[#333]">Custody</span>
            <span className="text-[#00ff88]">Non-custodial ✓</span>
          </div>
        </div>

        {/* CTA */}
        {connected ? (
          <button
            type="button"
            disabled
            title="Jupiter swap integration coming soon"
            className="w-full py-3.5 rounded-xl font-mono font-bold text-[12px] text-[#333] bg-[#0a0a0a] border border-[#1a1a1a] cursor-not-allowed"
          >
            BUY {signal.token_symbol}
            <span className="ml-1.5 text-[9px] text-[#2a2a2a]">(coming soon)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="w-full py-3.5 rounded-xl font-mono font-bold text-[12px] text-[#00d4ff] border border-[#00d4ff30] bg-[#00d4ff08] hover:bg-[#00d4ff15] hover:border-[#00d4ff50] transition-all cursor-pointer"
          >
            CONNECT WALLET
          </button>
        )}

        <p className="text-center text-[9px] font-mono text-[#222]">
          Powered by Jupiter v6 · You sign, we never hold funds
        </p>
      </div>
    </div>
  )
}
