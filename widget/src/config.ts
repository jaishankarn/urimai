/** Where the widget was loaded from, and the page's site key. */
const script = (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>('script[data-site-key][src*="widget"]')

export const siteKey = script?.dataset.siteKey ?? ''
export const apiBase = script?.src ? new URL(script.src, location.href).origin : location.origin
export const VERSION = '1'
