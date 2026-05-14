import { useState, useEffect } from 'react'
import { useAdmin } from '../contexts/AdminContext'

const AVATAR_COLORS = [
  { label: 'Cyan',   value: '#00d4ff' },
  { label: 'Green',  value: '#00ff88' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Orange', value: '#ff9500' },
  { label: 'Red',    value: '#ff3355' },
  { label: 'Gold',   value: '#ffd700' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function ProfileModal({ open, onClose }: Props) {
  const { profile, setUsername, setAvatarColor } = useAdmin()
  const [nameInput, setNameInput] = useState(profile.username)
  const [colorInput, setColorInput] = useState(profile.avatarColor)

  // Sync when modal opens
  useEffect(() => {
    if (open) {
      setNameInput(profile.username)
      setColorInput(profile.avatarColor)
    }
  }, [open, profile.username, profile.avatarColor])

  if (!open) return null

  function handleSave() {
    const trimmed = nameInput.trim().toUpperCase().slice(0, 16) || 'TRADER'
    setUsername(trimmed)
    setAvatarColor(colorInput)
    onClose()
  }

  const initials = (nameInput.trim() || 'T').slice(0, 2).toUpperCase()

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Sheet */}
      <div className="relative w-full sm:w-80 bg-[#0d0d0d] border border-[#1e1e1e] rounded-t-2xl sm:rounded-2xl p-6 space-y-5 z-10">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded text-[#555] hover:text-[#999] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Header */}
        <div className="text-center">
          {/* Big avatar preview */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold mx-auto mb-3 select-none"
            style={{ background: `${colorInput}22`, border: `2px solid ${colorInput}60`, color: colorInput }}
          >
            {initials}
          </div>
          <p className="text-[13px] font-mono text-[#888]">Edit Profile</p>
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider">Name</label>
          <input
            type="text"
            value={nameInput}
            maxLength={16}
            onChange={e => setNameInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="TRADER"
            className="w-full bg-[#080808] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-[13px] font-mono text-[#e6e6e6] placeholder-[#333] outline-none focus:border-[#2a2a2a] transition-colors min-h-[44px]"
          />
        </div>

        {/* Color swatches */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider">Color</label>
          <div className="flex gap-2">
            {AVATAR_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setColorInput(c.value)}
                aria-label={c.label}
                className="w-8 h-8 rounded-full flex-1 min-w-0 cursor-pointer transition-all"
                style={{
                  background: c.value,
                  outline: colorInput === c.value ? `2px solid ${c.value}` : '2px solid transparent',
                  outlineOffset: '2px',
                  opacity: colorInput === c.value ? 1 : 0.45,
                }}
              />
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full min-h-[44px] rounded-xl text-[12px] font-mono font-bold tracking-wider transition-all cursor-pointer"
          style={{
            background: `${colorInput}18`,
            border: `1px solid ${colorInput}40`,
            color: colorInput,
          }}
        >
          SAVE
        </button>
      </div>
    </div>
  )
}
