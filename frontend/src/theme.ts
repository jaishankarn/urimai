import { useState } from 'react'

export const THEMES = ['lavender', 'mint', 'marigold', 'terracotta'] as const
export const MODES = ['auto', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]
export type Mode = (typeof MODES)[number]

/** The only thing the app keeps in the browser: how it looks. No answers or personal details. */
function remembered<T extends string>(key: string, allowed: readonly T[]): T {
  try {
    const value = localStorage.getItem(key) as T
    if (allowed.includes(value)) return value
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  return allowed[0]
}

function apply(key: string, value: string) {
  document.documentElement.dataset[key] = value
}

function remember(key: string, value: string) {
  apply(key, value)
  try {
    localStorage.setItem(`urimai-${key}`, value)
  } catch {
    // The choice still applies until the page is reloaded.
  }
}

const first = { theme: remembered('urimai-theme', THEMES), mode: remembered('urimai-mode', MODES) }
apply('theme', first.theme)
apply('mode', first.mode)

export function useAppearance() {
  const [look, setLook] = useState(first)
  return {
    ...look,
    setTheme(theme: Theme) {
      remember('theme', theme)
      setLook((now) => ({ ...now, theme }))
    },
    setMode(mode: Mode) {
      remember('mode', mode)
      setLook((now) => ({ ...now, mode }))
    },
  }
}
