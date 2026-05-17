export const IS_DEMO = import.meta.env.VITE_APP_MODE === 'demo'

/** Storage key prefix — demo data never pollutes real data */
export const STORAGE_PREFIX = IS_DEMO ? 'demo_' : 'sentinel_'

export function storageKey(key: string): string {
  return STORAGE_PREFIX + key
}

/** App display label shown in header when in demo mode */
export const APP_MODE_LABEL = IS_DEMO ? 'DEMO' : null
