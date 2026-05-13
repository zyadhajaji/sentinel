import { useState } from 'react'
import type { Strategy, StrategyFilters, TakeProfitLevel, Protocol } from '../../types/backtest'
import { newTpId } from '../../lib/strategyEngine'

interface Props {
  strategy: Strategy
  onSave: (s: Strategy) => void
  onDelete?: (id: string) => void
  onClose: () => void
  isNew?: boolean
}

type EditorTab = 'protocols' | 'filters' | 'exit' | 'general'

const PROTOCOL_LIST: { id: Protocol; label: string; color: string }[] = [
  { id: 'pump', label: 'Pump', color: '#ff8c00' },
  { id: 'pumpAmm', label: 'Pump AMM', color: '#ff8c00' },
  { id: 'raydium', label: 'Raydium', color: '#9945ff' },
  { id: 'bonkers', label: 'Bonkers', color: '#ff6b6b' },
  { id: 'surge', label: 'Surge', color: '#00d4ff' },
  { id: 'soar', label: 'Soar', color: '#00ff88' },
  { id: 'printr', label: 'Printr', color: '#ff88cc' },
  { id: 'liquidAf', label: 'Liquid', color: '#44aaff' },
  { id: 'liquidAfAmm', label: 'Liquid AMM', color: '#44aaff' },
  { id: 'moonshot', label: 'Moonshot', color: '#ffcc00' },
  { id: 'moonshotApp', label: 'Moonshot App', color: '#ffcc00' },
  { id: 'bonk', label: 'Bonk', color: '#ff8c00' },
  { id: 'mayhem', label: 'Mayhem', color: '#ff4444' },
  { id: 'heaven', label: 'Heaven', color: '#aaaaff' },
  { id: 'daosFun', label: 'Daos.fun', color: '#88aaff' },
  { id: 'orca', label: 'Orca', color: '#ff6ee8' },
  { id: 'meteoraAmm', label: 'Meteora', color: '#aaffaa' },
  { id: 'bags', label: 'Bags', color: '#88ff88' },
  { id: 'boop', label: 'Boop', color: '#ffaaff' },
]

const COLORS = ['#00ff88','#00d4ff','#ffcc00','#ff8c00','#ff3355','#9945ff','#ff6ee8','#44aaff','#aaffaa','#ff88cc']

function NumRange({
  label, value, onChange, requiresScanner = false,
}: {
  label: string
  value: { min: number | null; max: number | null }
  onChange: (v: { min: number | null; max: number | null }) => void
  requiresScanner?: boolean
}) {
  return (
    <div className={requiresScanner ? 'opacity-40' : ''}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-[10px] text-[#555555] uppercase tracking-wider font-mono">{label}</label>
        {requiresScanner && <span className="text-[9px] px-1 py-0.5 rounded bg-[#222] text-[#555] font-mono">scanner</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <input disabled={requiresScanner} type="number" placeholder="min"
          value={value.min ?? ''}
          onChange={e => onChange({ ...value, min: e.target.value === '' ? null : Number(e.target.value) })}
          className="flex-1 min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#333] disabled:cursor-not-allowed"
        />
        <span className="text-[#333] text-xs shrink-0">—</span>
        <input disabled={requiresScanner} type="number" placeholder="max"
          value={value.max ?? ''}
          onChange={e => onChange({ ...value, max: e.target.value === '' ? null : Number(e.target.value) })}
          className="flex-1 min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#333] disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}

export function StrategyEditor({ strategy: initial, onSave, onDelete, onClose, isNew }: Props) {
  const [draft, setDraft] = useState<Strategy>(JSON.parse(JSON.stringify(initial)))
  const [tab, setTab] = useState<EditorTab>('protocols')

  const setF = (updates: Partial<StrategyFilters>) =>
    setDraft(d => ({ ...d, filters: { ...d.filters, ...updates } }))

  const toggleProto = (p: Protocol) =>
    setF({ protocols: { ...draft.filters.protocols, [p]: !(draft.filters.protocols[p] ?? false) } })

  const addTP = () => setDraft(d => ({
    ...d,
    exit: { ...d.exit, takeProfitLevels: [...d.exit.takeProfitLevels, { id: newTpId(), type: 'percent', value: 100, sellPercent: 50 }] },
  }))

  const updTP = (id: string, upd: Partial<TakeProfitLevel>) =>
    setDraft(d => ({ ...d, exit: { ...d.exit, takeProfitLevels: d.exit.takeProfitLevels.map(tp => tp.id === id ? { ...tp, ...upd } : tp) } }))

  const delTP = (id: string) =>
    setDraft(d => ({ ...d, exit: { ...d.exit, takeProfitLevels: d.exit.takeProfitLevels.filter(tp => tp.id !== id) } }))

  const activeCount = Object.values(draft.filters.protocols).filter(Boolean).length

  const TABS: { id: EditorTab; label: string }[] = [
    { id: 'protocols', label: activeCount > 0 ? `Protocols (${activeCount})` : 'Protocols' },
    { id: 'filters', label: 'Filters' },
    { id: 'exit', label: 'Exit Strategy' },
    { id: 'general', label: 'General' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm md:p-4">
      <div className="animate-slide-up bg-[#111111] border border-[#222222] w-full md:max-w-lg md:rounded-xl rounded-none max-h-screen md:max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: draft.color }} />
            <span className="font-display font-bold text-sm text-[#e6e6e6]">
              {isNew ? 'New Strategy' : `Edit: ${draft.name}`}
            </span>
          </div>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors text-lg">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-[#1a1a1a] shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`min-h-[44px] text-[11px] font-mono px-3 py-1.5 rounded whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-[#1a1a1a] text-[#e6e6e6] border border-[#333]' : 'text-[#555] hover:text-[#888]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* PROTOCOLS */}
          {tab === 'protocols' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-[#555] font-mono uppercase tracking-wider">Empty = all protocols</p>
                <div className="flex gap-2">
                  <button onClick={() => { const m: Record<string,boolean>={}; PROTOCOL_LIST.forEach(p=>{m[p.id]=true}); setF({protocols:m}) }}
                    className="text-[10px] font-mono text-[#00d4ff] hover:text-[#44ccff]">All</button>
                  <button onClick={() => setF({ protocols: {} })}
                    className="text-[10px] font-mono text-[#555] hover:text-[#888]">Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {PROTOCOL_LIST.map(proto => {
                  const active = draft.filters.protocols[proto.id] ?? false
                  return (
                    <button key={proto.id} onClick={() => toggleProto(proto.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-mono transition-all"
                      style={{
                        borderColor: active ? proto.color + '80' : '#222',
                        color: active ? proto.color : '#555',
                        background: active ? proto.color + '15' : 'transparent',
                      }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? proto.color : '#333' }} />
                      {proto.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* FILTERS */}
          {tab === 'filters' && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#555] uppercase tracking-wider font-mono block mb-1.5">Search Keywords</label>
                <input type="text" placeholder="pepe, doge (comma separated)"
                  value={draft.filters.searchKeywords.join(', ')}
                  onChange={e => setF({ searchKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#333]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#555] uppercase tracking-wider font-mono block mb-1.5">Exclude Keywords</label>
                <input type="text" placeholder="test, scam (comma separated)"
                  value={draft.filters.excludeKeywords.join(', ')}
                  onChange={e => setF({ excludeKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#333]"
                />
              </div>

              {/* Age */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-[10px] text-[#555] uppercase tracking-wider font-mono">Age</label>
                  <select value={draft.filters.age.unit}
                    onChange={e => setF({ age: { ...draft.filters.age, unit: e.target.value as 'minutes' | 'hours' } })}
                    className="text-[10px] font-mono bg-[#0f0f0f] border border-[#222] rounded px-1.5 py-0.5 text-[#888] focus:outline-none">
                    <option value="minutes">min</option>
                    <option value="hours">hrs</option>
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <input type="number" placeholder="min" value={draft.filters.age.min ?? ''}
                    onChange={e => setF({ age: { ...draft.filters.age, min: e.target.value===''?null:Number(e.target.value) } })}
                    className="flex-1 min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none" />
                  <input type="number" placeholder="max" value={draft.filters.age.max ?? ''}
                    onChange={e => setF({ age: { ...draft.filters.age, max: e.target.value===''?null:Number(e.target.value) } })}
                    className="flex-1 min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumRange label="Liquidity ($)" value={draft.filters.liquidity} onChange={v => setF({ liquidity: v })} />
                <NumRange label="Market Cap ($)" value={draft.filters.marketCap} onChange={v => setF({ marketCap: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumRange label="Volume ($)" value={draft.filters.volume} onChange={v => setF({ volume: v })} />
                <NumRange label="Holders" value={draft.filters.holders} onChange={v => setF({ holders: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumRange label="Dev Holding (%)" value={draft.filters.devHolding} onChange={v => setF({ devHolding: v })} requiresScanner />
                <NumRange label="Top 10 (%)" value={draft.filters.top10Holders} onChange={v => setF({ top10Holders: v })} requiresScanner />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumRange label="Snipers" value={draft.filters.snipers} onChange={v => setF({ snipers: v })} requiresScanner />
                <NumRange label="Insiders (%)" value={draft.filters.insiders} onChange={v => setF({ insiders: v })} requiresScanner />
              </div>

              {/* Socials */}
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wider font-mono mb-2">Socials Required</p>
                <div className="flex flex-wrap gap-2">
                  {([['twitterExists','Twitter'],['website','Website'],['telegram','Telegram'],['atLeastOneSocial','Any Social']] as [keyof StrategyFilters, string][]).map(([key, label]) => {
                    const active = draft.filters[key] as boolean
                    return (
                      <button key={key} onClick={() => setF({ [key]: !active } as Partial<StrategyFilters>)}
                        className={`text-[11px] font-mono px-3 py-1.5 rounded border transition-all ${
                          active ? 'border-[#00d4ff40] text-[#00d4ff] bg-[#00d4ff08]' : 'border-[#222] text-[#555]'
                        }`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Narratives */}
              <div>
                <p className="text-[10px] text-[#555555] uppercase tracking-wider mb-2">Narratives (any match)</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['AI','MEME','ANIMAL','GAMING','DEFI','CELEB','SPACE','FOOD','PATRIOT','SOLANA'] as const).map(tag => {
                    const active = draft.filters.narratives.includes(tag)
                    return (
                      <button key={tag} type="button"
                        onClick={() => setDraft(d => ({
                          ...d,
                          filters: {
                            ...d.filters,
                            narratives: active
                              ? d.filters.narratives.filter(n => n !== tag)
                              : [...d.filters.narratives, tag]
                          }
                        }))}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-all ${
                          active ? 'border-[#00d4ff60] text-[#00d4ff] bg-[#00d4ff12]' : 'border-[#2a2a2a] text-[#555555] hover:text-[#888888]'
                        }`}>
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumRange label="Buy Pressure %" value={draft.filters.buyPressure} onChange={v => setF({ buyPressure: v })} />
                <NumRange label="1h Change %" value={draft.filters.priceChange1h} onChange={v => setF({ priceChange1h: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumRange label="Fees Est (SOL)" value={draft.filters.feesEstSol} onChange={v => setF({ feesEstSol: v })} />
              </div>
            </div>
          )}

          {/* EXIT STRATEGY */}
          {tab === 'exit' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-[#555] uppercase tracking-wider font-mono">Take Profit Levels</p>
                  <button onClick={addTP} className="text-[11px] font-mono text-[#00d4ff] hover:text-[#44ccff]">+ Add Level</button>
                </div>
                {draft.exit.takeProfitLevels.length === 0 && (
                  <p className="text-[#444] text-xs font-mono py-3">No TP levels — closes only on SL or timeout</p>
                )}
                <div className="space-y-2">
                  {draft.exit.takeProfitLevels.map((tp, i) => (
                    <div key={tp.id} className="bg-[#0f0f0f] rounded-lg p-3 border border-[#1a1a1a]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-[#555] font-mono">TP {i + 1}</span>
                        <button onClick={() => delTP(tp.id)} className="text-[#333] hover:text-[#ff3355] text-xs transition-colors">✕</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-[#444] font-mono block mb-1">Type</label>
                          <select value={tp.type} onChange={e => updTP(tp.id, { type: e.target.value as 'percent' | 'mcap_usd' })}
                            className="w-full min-h-[44px] bg-[#111] border border-[#222] rounded px-2 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none">
                            <option value="percent">% Gain</option>
                            <option value="mcap_usd">MCap $</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-[#444] font-mono block mb-1">{tp.type === 'percent' ? 'At +%' : 'At MCap $'}</label>
                          <input type="number" value={tp.value}
                            onChange={e => updTP(tp.id, { value: Number(e.target.value) })}
                            placeholder={tp.type === 'percent' ? '100' : '500000'}
                            className="w-full min-h-[44px] bg-[#111] border border-[#222] rounded px-2 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[11px] text-[#444] font-mono block mb-1">Sell %</label>
                          <input type="number" value={tp.sellPercent} min={1} max={100}
                            onChange={e => updTP(tp.id, { sellPercent: Number(e.target.value) })}
                            className="w-full min-h-[44px] bg-[#111] border border-[#222] rounded px-2 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none" />
                        </div>
                      </div>
                      <p className="text-[11px] text-[#444] font-mono mt-1.5">
                        {tp.type === 'percent'
                          ? `Sell ${tp.sellPercent}% of remaining at +${tp.value}%`
                          : `Sell ${tp.sellPercent}% of remaining at $${Number(tp.value).toLocaleString()} MCap`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#555] uppercase tracking-wider font-mono block mb-1.5">Stop Loss (%)</label>
                  <input type="number" placeholder="-40"
                    value={draft.exit.stopLossPct ?? ''}
                    onChange={e => setDraft(d => ({ ...d, exit: { ...d.exit, stopLossPct: e.target.value===''?null:Number(e.target.value) } }))}
                    className="w-full min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#ff335540]" />
                </div>
                <div>
                  <label className="text-[10px] text-[#555] uppercase tracking-wider font-mono block mb-1.5">Max Hold (min)</label>
                  <input type="number" placeholder="60"
                    value={draft.exit.maxHoldMinutes ?? ''}
                    onChange={e => setDraft(d => ({ ...d, exit: { ...d.exit, maxHoldMinutes: e.target.value===''?null:Number(e.target.value) } }))}
                    className="w-full min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none focus:border-[#333]" />
                </div>
              </div>
            </div>
          )}

          {/* GENERAL */}
          {tab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#555] uppercase tracking-wider font-mono block mb-1.5">Strategy Name</label>
                <input type="text" value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  className="w-full min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2.5 py-2 text-sm font-mono text-[#e6e6e6] focus:outline-none focus:border-[#333]"
                  placeholder="My Strategy" />
              </div>
              <div>
                <label className="text-[10px] text-[#555] uppercase tracking-wider font-mono block mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setDraft(d => ({ ...d, color }))}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ background: color, borderColor: draft.color === color ? '#fff' : 'transparent' }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#555] uppercase tracking-wider font-mono block mb-1.5">Position Size (SOL)</label>
                <input type="number" step="0.01" min="0.001" value={draft.positionSizeSol}
                  onChange={e => setDraft(d => ({ ...d, positionSizeSol: Number(e.target.value) }))}
                  className="w-full min-h-[44px] bg-[#0f0f0f] border border-[#222] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#e6e6e6] focus:outline-none" />
                <p className="text-[10px] text-[#444] font-mono mt-1">Paper trading size — no real funds</p>
              </div>
              <div className="flex items-center justify-between py-3 border-t border-[#1a1a1a]">
                <span className="text-[11px] text-[#888] font-mono">Strategy Active</span>
                <button onClick={() => setDraft(d => ({ ...d, enabled: !d.enabled }))}
                  className={`text-[11px] font-mono px-3 py-1.5 rounded border transition-all ${
                    draft.enabled ? 'border-[#00ff8840] text-[#00ff88] bg-[#00ff8808]' : 'border-[#333] text-[#555]'
                  }`}>
                  {draft.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#1a1a1a] shrink-0">
          <div>
            {!isNew && onDelete && (
              <button onClick={() => { onDelete(draft.id); onClose() }}
                className="text-[11px] font-mono text-[#ff3355] hover:text-[#ff6677] transition-colors">
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="text-[11px] font-mono px-4 py-2 rounded border border-[#333] text-[#555] hover:text-[#888] transition-all">
              Cancel
            </button>
            <button onClick={() => { onSave(draft); onClose() }}
              className="text-[11px] font-mono px-4 py-2 rounded border font-bold transition-all"
              style={{ borderColor: draft.color + '60', color: draft.color, background: draft.color + '15' }}>
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
