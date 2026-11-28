import type { Plan, State } from './types'
import { siteKey } from './config'

const KEY = () => `urimai-widget:${siteKey}`
export const SESSION_MS = 60 * 60 * 1000
export const IDLE_MS = 30 * 60 * 1000

/** Tab-only state (sessionStorage). No localStorage, cookies or IndexedDB. */
export function load(now = Date.now()): State | null {
  try {
    const raw = sessionStorage.getItem(KEY())
    if (!raw) return null
    const s = JSON.parse(raw) as State
    if (s.v !== 1 || !s.plan || now - s.startedAt > SESSION_MS || now - s.lastActivity > IDLE_MS) {
      clear()
      return null
    }
    return s
  } catch {
    return null
  }
}

export function fresh(plan: Plan, now = Date.now()): State {
  return { v: 1, plan, done: {}, values: {}, tentative: {}, nav: null, order: [], log: [], started: false,
    muted: false, dock: 'right', minimised: false, startedAt: now, lastActivity: now }
}

export function save(s: State): void {
  s.lastActivity = Date.now()
  s.log = s.log.slice(-100)
  try {
    sessionStorage.setItem(KEY(), JSON.stringify(s))
  } catch {
    /* storage full or blocked: carry on without persistence */
  }
}

export function clear(): void {
  try {
    sessionStorage.removeItem(KEY())
  } catch {
    /* ignore */
  }
}
