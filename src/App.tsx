import { useState, useEffect } from 'react'
import type { Signal } from './types'
import { Header } from './components/Header'
import { SignalFeed } from './components/SignalFeed'
import { TradePanel } from './components/TradePanel'
import { TokenDetailModal } from './components/TokenDetailModal'
import { BacktestPage } from './components/backtest/BacktestPage'
import { PortfolioDashboard } from './components/portfolio/PortfolioDashboard'
import { CalendarPage } from './components/calendar/CalendarPage'
import { AdminPanel } from './components/admin/AdminPanel'
import { ProfileModal } from './components/ProfileModal'
import { AdminProvider, useAdmin } from './contexts/AdminContext'
import { useSignalFeed } from './hooks/useSignalFeed'
import { useBacktest } from './hooks/useBacktest'
import { useCalls } from './hooks/useCalls'
import { useWallet } from '@solana/wallet-adapter-react'

type Tab = 'terminal' | 'backtest' | 'portfolio' | 'calendar'

// ── AppCore lives INSIDE AdminProvider, so it can read fakeBalance ────────────
function AppCore() {
  const { fakeBalance } = useAdmin()

  const {
    signals, newSignalId, connected, alertSettings, setAlertSettings, solPrice,
    watchedCAs, addWatchedCA, removeWatchedCA,
  } = useSignalFeed()

  // Pass fakeBalance as capital limit so the bot won't exceed it
  const {
    strategies, positions, stats, botActivity,
    updateStrategy, toggleAutoTrade, updatePositionSize, addStrategy, deleteStrategy, clearPositions,
  } = useBacktest(signals, fakeBalance ?? undefined)

  const { calls, calledCAs, addCall, removeCall, refreshCalls, clearCalls } = useCalls()

  // Keep call prices live — refresh whenever signals update
  useEffect(() => { refreshCalls(signals) }, [signals, refreshCalls])

  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [detailSignal, setDetailSignal] = useState<Signal | null>(null)
  const [tab, setTab] = useState<Tab>('terminal')
  const [showAdmin, setShowAdmin] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const openCount = positions.filter(p => p.status === 'open').length

  function handleEnableAll() {
    strategies.forEach(s => updateStrategy({ ...s, enabled: true }))
  }
  function handleDisableAll() {
    strategies.forEach(s => updateStrategy({ ...s, enabled: false }))
  }
  function handleSetAllPositionSize(sol: number) {
    strategies.forEach(s => updatePositionSize(s.id, sol))
  }

  return (
    <div className="flex flex-col bg-[#080808] text-[#e6e6e6]" style={{ height: '100dvh' }}>
      <Header
        feedConnected={connected}
        solPrice={solPrice}
        botActivity={botActivity}
        openPositions={openCount}
        onAdminOpen={() => setShowAdmin(true)}
        onProfileOpen={() => setShowProfile(true)}
      />

      {/* Desktop tab bar */}
      <div className="hidden md:flex items-center gap-1 px-4 py-2 border-b border-[#1a1a1a] bg-[#080808] shrink-0">
        {([
          { id: 'terminal' as const, label: 'TERMINAL' },
          { id: 'backtest' as const, label: 'BOT' },
          { id: 'portfolio' as const, label: 'PORTFOLIO' },
          { id: 'calendar' as const, label: 'CALENDAR' },
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
                calls={calls}
                calledCAs={calledCAs}
                onCall={addCall}
                onRemoveCall={removeCall}
                onClearCalls={clearCalls}
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
              onUpdateSize={updatePositionSize}
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
              onProfileOpen={() => setShowProfile(true)}
            />
          </div>
        )}

        {tab === 'calendar' && (
          <div className="h-full overflow-hidden">
            <CalendarPage positions={positions} solPrice={solPrice} />
          </div>
        )}
      </div>

      {detailSignal && (
        <TokenDetailModal signal={detailSignal} onClose={() => setDetailSignal(null)} />
      )}

      {showAdmin && (
        <AdminPanel
          strategies={strategies}
          onClose={() => setShowAdmin(false)}
          onEnableAll={handleEnableAll}
          onDisableAll={handleDisableAll}
          onSetAllPositionSize={handleSetAllPositionSize}
          onClearPositions={clearPositions}
        />
      )}

      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />

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
            { id: 'calendar' as const, label: 'CALENDAR', icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
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

// ── WalletKeyBridge: reads wallet, feeds walletKey into AdminProvider ──────────
function WalletKeyBridge() {
  const { publicKey } = useWallet()
  return (
    <AdminProvider walletKey={publicKey?.toBase58()}>
      <AppCore />
    </AdminProvider>
  )
}

export default function App() {
  return <WalletKeyBridge />
}
