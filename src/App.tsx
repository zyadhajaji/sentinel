import { useState } from 'react'
import type { Signal } from './types'
import { Header } from './components/Header'
import { SignalFeed } from './components/SignalFeed'
import { TradePanel } from './components/TradePanel'
import { BacktestPage } from './components/backtest/BacktestPage'
import { useSignalFeed } from './hooks/useSignalFeed'
import { useBacktest } from './hooks/useBacktest'

type Tab = 'terminal' | 'backtest'

export default function App() {
  const { signals, newSignalId, connected, alertSettings, setAlertSettings } = useSignalFeed()
  const { strategies, positions, stats, updateStrategy, addStrategy, deleteStrategy, clearPositions } = useBacktest(signals)
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [tab, setTab] = useState<Tab>('terminal')

  const openCount = positions.filter(p => p.status === 'open').length

  return (
    <div className="flex flex-col bg-[#0a0a0a] text-[#e6e6e6]" style={{ height: '100dvh' }}>
      <Header feedConnected={connected} />

      {/* Desktop tab bar — hidden on mobile */}
      <div className="hidden md:flex items-center gap-1 px-4 py-2 border-b border-[#1e1e1e] bg-[#0a0a0a] shrink-0">
        <button
          onClick={() => setTab('terminal')}
          className={`text-[11px] font-mono px-3 py-1.5 rounded transition-all min-h-[36px] ${
            tab === 'terminal'
              ? 'bg-[#141414] text-[#e6e6e6] border border-[#2a2a2a]'
              : 'text-[#555555] hover:text-[#888888]'
          }`}
        >
          ◈ TERMINAL
        </button>
        <button
          onClick={() => setTab('backtest')}
          className={`text-[11px] font-mono px-3 py-1.5 rounded transition-all relative min-h-[36px] ${
            tab === 'backtest'
              ? 'bg-[#141414] text-[#e6e6e6] border border-[#2a2a2a]'
              : 'text-[#555555] hover:text-[#888888]'
          }`}
        >
          ⚡ BACKTEST
          {openCount > 0 && (
            <span className="ml-1.5 text-[10px] text-[#00d4ff]">{openCount}</span>
          )}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0">
        {tab === 'terminal' ? (
          <div className="flex h-full overflow-hidden">
            <div className="flex-1 overflow-hidden md:border-r md:border-[#1e1e1e]">
              <SignalFeed signals={signals} newSignalId={newSignalId} onTrade={setSelectedSignal} alertSettings={alertSettings} onAlertSettingsChange={setAlertSettings} />
            </div>
            <div className="w-[320px] shrink-0 bg-[#0d0d0d] overflow-hidden hidden md:flex flex-col">
              <TradePanel signal={selectedSignal} onClose={() => setSelectedSignal(null)} />
            </div>
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            <BacktestPage
              signals={signals}
              strategies={strategies}
              positions={positions}
              stats={stats}
              onSaveStrategy={updateStrategy}
              onAddStrategy={addStrategy}
              onDeleteStrategy={deleteStrategy}
              onClear={clearPositions}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom nav — iOS tab bar pattern, hidden on desktop */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-[#1e1e1e] z-50 bottom-nav">
        <div className="flex">
          <button
            onClick={() => setTab('terminal')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-all ${
              tab === 'terminal' ? 'text-[#00d4ff]' : 'text-[#444444]'
            }`}
          >
            <span className="text-lg leading-none">◈</span>
            <span className="text-[10px] font-mono tracking-wider">TERMINAL</span>
          </button>
          <button
            onClick={() => setTab('backtest')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-all relative ${
              tab === 'backtest' ? 'text-[#00d4ff]' : 'text-[#444444]'
            }`}
          >
            <span className="text-lg leading-none">⚡</span>
            <span className="text-[10px] font-mono tracking-wider">BACKTEST</span>
            {openCount > 0 && (
              <span className="absolute top-2 right-[calc(50%-16px)] w-4 h-4 rounded-full bg-[#00d4ff] text-[#0a0a0a] text-[9px] font-bold flex items-center justify-center">
                {openCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
