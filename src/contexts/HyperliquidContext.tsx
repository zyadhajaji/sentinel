/**
 * Hyperliquid Context
 *
 * Central state store for everything Hyperliquid:
 *   - EVM wallet connection (via wagmi)
 *   - Account state (balance, positions, orders)
 *   - Trading functions (placeOrder, close, cancel, setLeverage)
 *   - Market data (all markets list)
 *   - Loading / error states
 *
 * Usage:
 *   const hl = useHyperliquid()
 *   await hl.placeOrder({ coin: 'BTC', isBuy: true, size: 0.001 })
 */

import {
  createContext, useContext, useState, useEffect, useCallback,
  useRef, type ReactNode,
} from 'react'
import { useAccount, useWalletClient, useConnect, useDisconnect, useConnectors } from 'wagmi'
import {
  getMarkets, getPositions, getParsedOpenOrders, getAllMids,
  placeOrder as hlPlaceOrder,
  closePosition as hlClosePosition,
  cancelOrders as hlCancelOrders,
  updateLeverage as hlUpdateLeverage,
} from '../lib/hyperliquid'
import type {
  HLMarketRow, HLPositionRow, HLOrderRow,
  PlaceOrderParams,
} from '../lib/hyperliquid'
import { IS_DEMO } from '../lib/appMode'
import { DEMO_DEFAULT_BALANCE_USD } from '../lib/hyperliquid/constants'

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────

export interface HyperliquidContextValue {
  // ── Wallet state
  isConnected: boolean
  address: string | null
  chainId: number | undefined
  /** Registered wallet connectors (MetaMask, Coinbase, WalletConnect, Safe) */
  walletConnectors: readonly { id: string; name: string; icon?: string }[]
  /** Connect using a specific connector by index (default: 0 = MetaMask/injected) */
  connectWallet: (connectorIndex?: number) => Promise<void>
  disconnectWallet: () => void

  // ── Account state
  accountValue: number      // total account value in USD
  availableBalance: number  // withdrawable USDC
  totalPnl: number          // sum of unrealized PnL across positions

  // ── Live data
  markets:   HLMarketRow[]
  positions: HLPositionRow[]
  orders:    HLOrderRow[]
  allMids:   Record<string, number>  // coin → mid price (numeric)

  // ── Loading / error
  isLoadingAccount: boolean
  isLoadingMarkets: boolean
  lastError: string | null

  // ── Trading functions
  placeOrder:     (params: PlaceOrderParams) => Promise<void>
  closePosition:  (coin: string, size: number, isLong: boolean) => Promise<void>
  cancelOrder:    (coin: string, oid: number) => Promise<void>
  setLeverage:    (coin: string, leverage: number, isCross?: boolean) => Promise<void>

  // ── Refresh
  refreshAccount: () => Promise<void>
  refreshMarkets: () => Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Context + hook
// ─────────────────────────────────────────────────────────────────────────────

const HyperliquidContext = createContext<HyperliquidContextValue | null>(null)

export function useHyperliquid(): HyperliquidContextValue {
  const ctx = useContext(HyperliquidContext)
  if (!ctx) throw new Error('useHyperliquid must be inside <HyperliquidProvider>')
  return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

interface Props { children: ReactNode }

export function HyperliquidProvider({ children }: Props) {
  const { address, isConnected, chainId } = useAccount()
  const { data: walletClient }            = useWalletClient()
  const { connectAsync }                  = useConnect()
  const { disconnect }                    = useDisconnect()
  const configConnectors                  = useConnectors()

  // ── State ─────────────────────────────────────────────────────────────────
  const [markets,            setMarkets]            = useState<HLMarketRow[]>([])
  const [positions,          setPositions]          = useState<HLPositionRow[]>([])
  const [orders,             setOrders]             = useState<HLOrderRow[]>([])
  const [allMids,            setAllMids]            = useState<Record<string, number>>({})
  // Demo mode seeds realistic starting values so the UI looks alive without a wallet
  const [accountValue,       setAccountValue]       = useState(IS_DEMO ? DEMO_DEFAULT_BALANCE_USD : 0)
  const [availableBalance,   setAvailableBalance]   = useState(IS_DEMO ? DEMO_DEFAULT_BALANCE_USD : 0)
  const [isLoadingAccount,   setIsLoadingAccount]   = useState(false)
  const [isLoadingMarkets,   setIsLoadingMarkets]   = useState(false)
  const [lastError,          setLastError]          = useState<string | null>(null)

  const addressRef = useRef(address)
  addressRef.current = address

  // ── Market refresh (every 15s regardless of wallet) ───────────────────────
  const refreshMarkets = useCallback(async () => {
    setIsLoadingMarkets(true)
    try {
      const [rows, midsData] = await Promise.all([getMarkets(), getAllMids()])
      setMarkets(rows)
      const numericMids: Record<string, number> = {}
      for (const [coin, px] of Object.entries(midsData.mids)) {
        numericMids[coin] = parseFloat(px)
      }
      setAllMids(numericMids)
      setLastError(null)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Market fetch failed')
    } finally {
      setIsLoadingMarkets(false)
    }
  }, [])

  // ── Account refresh (positions + orders) ──────────────────────────────────
  const refreshAccount = useCallback(async () => {
    const addr = addressRef.current
    if (!addr) return
    setIsLoadingAccount(true)
    try {
      const midsData = await getAllMids()
      const [rows, parsedOrders, state] = await Promise.all([
        getPositions(addr, midsData.mids),
        getParsedOpenOrders(addr),
        import('../lib/hyperliquid/client').then(m => m.getUserState(addr)),
      ])
      setPositions(rows)
      setOrders(parsedOrders)
      setAccountValue(parseFloat(state.marginSummary.accountValue))
      setAvailableBalance(parseFloat(state.withdrawable))
      setLastError(null)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Account fetch failed')
    } finally {
      setIsLoadingAccount(false)
    }
  }, [])

  // ── Auto-refresh on mount and on interval ─────────────────────────────────
  useEffect(() => {
    refreshMarkets()
    const id = setInterval(refreshMarkets, 15_000)
    return () => clearInterval(id)
  }, [refreshMarkets])

  useEffect(() => {
    if (!address) {
      setPositions([])
      setOrders([])
      setAccountValue(0)
      setAvailableBalance(0)
      return
    }
    refreshAccount()
    const id = setInterval(refreshAccount, 5_000)
    return () => clearInterval(id)
  }, [address, refreshAccount])

  // ── Derived: total PnL ────────────────────────────────────────────────────
  const totalPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)

  // ── Trading actions ───────────────────────────────────────────────────────
  const placeOrder = useCallback(async (params: PlaceOrderParams) => {
    if (!walletClient) throw new Error('Wallet not connected')
    setLastError(null)
    try {
      await hlPlaceOrder(walletClient, params)
      // Refresh after a short delay (chain settlement)
      setTimeout(refreshAccount, 1_500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Order failed'
      setLastError(msg)
      throw e
    }
  }, [walletClient, refreshAccount])

  const closePosition = useCallback(async (coin: string, size: number, isLong: boolean) => {
    if (!walletClient) throw new Error('Wallet not connected')
    setLastError(null)
    try {
      await hlClosePosition(walletClient, coin, size, isLong)
      setTimeout(refreshAccount, 1_500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Close failed'
      setLastError(msg)
      throw e
    }
  }, [walletClient, refreshAccount])

  const cancelOrder = useCallback(async (coin: string, oid: number) => {
    if (!walletClient) throw new Error('Wallet not connected')
    setLastError(null)
    try {
      await hlCancelOrders(walletClient, [{ coin, oid }])
      setTimeout(refreshAccount, 1_000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Cancel failed'
      setLastError(msg)
      throw e
    }
  }, [walletClient, refreshAccount])

  const setLeverage = useCallback(async (coin: string, leverage: number, isCross = true) => {
    if (!walletClient) throw new Error('Wallet not connected')
    setLastError(null)
    try {
      await hlUpdateLeverage(walletClient, coin, leverage, isCross)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Leverage update failed'
      setLastError(msg)
      throw e
    }
  }, [walletClient])

  // ── Wallet actions ────────────────────────────────────────────────────────
  const connectWallet = useCallback(async (connectorIndex = 0) => {
    const connector = configConnectors[connectorIndex]
    if (!connector) throw new Error('No wallet connector available')
    await connectAsync({ connector })
  }, [connectAsync, configConnectors])

  const disconnectWallet = useCallback(() => {
    disconnect()
  }, [disconnect])

  // ─────────────────────────────────────────────────────────────────────────
  const value: HyperliquidContextValue = {
    isConnected,
    address:           address ?? null,
    chainId,
    walletConnectors:  configConnectors,
    connectWallet,
    disconnectWallet,
    accountValue,
    availableBalance,
    totalPnl,
    markets,
    positions,
    orders,
    allMids,
    isLoadingAccount,
    isLoadingMarkets,
    lastError,
    placeOrder,
    closePosition,
    cancelOrder,
    setLeverage,
    refreshAccount,
    refreshMarkets,
  }

  return (
    <HyperliquidContext.Provider value={value}>
      {children}
    </HyperliquidContext.Provider>
  )
}
