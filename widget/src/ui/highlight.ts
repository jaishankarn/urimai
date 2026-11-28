import { frameOf } from '../dom/locate'

const COLOURS = { now: '#f59e0b', done: '#16a34a', yours: '#2563eb' }
const marked = new Map<HTMLElement, string>()

export function clearHighlights(): void {
  marked.forEach((outline, el) => { el.style.outline = outline; el.style.outlineOffset = '' })
  marked.clear()
}

/** Outline the control and scroll it into view above the panel (inside frames too). */
export function highlight(el: HTMLElement, kind: keyof typeof COLOURS, phone: boolean, afterScroll?: (rect: DOMRect) => void): void {
  clearHighlights()
  marked.set(el, el.style.outline)
  el.style.outline = `4px solid ${COLOURS[kind]}`
  el.style.outlineOffset = '2px'
  const frame = frameOf(el)
  try {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch {
    el.scrollIntoView()
  }
  const target = frame ?? el
  // Keep the field about a third from the top, or just below the top on a phone (the panel is a bottom sheet).
  window.setTimeout(() => {
    const rect = target.getBoundingClientRect()
    const wanted = phone ? 70 : window.innerHeight / 3
    window.scrollBy({ top: rect.top - wanted })
    if (afterScroll) window.setTimeout(() => afterScroll(target.getBoundingClientRect()), 50)
  }, 350)
}
