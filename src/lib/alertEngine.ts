import type { Signal } from '../types'

let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playBeep(freq: number, duration: number, vol: number) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {}
}

export function playSafeAlert() {
  // Two-tone ascending chime
  playBeep(880, 0.12, 0.15)
  setTimeout(() => playBeep(1320, 0.2, 0.12), 100)
}

export function playWatchAlert() {
  playBeep(660, 0.15, 0.08)
}

export function vibrateAlert(grade: 'SAFE' | 'WATCH' | 'RISK') {
  if (!navigator.vibrate) return
  if (grade === 'SAFE') navigator.vibrate([30, 50, 30])
  else if (grade === 'WATCH') navigator.vibrate([20])
}

export interface AlertSettings {
  safeEnabled: boolean
  watchEnabled: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
  minScore: number
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  safeEnabled: true,
  watchEnabled: false,
  soundEnabled: true,
  vibrationEnabled: true,
  minScore: 60,
}

export function triggerAlert(signal: Signal, settings: AlertSettings) {
  const shouldAlert =
    (signal.score_grade === 'SAFE' && settings.safeEnabled) ||
    (signal.score_grade === 'WATCH' && settings.watchEnabled)

  if (!shouldAlert) return
  if (signal.scanner_score < settings.minScore) return

  if (settings.soundEnabled) {
    if (signal.score_grade === 'SAFE') playSafeAlert()
    else playWatchAlert()
  }

  if (settings.vibrationEnabled) {
    vibrateAlert(signal.score_grade)
  }
}
