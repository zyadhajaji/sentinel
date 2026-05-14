import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { loadStorage, saveStorage } from '../lib/storage'
import { IS_DEMO, storageKey } from '../lib/appMode'

export interface AdminProfile {
  username: string
  avatarColor: string
  isUnlocked: boolean
}

interface AdminCtx {
  profile: AdminProfile
  setUsername: (name: string) => void
  setAvatarColor: (color: string) => void
  unlock: () => void
  lock: () => void
  fakeBalance: number | null
  setFakeBalance: (n: number | null) => void
}

const DEFAULT_PROFILE: AdminProfile = {
  username: 'TRADER',
  avatarColor: '#00d4ff',
  isUnlocked: false,
}

const Ctx = createContext<AdminCtx | null>(null)

function profileStorageKey(walletKey?: string): string {
  const base = walletKey ? `sentinel_profile_${walletKey}` : 'sentinel_profile_anon'
  return storageKey(base)
}

function loadProfile(walletKey?: string): AdminProfile {
  return {
    ...DEFAULT_PROFILE,
    ...loadStorage<Partial<AdminProfile>>(profileStorageKey(walletKey), {}),
    isUnlocked: false,
  }
}

interface Props {
  walletKey?: string
  children: ReactNode
}

export function AdminProvider({ walletKey, children }: Props) {
  const [profile, setProfile] = useState<AdminProfile>(() => loadProfile(walletKey))
  const [fakeBalance, setFakeBalanceState] = useState<number | null>(
    IS_DEMO ? 12.5 : null
  )

  // Re-load profile when wallet changes
  useEffect(() => {
    setProfile(loadProfile(walletKey))
  }, [walletKey])

  const saveProfile = useCallback((next: AdminProfile, wKey?: string) => {
    saveStorage(profileStorageKey(wKey), { username: next.username, avatarColor: next.avatarColor })
  }, [])

  const setUsername = useCallback((username: string) => {
    setProfile(p => {
      const next = { ...p, username }
      saveProfile(next, walletKey)
      return next
    })
  }, [walletKey, saveProfile])

  const setAvatarColor = useCallback((avatarColor: string) => {
    setProfile(p => {
      const next = { ...p, avatarColor }
      saveProfile(next, walletKey)
      return next
    })
  }, [walletKey, saveProfile])

  const unlock = useCallback(() => setProfile(p => ({ ...p, isUnlocked: true })), [])
  const lock   = useCallback(() => setProfile(p => ({ ...p, isUnlocked: false })), [])

  const setFakeBalance = useCallback((n: number | null) => {
    setFakeBalanceState(n && n > 0 ? n : null)
  }, [])

  return (
    <Ctx.Provider value={{ profile, setUsername, setAvatarColor, unlock, lock, fakeBalance, setFakeBalance }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider')
  return ctx
}
