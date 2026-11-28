/**
 * We cannot know every check a website makes. So the widget watches for whatever the site says after a value is
 * filled or a button is pressed, in all the usual ways, and tells the person:
 * - messages beside a field (many class conventions, aria-invalid with aria-describedby / aria-errormessage);
 * - the browser's own checks (pattern, type, min/max, required: `validity` and the `invalid` event);
 * - pop-up alerts the site's scripts show;
 * - an error summary or alert box on the page, including one that appears later (server or AJAX checks).
 */
import { documents } from './locate'

export type SiteProblem = { el: HTMLElement | null; message: string }

const FIELD_ERROR =
  '.err, .error, .errors, .error-message, .errormsg, .error-text, .field-validation-error, .invalid-feedback, ' +
  '.msg-bad, .text-danger, .validation-message, .parsley-errors-list, .help-block.error, .form-error, .input-error, ' +
  'label.error, span[id$="-error"], span[id$="Error"], span[id$="Err"]'
const PAGE_ERROR =
  '.summary, .validation-summary-errors, .alert-danger, .alert-error, .error-summary, .errorSummary, ' +
  '.notification.is-danger, .message.error, #errors, #errorMessage, [role=alert]'
const CONTROLS = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]), select, textarea'

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const isOurs = (el: Element) => !!el.closest('#urimai-widget-host')

function showing(el: Element): boolean {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false
  return (el as HTMLElement).hidden !== true
}

// ---- pop-up alerts ----
type Alerted = { message: string; at: number }
const alerts: Alerted[] = []

/** Record the text of alert() pop-ups the site shows (the pop-up still appears as before). */
export function watchAlerts(): void {
  for (const doc of documents()) {
    const win = doc.defaultView as (Window & { __urimaiAlert?: boolean }) | null
    if (!win || win.__urimaiAlert) continue
    win.__urimaiAlert = true
    const original = win.alert.bind(win)
    win.alert = (message?: unknown) => {
      alerts.push({ message: String(message ?? '').trim().slice(0, 300), at: Date.now() })
      return original(message as string)
    }
  }
}

export const alertsSince = (since: number) => alerts.filter((a) => a.at >= since && a.message).map((a) => a.message)

// ---- the browser's own checks when a form is sent ----
const invalid: SiteProblem[] = []

export function watchInvalid(): void {
  for (const doc of documents()) {
    const marker = doc as Document & { __urimaiInvalid?: boolean }
    if (marker.__urimaiInvalid) continue
    marker.__urimaiInvalid = true
    doc.addEventListener('invalid', (e) => {
      const el = e.target as HTMLInputElement
      if (!isOurs(el)) invalid.push({ el, message: el.validationMessage || 'invalid' })
    }, true)
  }
}

export function takeInvalid(): SiteProblem[] {
  return invalid.splice(0, invalid.length)
}

// ---- messages beside a field ----
export function errorTextNear(el: Element): string {
  const parts: string[] = []
  if (el.getAttribute('aria-invalid') === 'true') {
    for (const attr of ['aria-errormessage', 'aria-describedby']) {
      for (const id of (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) {
        const target = el.ownerDocument.getElementById(id)
        if (target && showing(target) && text(target)) parts.push(text(target))
      }
    }
  }
  const box = el.closest('td, .form-group, .field, li, .form-row, .input-group') ?? el.parentElement
  if (box) {
    box.querySelectorAll(FIELD_ERROR).forEach((e) => {
      if (showing(e) && text(e) && !e.contains(el)) parts.push(text(e))
    })
  }
  return Array.from(new Set(parts)).join(' ').slice(0, 300)
}

function validityMessage(el: HTMLElement): string | null {
  const c = el as HTMLInputElement
  if (!c.validity || c.validity.valid || !c.validationMessage) return null
  if (c.validity.valueMissing) return null // emptiness is the person's business until they press the button
  return c.validationMessage
}

/** A new problem for this control right after filling: beside it, from the browser, or a pop-up. */
export function fieldProblem(el: HTMLElement, before: string, since: number): string | null {
  const W = el.ownerDocument.defaultView as (Window & { jQuery?: any }) | null
  const control = el as HTMLInputElement
  try {
    const $ = W?.jQuery
    if ($ && control.form && $(control.form).data('validator') && !$(el).valid()) {
      return errorTextNear(el) || text(el.ownerDocument.querySelector(`#${control.id}-error, [data-valmsg-for="${control.name}"]`)) || 'invalid'
    }
  } catch { /* no jQuery Validate */ }
  const popup = alertsSince(since)
  if (popup.length) return popup.join(' ')
  const now = errorTextNear(el)
  if (now && now !== before) return now
  return validityMessage(el)
}

/** Wait a little for checks the site runs later (on blur, after a timer, or from its server). */
export async function waitForFieldProblem(el: HTMLElement, before: string, since: number, ms = 1200): Promise<string | null> {
  for (let waited = 0; ; waited += 150) {
    const problem = fieldProblem(el, before, since)
    if (problem || waited >= ms) return problem
    await new Promise((r) => setTimeout(r, 150))
  }
}

// ---- the whole page ----
export function pageSummary(doc: Document = document): string {
  return Array.from(doc.querySelectorAll(PAGE_ERROR))
    .filter((e) => !isOurs(e) && showing(e) && text(e))
    .map(text)
    .filter((t, i, all) => all.indexOf(t) === i)
    .join(' ')
    .slice(0, 400)
}

/** Every control on the page (and frames) that shows an error right now. */
export function fieldsWithErrors(): SiteProblem[] {
  const found: SiteProblem[] = []
  for (const doc of documents()) {
    doc.querySelectorAll<HTMLElement>(CONTROLS).forEach((el) => {
      if (isOurs(el) || !showing(el)) return
      const message = errorTextNear(el)
      if (message) found.push({ el, message })
    })
  }
  // Radio buttons in one group share a message: keep one.
  return found.filter((p, i) => found.findIndex((q) => q.message === p.message && q.el?.closest('td, fieldset') === p.el?.closest('td, fieldset')) === i)
}

/** Required boxes that are still empty: the person must know about them even if the form map does not. */
export function emptyRequired(isEmpty: (el: Element) => boolean): HTMLElement[] {
  const found: HTMLElement[] = []
  for (const doc of documents()) {
    doc.querySelectorAll<HTMLElement>(CONTROLS).forEach((el) => {
      if (isOurs(el) || !showing(el) || (el as HTMLInputElement).disabled) return
      const required = (el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true'
      if (required && isEmpty(el)) found.push(el)
    })
  }
  return found
}

export function referenceNumber(doc: Document = document): string | null {
  const body = text(doc.body)
  const match = body.match(/(?:acknowledg(?:e)?ment|reference|application|receipt|registration)\s*(?:no\.?|number|id)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]{5,})/i)
  return match ? match[1] : null
}
