import { useState } from 'react'
import { useAdmin } from '../../contexts/AdminContext'
import type { Strategy } from '../../types/backtest'

interface Props {
  strategies: Strategy[]
  onClose: () => void
  onEnableAll: () => void
  onDisableAll: () => void
  onSetAllPositionSize: (sol: number) => void
  onClearPositions: () => void
}

const AVATAR_COLORS = [
  '#00d4ff', '#00ff88', '#ffd700', '#ff8c00', '#ff3355',
  '#8b5cf6', '#ff6ee8', '#44aaff', '#00ffcc', '#ff4444',
]

export function AdminPanel({ strategies, onClose, onEnableAll, onDisableAll, onSetAllPositionSize, onClearPositions }: Props) {
  const { profile, setUsername, setAvatarColor, lock } = useAdmin()
  const [nameInput, setNameInput] = useState(profile.username)
  const [sizeInput, setSizeInput] = useState('0.1')
  const [confirmClear, setConfirmClear] = useState(false)

  const enabledCount = strategies.filter(s => s.enabled).length
  const totalCount   = strategies.length

  function handleSave() {
    if (nameInput.trim()) setUsername(nameInput.trim().toUpperCase())
  }

  function handleSetSize() {
    const v = parseFloat(sizeInput)
    if (!isNaN(v) && v > 0) onSetAllPositionSize(v)
  }

  function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return }
    onClearPositions()
    setConfirmClear(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] w-full md:max-w-sm rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '92dvh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="text-[13px] font-bold text-[#e6e6e6]" style={{ fontFamily: "'Inter', sans-serif" }}>ADMIN PANEL</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#ffd70015] text-[#ffd700] border border-[#ffd70025]">PRIVATE</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#1e1e1e] text-[#555] hover:text-[#e6e6e6] transition-colors cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-6">

          {/* ── Profile ─────────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-3">Profile</p>
            <div className="flex items-center gap-3 mb-3">
              {/* Avatar preview */}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[16px] font-bold shrink-0"
                style={{ background: `${profile.avatarColor}20`, border: `2px solid ${profile.avatarColor}40`, color: profile.avatarColor }}>
                {(nameInput || profile.username).slice(0, 2)}
              </div>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Your name"
                maxLength={16}
                className="flex-1 bg-[#141414] border border-[#222] rounded-xl px-3 py-2.5 text-[13px] font-bold text-[#e6e6e6] focus:outline-none focus:border-[#333] min-h-[44px]"
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              <button onClick={handleSave}
                className="px-3 py-2.5 min-h-[44px] text-[11px] font-mono rounded-xl border border-[#00d4ff30] text-[#00d4ff] bg-[#00d4ff08] hover:bg-[#00d4ff18] transition-all cursor-pointer">
                Save
              </button>
            </div>
            {/* Avatar color picker */}
            <p className="text-[10px] font-mono text-[#444] mb-2">Avatar color</p>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map(c => (
                <button key={c} onClick={() => setAvatarColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all cursor-pointer"
                  style={{ background: c, borderColor: profile.avatarColor === c ? '#fff' : 'transparent', transform: profile.avatarColor === c ? 'scale(1.15)' : 'scale(1)' }} />
              ))}
            </div>
          </div>

          {/* ── Bot Controls ─────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-3">Bot Controls</p>
            <div className="bg-[#141414] rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#888]">Active strategies</span>
                <span className="text-[13px] font-bold tabular-nums" style={{ color: enabledCount > 0 ? '#00ff88' : '#ff3355', fontFamily: "'Inter', sans-serif" }}>
                  {enabledCount} / {totalCount}
                </span>
              </div>
              <div className="h-1.5 bg-[#0d0d0d] rounded-full mt-2 overflow-hidden">
                <div className="h-full rounded-full transition-all bg-[#00ff88]" style={{ width: `${(enabledCount / Math.max(totalCount, 1)) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onEnableAll}
                className="min-h-[44px] text-[12px] font-mono rounded-xl border border-[#00ff8830] text-[#00ff88] bg-[#00ff8808] hover:bg-[#00ff8818] transition-all cursor-pointer">
                ▶ Enable All
              </button>
              <button onClick={onDisableAll}
                className="min-h-[44px] text-[12px] font-mono rounded-xl border border-[#ff335530] text-[#ff3355] bg-[#ff335508] hover:bg-[#ff335518] transition-all cursor-pointer">
                ■ Stop All
              </button>
            </div>
          </div>

          {/* ── Position Size ────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-3">Paper Trade Size — All Strategies</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number" step="0.01" min="0.001" max="10"
                  value={sizeInput}
                  onChange={e => setSizeInput(e.target.value)}
                  className="w-full bg-[#141414] border border-[#222] rounded-xl pl-3 pr-12 py-2.5 text-[13px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#333] min-h-[44px]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[#555]">SOL</span>
              </div>
              <button onClick={handleSetSize}
                className="px-4 min-h-[44px] text-[11px] font-mono rounded-xl border border-[#ffd70030] text-[#ffd700] bg-[#ffd70008] hover:bg-[#ffd70018] transition-all cursor-pointer">
                Apply All
              </button>
            </div>
            <p className="text-[10px] font-mono text-[#444] mt-1.5">Sets paper trade size for every strategy at once</p>
          </div>

          {/* ── Mode ────────────────────────────────────────────────── */}
          <div className="bg-[#141414] rounded-xl p-4 border border-[#1e1e1e]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-mono text-[#e6e6e6] font-bold mb-0.5">Trading Mode</p>
                <p className="text-[10px] font-mono text-[#444]">All trades are paper-simulated</p>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg bg-[#00ff8810] text-[#00ff88] border border-[#00ff8825]">
                PAPER ONLY
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#333] mt-2">
              Real trading is executed manually via the TRADE button on each token card.
              Auto-trade will use Jupiter when live wallet is connected.
            </p>
          </div>

          {/* ── Danger Zone ─────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-mono text-[#ff3355] uppercase tracking-widest mb-3">Danger Zone</p>
            <button onClick={handleClear}
              className={`w-full min-h-[44px] text-[12px] font-mono rounded-xl border transition-all cursor-pointer ${
                confirmClear
                  ? 'border-[#ff3355] text-[#ff3355] bg-[#ff335518] animate-pulse'
                  : 'border-[#ff335530] text-[#ff335588] hover:text-[#ff3355] hover:bg-[#ff335508]'
              }`}>
              {confirmClear ? '⚠ Tap again to confirm — this clears all trades' : 'Clear All Trade History'}
            </button>
          </div>

          {/* Lock */}
          <button onClick={() => { lock(); onClose() }}
            className="w-full min-h-[44px] text-[11px] font-mono text-[#333] hover:text-[#555] transition-colors cursor-pointer">
            🔒 Lock admin panel
          </button>
        </div>
      </div>
    </div>
  )
}
