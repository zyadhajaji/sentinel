import { useState, useRef } from 'react'
import type { CSSProperties, RefObject } from 'react'
import type { Position } from '../types/backtest'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PnlCardProps {
  position: Position
  solPrice: number
  onClose: () => void
}

type CurrencyMode = 'sol' | 'usd' | 'both'

interface CardSettings {
  background: string
  blurPx: number
  bgOpacity: number
  primaryColor: string
  secondaryColor: string
  textShadow: boolean
  boldText: boolean
  currency: CurrencyMode
  widthPx: number
  heightPx: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRADIENTS = [
  'linear-gradient(135deg, #1a0533 0%, #0d0d1a 100%)',  // dark purple
  'linear-gradient(135deg, #001233 0%, #0d1b2a 100%)',  // dark blue
  'linear-gradient(135deg, #080808 0%, #141414 100%)',  // black
  'linear-gradient(135deg, #001a0d 0%, #0a1a10 100%)',  // dark green
  'linear-gradient(135deg, #1a0000 0%, #1a0808 100%)',  // dark red
  'linear-gradient(135deg, #141414 0%, #1e1e1e 100%)',  // charcoal
]

const GRADIENT_LABELS = ['Purple', 'Blue', 'Black', 'Green', 'Red', 'Charcoal']

const DEFAULTS: CardSettings = {
  background: GRADIENTS[0],
  blurPx: 0,
  bgOpacity: 1,
  primaryColor: '#e6e6e6',
  secondaryColor: '#888888',
  textShadow: false,
  boldText: false,
  currency: 'both',
  widthPx: 360,
  heightPx: 200,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function holdTime(entry: string, exit: string | null): string {
  const ms = new Date(exit ?? new Date().toISOString()).getTime() - new Date(entry).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function fmtSol(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.abs(n) >= 1 ? n.toFixed(3) : n.toFixed(4)}`
}

function fmtUSD(usd: number): string {
  if (Math.abs(usd) >= 1000) return `${usd >= 0 ? '+' : ''}$${(Math.abs(usd) / 1000).toFixed(1)}K`
  return `${usd >= 0 ? '+' : ''}$${usd.toFixed(2)}`
}

function fmtMcap(mc: number): string {
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(1)}M`
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(0)}K`
  return `$${mc.toFixed(0)}`
}

function pnlPct(pos: Position): number {
  if (pos.status === 'open') return pos.unrealizedPnlPct
  return pos.positionSizeSol > 0 ? (pos.totalPnlSol / pos.positionSizeSol) * 100 : 0
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ── Card Visual ───────────────────────────────────────────────────────────────

function PnlCardVisual({
  position,
  solPrice,
  settings,
  cardRef,
}: {
  position: Position
  solPrice: number
  settings: CardSettings
  cardRef: RefObject<HTMLDivElement | null>
}) {
  const pnlSol = position.status === 'open' ? position.unrealizedPnlSol : position.totalPnlSol
  const pnlUsd = pnlSol * solPrice
  const pct = pnlPct(position)
  const isPositive = pnlSol >= 0
  const pnlColor = isPositive ? '#00ff88' : '#ff3355'
  const exitMc = position.currentMcap

  const textStyle: CSSProperties = {
    textShadow: settings.textShadow ? '0 1px 4px rgba(0,0,0,0.8)' : 'none',
    fontWeight: settings.boldText ? 700 : undefined,
  }

  const bgStyle: CSSProperties = { background: settings.background }

  const dateStr = new Date(position.exitTime ?? position.entryTime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: '2-digit',
  })
  const timeStr = new Date(position.exitTime ?? position.entryTime).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  return (
    <div
      ref={cardRef}
      style={{
        width: settings.widthPx,
        height: settings.heightPx,
        ...bgStyle,
        opacity: settings.bgOpacity,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        fontFamily: "'Inter', system-ui, sans-serif",
        backdropFilter: settings.blurPx > 0 ? `blur(${settings.blurPx}px)` : undefined,
        padding: '20px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Top row: symbol + strategy chip */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontSize: 32,
            fontWeight: 800,
            color: settings.primaryColor,
            lineHeight: 1,
            letterSpacing: '-0.5px',
            ...textStyle,
          }}>
            {position.tokenSymbol}
          </div>
          <div style={{
            fontSize: 10,
            color: settings.secondaryColor,
            marginTop: 4,
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
            ...textStyle,
          }}>
            {position.tokenName}
          </div>
        </div>

        {/* Strategy chip */}
        <div style={{
          fontSize: 9,
          fontFamily: 'monospace',
          color: settings.secondaryColor,
          background: hexToRgba('#ffffff', 0.06),
          border: `1px solid ${hexToRgba('#ffffff', 0.1)}`,
          borderRadius: 6,
          padding: '3px 8px',
          letterSpacing: '0.06em',
          ...textStyle,
        }}>
          {position.strategyName}
        </div>
      </div>

      {/* Middle: PnL big number */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          {(settings.currency === 'sol' || settings.currency === 'both') && (
            <div style={{
              fontSize: 28,
              fontWeight: 800,
              color: pnlColor,
              lineHeight: 1,
              letterSpacing: '-0.5px',
              fontVariantNumeric: 'tabular-nums',
              ...textStyle,
            }}>
              {fmtSol(pnlSol)} SOL
            </div>
          )}
          {(settings.currency === 'usd' || settings.currency === 'both') && (
            <div style={{
              fontSize: settings.currency === 'usd' ? 28 : 13,
              fontWeight: settings.currency === 'usd' ? 800 : 400,
              color: settings.currency === 'usd' ? pnlColor : settings.secondaryColor,
              lineHeight: 1.2,
              marginTop: settings.currency === 'both' ? 3 : 0,
              fontVariantNumeric: 'tabular-nums',
              ...textStyle,
            }}>
              {fmtUSD(pnlUsd)}
            </div>
          )}
        </div>

        {/* PnL % badge */}
        <div style={{
          fontSize: 16,
          fontWeight: 700,
          color: pnlColor,
          background: `${pnlColor}18`,
          border: `1px solid ${pnlColor}35`,
          borderRadius: 8,
          padding: '4px 10px',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          ...textStyle,
        }}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </div>
      </div>

      {/* Bottom row: MC, hold time, date */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 8, color: settings.secondaryColor, fontFamily: 'monospace', letterSpacing: '0.08em', opacity: 0.7, ...textStyle }}>
              ENTRY MC
            </div>
            <div style={{ fontSize: 11, color: settings.primaryColor, fontFamily: 'monospace', marginTop: 2, ...textStyle }}>
              {fmtMcap(position.entryMcap)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: settings.secondaryColor, fontFamily: 'monospace', letterSpacing: '0.08em', opacity: 0.7, ...textStyle }}>
              {position.status === 'open' ? 'CURRENT MC' : 'EXIT MC'}
            </div>
            <div style={{ fontSize: 11, color: settings.primaryColor, fontFamily: 'monospace', marginTop: 2, ...textStyle }}>
              {fmtMcap(exitMc)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: settings.secondaryColor, fontFamily: 'monospace', letterSpacing: '0.08em', opacity: 0.7, ...textStyle }}>
              HOLD
            </div>
            <div style={{ fontSize: 11, color: settings.primaryColor, fontFamily: 'monospace', marginTop: 2, ...textStyle }}>
              {holdTime(position.entryTime, position.exitTime)}
            </div>
          </div>
        </div>

        {/* Date + watermark */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 8,
            color: '#ffffff',
            opacity: 0.3,
            fontFamily: 'monospace',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}>
            SENTINEL
          </div>
          <div style={{ fontSize: 8, color: settings.secondaryColor, fontFamily: 'monospace', opacity: 0.6, ...textStyle }}>
            {dateStr} {timeStr}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Export Logic ──────────────────────────────────────────────────────────────

async function exportCardAsSvg(
  cardEl: HTMLDivElement,
  tokenSymbol: string,
): Promise<void> {
  const w = cardEl.offsetWidth
  const h = cardEl.offsetHeight
  const innerHTML = cardEl.innerHTML

  // Gather computed styles from the card element
  const cs = getComputedStyle(cardEl)
  const inlineStyle = [
    `background: ${cs.background}`,
    `opacity: ${cs.opacity}`,
    `border-radius: ${cs.borderRadius}`,
    `padding: ${cs.padding}`,
    `box-sizing: border-box`,
    `display: flex`,
    `flex-direction: column`,
    `justify-content: space-between`,
    `font-family: ${cs.fontFamily}`,
    `width: ${w}px`,
    `height: ${h}px`,
    `overflow: hidden`,
    `position: relative`,
  ].join('; ')

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="${inlineStyle}">
      ${innerHTML}
    </div>
  </foreignObject>
</svg>`

  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pnl-${tokenSymbol}-${Date.now()}.svg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function copyCardToClipboard(
  cardEl: HTMLDivElement,
  tokenSymbol: string,
): Promise<boolean> {
  try {
    const w = cardEl.offsetWidth
    const h = cardEl.offsetHeight
    const innerHTML = cardEl.innerHTML
    const cs = getComputedStyle(cardEl)
    const inlineStyle = [
      `background: ${cs.background}`,
      `opacity: ${cs.opacity}`,
      `border-radius: ${cs.borderRadius}`,
      `padding: ${cs.padding}`,
      `box-sizing: border-box`,
      `display: flex`,
      `flex-direction: column`,
      `justify-content: space-between`,
      `font-family: ${cs.fontFamily}`,
      `width: ${w}px`,
      `height: ${h}px`,
      `overflow: hidden`,
      `position: relative`,
    ].join('; ')

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="${inlineStyle}">
      ${innerHTML}
    </div>
  </foreignObject>
</svg>`

    // Try to copy as text (SVG markup) — clipboard image requires canvas which needs no-CORS
    await navigator.clipboard.writeText(svgContent)
    return true
  } catch {
    // Fallback: trigger download
    await exportCardAsSvg(cardEl, tokenSymbol)
    return false
  }
}

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: CardSettings
  onChange: (patch: Partial<CardSettings>) => void
}) {
  const labelCls = 'text-[9px] font-mono text-[#444] uppercase tracking-widest mb-1 block'
  const rowCls = 'flex items-center gap-2'

  return (
    <div className="flex-1 overflow-y-auto space-y-5 py-1 pr-1">

      {/* BACKGROUND */}
      <div>
        <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-3 font-bold">Background</p>
        {/* Gradient swatches */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {GRADIENTS.map((g, i) => (
            <button
              key={g}
              title={GRADIENT_LABELS[i]}
              onClick={() => onChange({ background: g })}
              className="h-8 rounded-lg border-2 transition-all cursor-pointer"
              style={{
                background: g,
                borderColor: settings.background === g ? '#7c3aed' : '#1e1e1e',
              }}
            />
          ))}
        </div>

        {/* Custom color */}
        <div className="mb-3">
          <span className={labelCls}>Custom color</span>
          <input
            type="color"
            defaultValue="#080808"
            onChange={e => onChange({ background: e.target.value })}
            className="w-full h-8 rounded-lg cursor-pointer border border-[#1e1e1e] bg-[#111]"
            style={{ padding: 2 }}
          />
        </div>

        {/* Blur */}
        <div className="mb-3">
          <div className={rowCls}>
            <span className={labelCls}>Blur</span>
            <span className="text-[9px] font-mono text-[#333] ml-auto">{settings.blurPx}px</span>
          </div>
          <input
            type="range" min={0} max={20} step={1}
            value={settings.blurPx}
            onChange={e => onChange({ blurPx: Number(e.target.value) })}
            className="w-full accent-[#7c3aed] cursor-pointer"
          />
        </div>

        {/* Opacity */}
        <div>
          <div className={rowCls}>
            <span className={labelCls}>Opacity</span>
            <span className="text-[9px] font-mono text-[#333] ml-auto">{settings.bgOpacity.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0.1} max={1} step={0.05}
            value={settings.bgOpacity}
            onChange={e => onChange({ bgOpacity: Number(e.target.value) })}
            className="w-full accent-[#7c3aed] cursor-pointer"
          />
        </div>
      </div>

      {/* DIVIDER */}
      <div className="border-t border-[#1a1a1a]" />

      {/* TEXT */}
      <div>
        <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-3 font-bold">Text</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <span className={labelCls}>Primary</span>
            <input
              type="color"
              value={settings.primaryColor}
              onChange={e => onChange({ primaryColor: e.target.value })}
              className="w-full h-8 rounded-lg cursor-pointer border border-[#1e1e1e]"
              style={{ padding: 2 }}
            />
          </div>
          <div>
            <span className={labelCls}>Secondary</span>
            <input
              type="color"
              value={settings.secondaryColor}
              onChange={e => onChange({ secondaryColor: e.target.value })}
              className="w-full h-8 rounded-lg cursor-pointer border border-[#1e1e1e]"
              style={{ padding: 2 }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ textShadow: !settings.textShadow })}
            className="flex-1 py-2 rounded-lg text-[10px] font-mono transition-all cursor-pointer border"
            style={{
              background: settings.textShadow ? '#7c3aed20' : '#111',
              borderColor: settings.textShadow ? '#7c3aed50' : '#1e1e1e',
              color: settings.textShadow ? '#a78bfa' : '#444',
            }}
          >
            Shadow
          </button>
          <button
            onClick={() => onChange({ boldText: !settings.boldText })}
            className="flex-1 py-2 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border"
            style={{
              background: settings.boldText ? '#7c3aed20' : '#111',
              borderColor: settings.boldText ? '#7c3aed50' : '#1e1e1e',
              color: settings.boldText ? '#a78bfa' : '#444',
            }}
          >
            Bold
          </button>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="border-t border-[#1a1a1a]" />

      {/* CURRENCY */}
      <div>
        <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-3 font-bold">Currency</p>
        <div className="flex gap-2">
          {(['sol', 'usd', 'both'] as CurrencyMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => onChange({ currency: mode })}
              className="flex-1 py-2 rounded-lg text-[10px] font-mono transition-all cursor-pointer border"
              style={{
                background: settings.currency === mode ? '#7c3aed20' : '#111',
                borderColor: settings.currency === mode ? '#7c3aed50' : '#1e1e1e',
                color: settings.currency === mode ? '#a78bfa' : '#444',
              }}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* DIVIDER */}
      <div className="border-t border-[#1a1a1a]" />

      {/* LAYOUT */}
      <div>
        <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-3 font-bold">Layout</p>
        <div className="mb-3">
          <div className={rowCls}>
            <span className={labelCls}>Width</span>
            <span className="text-[9px] font-mono text-[#333] ml-auto">{settings.widthPx}px</span>
          </div>
          <input
            type="range" min={280} max={520} step={8}
            value={settings.widthPx}
            onChange={e => onChange({ widthPx: Number(e.target.value) })}
            className="w-full accent-[#7c3aed] cursor-pointer"
          />
        </div>
        <div>
          <div className={rowCls}>
            <span className={labelCls}>Height</span>
            <span className="text-[9px] font-mono text-[#333] ml-auto">{settings.heightPx}px</span>
          </div>
          <input
            type="range" min={160} max={320} step={8}
            value={settings.heightPx}
            onChange={e => onChange({ heightPx: Number(e.target.value) })}
            className="w-full accent-[#7c3aed] cursor-pointer"
          />
        </div>
      </div>

    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PnlCard({ position, solPrice, onClose }: PnlCardProps) {
  const [settings, setSettings] = useState<CardSettings>(DEFAULTS)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'copied' | 'copied_fallback'>('idle')
  const cardRef = useRef<HTMLDivElement | null>(null)

  function patchSettings(patch: Partial<CardSettings>) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  async function handleExport() {
    if (!cardRef.current) return
    setExportStatus('exporting')
    try {
      await exportCardAsSvg(cardRef.current, position.tokenSymbol)
    } finally {
      setExportStatus('idle')
    }
  }

  async function handleCopy() {
    if (!cardRef.current) return
    setExportStatus('exporting')
    const ok = await copyCardToClipboard(cardRef.current, position.tokenSymbol)
    setExportStatus(ok ? 'copied' : 'copied_fallback')
    setTimeout(() => setExportStatus('idle'), 2200)
  }

  const copyLabel = (() => {
    if (exportStatus === 'exporting') return 'Working…'
    if (exportStatus === 'copied') return '✓ Copied SVG'
    if (exportStatus === 'copied_fallback') return '✓ Saved (fallback)'
    return 'Copy to Clipboard'
  })()

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 bg-[#0a0a0a] border border-[#1e1e1e] rounded-2xl flex flex-col overflow-hidden"
        style={{
          width: 'min(92vw, 780px)',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span className="text-[11px] font-mono text-[#888] uppercase tracking-widest">PnL Card Generator</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[#444] hover:text-[#888] cursor-pointer rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body: preview left, settings right */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Preview pane */}
          <div className="flex flex-col sm:flex-1 sm:min-w-0 p-5 overflow-y-auto sm:overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <PnlCardVisual
                position={position}
                solPrice={solPrice}
                settings={settings}
                cardRef={cardRef}
              />
              <p className="text-[9px] font-mono text-[#2a2a2a] text-center">
                Adjust size &amp; style in the panel →
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4 shrink-0">
              <button
                onClick={handleExport}
                disabled={exportStatus === 'exporting'}
                className="flex-1 min-h-[44px] rounded-xl text-[12px] font-mono font-bold transition-all cursor-pointer border"
                style={{
                  background: '#7c3aed20',
                  borderColor: '#7c3aed40',
                  color: '#a78bfa',
                  opacity: exportStatus === 'exporting' ? 0.5 : 1,
                }}
              >
                {exportStatus === 'exporting' ? 'Working…' : 'Export Card'}
              </button>
              <button
                onClick={handleCopy}
                disabled={exportStatus === 'exporting'}
                className="flex-1 min-h-[44px] rounded-xl text-[12px] font-mono font-bold transition-all cursor-pointer border"
                style={{
                  background: exportStatus.startsWith('copied') ? '#00ff8815' : '#1a1a1a',
                  borderColor: exportStatus.startsWith('copied') ? '#00ff8840' : '#2a2a2a',
                  color: exportStatus.startsWith('copied') ? '#00ff88' : '#666',
                  opacity: exportStatus === 'exporting' ? 0.5 : 1,
                }}
              >
                {copyLabel}
              </button>
            </div>
          </div>

          {/* Settings pane */}
          <div
            className="sm:w-[220px] shrink-0 border-t sm:border-t-0 sm:border-l border-[#1a1a1a] px-4 py-4 flex flex-col overflow-y-auto"
            style={{ maxHeight: 'calc(92vh - 64px)' }}
          >
            <SettingsPanel settings={settings} onChange={patchSettings} />

            <div className="border-t border-[#1a1a1a] pt-4 mt-4 shrink-0">
              <button
                onClick={() => setSettings(DEFAULTS)}
                className="w-full py-2 rounded-lg text-[10px] font-mono text-[#444] hover:text-[#777] border border-[#1e1e1e] hover:border-[#2a2a2a] transition-all cursor-pointer"
              >
                Reset Defaults
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
