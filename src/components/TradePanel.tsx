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
  const { connected } = useWallet()
  const { setVisible } = useWalletModal()

  if (!signal) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full border border-[#222222] flex items-center justify-center mb-4">
          <span className="text-[#333333] text-lg">◈</span>
        </div>
        <p className="text-[#555555] text-sm font-mono">Select a token to trade</p>
        <p className="text-[#333333] text-xs font-mono mt-1">Click TRADE on any signal</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] shrink-0">
        <span className="text-[11px] font-mono text-[#888888] uppercase tracking-wider">Trade</span>
        <button onClick={onClose} className="text-[#444444] hover:text-[#888888] text-sm transition-colors">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Token info */}
        <div className="bg-[#0f0f0f] rounded-lg p-3 flex items-center gap-3">
          <ScoreRing score={signal.scanner_score} grade={signal.score_grade} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm text-[#e6e6e6]">{signal.token_symbol}</p>
            <p className="text-[10px] text-[#555555] font-mono truncate">{shortCA(signal.ca)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-[#e6e6e6]">${formatPrice(signal.price_usd)}</p>
            <p className="text-[10px] font-mono" style={{ color: signal.price_change_1h >= 0 ? '#00ff88' : '#ff3355' }}>
              {signal.price_change_1h >= 0 ? '+' : ''}{signal.price_change_1h.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0f0f0f] rounded p-2.5">
            <p className="text-[9px] text-[#444444] uppercase tracking-wider mb-1">MCap</p>
            <p className="text-xs font-mono text-[#e6e6e6]">{formatUSD(signal.mcap_usd)}</p>
          </div>
          <div className="bg-[#0f0f0f] rounded p-2.5">
            <p className="text-[9px] text-[#444444] uppercase tracking-wider mb-1">Liquidity</p>
            <p className="text-xs font-mono text-[#e6e6e6]">{formatUSD(signal.liquidity_usd)}</p>
          </div>
        </div>

        {/* Buy/Sell tabs */}
        <div className="grid grid-cols-2 gap-1 bg-[#0f0f0f] p-1 rounded-lg">
          <button className="py-2 rounded text-xs font-mono font-bold text-[#0a0a0a] bg-[#00ff88] transition-all">
            BUY
          </button>
          <button className="py-2 rounded text-xs font-mono font-bold text-[#888888] hover:text-[#e6e6e6] transition-all">
            SELL
          </button>
        </div>

        {/* SOL amount input */}
        <div>
          <label className="text-[10px] text-[#555555] font-mono uppercase tracking-wider block mb-2">
            Amount (SOL)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={solAmount}
              onChange={e => setSolAmount(e.target.value)}
              className="flex-1 bg-[#0f0f0f] border border-[#222222] rounded-lg px-3 py-2.5 text-sm font-mono text-[#e6e6e6] focus:outline-none focus:border-[#00d4ff50] transition-colors"
              placeholder="0.1"
              step="0.01"
              min="0"
            />
          </div>
          <div className="flex gap-1.5 mt-2">
            {['0.05', '0.1', '0.25', '0.5'].map(amt => (
              <button
                key={amt}
                onClick={() => setSolAmount(amt)}
                className="flex-1 text-[10px] font-mono py-1.5 rounded border border-[#222222] text-[#555555] hover:text-[#e6e6e6] hover:border-[#333333] transition-all"
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Slippage */}
        <div>
          <label className="text-[10px] text-[#555555] font-mono uppercase tracking-wider block mb-2">
            Slippage
          </label>
          <div className="flex gap-1.5">
            {['0.5', '1', '2', '5'].map(s => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`flex-1 text-[10px] font-mono py-1.5 rounded border transition-all ${
                  slippage === s
                    ? 'border-[#00d4ff50] text-[#00d4ff] bg-[#00d4ff08]'
                    : 'border-[#222222] text-[#555555] hover:border-[#333333] hover:text-[#888888]'
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        {/* Fee disclosure */}
        <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#1a1a1a]">
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-[#444444]">Platform fee</span>
            <span className="text-[#888888]">0.7%</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-[#444444]">Jupiter routing</span>
            <span className="text-[#888888]">Best route</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-[#444444]">Custody</span>
            <span className="text-[#00ff88]">Non-custodial ✓</span>
          </div>
        </div>

        {/* CTA */}
        {connected ? (
          <button
            type="button"
            disabled
            title="Jupiter swap wiring is next"
            className="w-full py-3.5 rounded-lg font-display font-bold text-sm text-[#555555] bg-[#1a1a1a] border border-[#333333] cursor-not-allowed"
          >
            BUY {signal.token_symbol}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="w-full py-3.5 rounded-lg font-display font-bold text-sm text-[#e6e6e6] border border-[#00d4ff30] bg-[#00d4ff08] hover:bg-[#00d4ff18] hover:border-[#00d4ff60] transition-all"
          >
            CONNECT WALLET
          </button>
        )}

        <p className="text-center text-[9px] text-[#333333] font-mono">
          Powered by Jupiter v6 · You sign, we never hold funds
        </p>
      </div>
    </div>
  )
}
