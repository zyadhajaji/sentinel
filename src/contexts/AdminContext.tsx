import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { loadStorage, saveStorage } from '../lib/storage'

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
}

const DEFAULT_PROFILE: AdminProfile = {
  username: 'TRADER',
  avatarColor: '#00d4ff',
  isUnlocked: false,
}

const Ctx = createContext<AdminCtx | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminProfile>(() => ({
    ...DEFAULT_PROFILE,
    ...loadStorage<Partial<AdminProfile>>('sentinel_admin_profile', {}),
    isUnlocked: false, // always start locked
  }))

  const setUsername = useCallback((username: string) => {
    setProfile(p => {
      const next = { ...p, username }
      saveStorage('sentinel_admin_profile', { username: next.username, avatarColor: next.avatarColor })
      return next
    })
  }, [])

  const setAvatarColor = useCallback((avatarColor: string) => {
    setProfile(p => {
      const next = { ...p, avatarColor }
      saveStorage('sentinel_admin_profile', { username: next.username, avatarColor: next.avatarColor })
      return next
    })
  }, [])

  const unlock = useCallback(() => setProfile(p => ({ ...p, isUnlocked: true })), [])
  const lock   = useCallback(() => setProfile(p => ({ ...p, isUnlocked: false })), [])

  return <Ctx.Provider value={{ profile, setUsername, setAvatarColor, unlock, lock }}>{children}</Ctx.Provider>
}

export function useAdmin() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider')
  return ctx
}
