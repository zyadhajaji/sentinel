import { useState } from 'react'
import type { Signal } from './types'
import { Header } from './components/Header'
import { SignalFeed } from './components/SignalFeed'
import { TradePanel } from './components/TradePanel'
import { TokenDetailModal } from './components/TokenDetailModal'
import { BacktestPage } from './components/backtest/BacktestPage'
import { PortfolioDashboard } from './components/portfolio/PortfolioDashboard'
import { useSignalFeed } from './hooks/useSignalFeed'
import { useBacktest } from './hooks/useBacktest'

type Tab = 'terminal' | 'backtest' | 'portfolio'

export default function App() {
  const {
    signals, newSignalId, connected, alertSettings, setAlertSettings, solPrice,
    watchedCAs, addWatchedCA, removeWatchedCA,
  } = useSignalFeed()
  const {
    strategies, positions, stats, botActivity,
    updateStrategy, toggleAutoTrade, addStrategy, deleteStrategy, clearPositions,
  } = useBacktest(signals)
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [detailSignal, setDetailSignal] = useState<Signal | null>(null)
  const [tab, setTab] = useState<Tab>('terminal')

  const openCount = positions.filter(p => p.status === 'open').length

  return (
    <div className="flex flex-col bg-[#080808] text-[#e6e6e6]" style={{ height: '100dvh' }}>
      <Header
        feedConnected={connected}
        solPrice={solPrice}
        botActivity={botActivity}
        openPositions={openCount}
      />

      {/* Desktop tab bar */}
      <div className="hidden md:flex items-center gap-1 px-4 py-2 border-b border-[#1a1a1a] bg-[#080808] shrink-0">
        {([
          { id: 'terminal' as const, label: 'TERMINAL' },
          { id: 'backtest' as const, label: 'BOT' },
          { id: 'portfolio' as const, label: 'PORTFOLIO' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-[11px] font-mono px-3 py-1.5 rounded transition-all relative min-h-[36px] cursor-pointer ${
              tab === t.id
                ? 'bg-[#141414] text-[#e6e6e6] border border-[#2a2a2a]'
                : 'text-[#555555] hover:text-[#888888] border border-transparent'
            }`}>
            {t.label}
            {t.id === 'backtest' && openCount > 0 && (
              <span className="ml-1.5 text-[10px] text-[#00d4ff]">{openCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0">
        {tab === 'terminal' && (
          <div className="flex h-full overflow-hidden">
            <div className="flex-1 overflow-hidden md:border-r md:border-[#1a1a1a]">
              <SignalFeed
                signals={signals}
                newSignalId={newSignalId}
                onTrade={setSelectedSignal}
                onDetail={setDetailSignal}
                alertSettings={alertSettings}
                onAlertSettingsChange={setAlertSettings}
                watchedCAs={watchedCAs}
                onAddWatchedCA={addWatchedCA}
                onRemoveWatchedCA={removeWatchedCA}
              />
            </div>
            <div className="w-[320px] shrink-0 bg-[#0d0d0d] overflow-hidden hidden md:flex flex-col">
              <TradePanel signal={selectedSignal} onClose={() => setSelectedSignal(null)} />
            </div>
          </div>
        )}

        {tab === 'backtest' && (
          <div className="h-full overflow-hidden">
            <BacktestPage
              signals={signals}
              strategies={strategies}
              positions={positions}
              stats={stats}
              botActivity={botActivity}
              watchedCAs={watchedCAs}
              onAddWatchedCA={addWatchedCA}
              onRemoveWatchedCA={removeWatchedCA}
              onSaveStrategy={updateStrategy}
              onAddStrategy={addStrategy}
              onDeleteStrategy={deleteStrategy}
              onToggleAutoTrade={toggleAutoTrade}
              onClear={clearPositions}
            />
          </div>
        )}

        {tab === 'portfolio' && (
          <div className="h-full overflow-hidden">
            <PortfolioDashboard
              strategies={strategies}
              positions={positions}
              stats={stats}
              solPrice={solPrice}
              onClear={clearPositions}
            />
          </div>
        )}
      </div>

      {detailSignal && (
        <TokenDetailModal signal={detailSignal} onClose={() => setDetailSignal(null)} />
      )}

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-[#080808]/95 backdrop-blur-sm border-t border-[#1a1a1a] z-50 bottom-nav">
        <div className="flex">
          {([
            { id: 'terminal' as const, label: 'TERMINAL', icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            )},
            { id: 'backtest' as const, label: 'BOT', icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/>
                <line x1="12" y1="7" x2="12" y2="11"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/>
              </svg>
            )},
            { id: 'portfolio' as const, label: 'PORTFOLIO', icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            )},
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-all relative cursor-pointer ${
                tab === t.id ? 'text-[#00d4ff]' : 'text-[#444444]'
              }`}>
              {t.icon}
              <span className="text-[10px] font-mono tracking-wider">{t.label}</span>
              {t.id === 'backtest' && openCount > 0 && (
                <span className="absolute top-2 right-[calc(50%-16px)] w-4 h-4 rounded-full bg-[#00d4ff] text-[#080808] text-[9px] font-bold flex items-center justify-center">
                  {openCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
