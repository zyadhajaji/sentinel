export const IS_DEMO = import.meta.env.VITE_APP_MODE === 'demo'

/** Storage key prefix — demo builds use isolated keys so they don't pollute real data */
export const STORAGE_PREFIX = IS_DEMO ? 'demo_' : ''

export function storageKey(key: string): string {
  return STORAGE_PREFIX + key
}
