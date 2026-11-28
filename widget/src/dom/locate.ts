import type { PlanField } from '../types'
import { hintMatches, labelText } from './labels'

const CONTROLS = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=reset]), select, textarea'
const ACTIONS = 'button, input[type=submit], input[type=button], input[type=image], a'

/** The page's document plus same-origin frames. Frames from other sites cannot be reached. */
export function documents(root: Document = document): Document[] {
  const found: Document[] = [root]
  root.querySelectorAll('iframe, frame').forEach((frame) => {
    try {
      const doc = (frame as HTMLIFrameElement).contentDocument
      if (doc && doc.body) found.push(...documents(doc))
    } catch {
      /* cross-origin */
    }
  })
  return found
}

function scope(field: PlanField): Document[] {
  if (!field.frame) return documents()
  const frame = document.querySelector<HTMLIFrameElement>(field.frame)
  try {
    return frame?.contentDocument?.body ? [frame.contentDocument] : []
  } catch {
    return []
  }
}

export function frameOf(el: Element): HTMLIFrameElement | null {
  const win = el.ownerDocument.defaultView
  if (!win || win === window) return null
  try {
    return win.frameElement as HTMLIFrameElement | null
  } catch {
    return null
  }
}

function visible(el: Element): boolean {
  if (el.classList.contains('select2-hidden-accessible')) return true
  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  return !style || (style.display !== 'none' && style.visibility !== 'hidden')
}

export function locate(field: PlanField): HTMLElement | null {
  const docs = scope(field)
  const isButton = field.mode === 'next' || field.mode === 'submit'
  if (field.find.selector) {
    for (const doc of docs) {
      const el = doc.querySelector<HTMLElement>(field.find.selector)
      if (el) return el
    }
  }
  if (!field.find.labels.length) return null
  let best: HTMLElement | null = null
  let bestScore = 0
  for (const doc of docs) {
    doc.querySelectorAll<HTMLElement>(isButton ? ACTIONS : CONTROLS).forEach((el) => {
      if (!visible(el)) return
      const text = isButton ? (el.textContent ?? (el as HTMLInputElement).value ?? '').toLowerCase() : labelText(el)
      for (const hint of field.find.labels) {
        if (hint.length > bestScore && hintMatches(text, hint)) {
          best = el
          bestScore = hint.length
        }
      }
    })
  }
  return best
}

/** How many of the form map's fingerprint labels appear on this page. */
export function fingerprintMatches(labels: string[]): number {
  const text = documents()
    .map((d) => Array.from(d.querySelectorAll(CONTROLS)).map(labelText).join(' | '))
    .join(' | ')
  return labels.filter((l) => hintMatches(text, l)).length
}
