import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { loadStorage, saveStorage } from '../lib/storage'

interface WatchlistCtx {
  watchlist: Set<string>
  toggle: (ca: string) => void
}

const Ctx = createContext<WatchlistCtx>({ watchlist: new Set(), toggle: () => {} })

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist] = useState<Set<string>>(
    () => new Set(loadStorage<string[]>('sentinel_watchlist', []))
  )

  const toggle = useCallback((ca: string) => {
    setWatchlist(prev => {
      const next = new Set(prev)
      if (next.has(ca)) next.delete(ca)
      else next.add(ca)
      saveStorage('sentinel_watchlist', [...next])
      return next
    })
  }, [])

  return <Ctx.Provider value={{ watchlist, toggle }}>{children}</Ctx.Provider>
}

export const useWatchlist = () => useContext(Ctx)
