/**
 * Every read and write of a control's value goes through here. Sensitive controls are refused (R1), except an
 * emptiness check for the user's own steps. Nothing here clicks a button or submits a form (R2): the only
 * clicks are on radio inputs and calendar day cells inside the calendar's own container.
 */
import { isSensitive } from './sensitive'

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type Win = Window & typeof globalThis & { jQuery?: any }

export class Refused extends Error {}

const win = (el: Element) => el.ownerDocument.defaultView as Win
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

function guard(el: Element): void {
  if (isSensitive(el)) throw new Refused('sensitive field')
}

function setNative(el: Control, value: string): void {
  const W = win(el)
  const proto = el.tagName === 'TEXTAREA' ? W.HTMLTextAreaElement : el.tagName === 'SELECT' ? W.HTMLSelectElement : W.HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(el, value)
}

function fire(el: Element, ...types: string[]): void {
  types.forEach((t) => el.dispatchEvent(new (win(el).Event)(t, { bubbles: true })))
}

/** Type into a text box so the site's own oninput, onchange, onblur and framework state all notice. */
export function fillText(el: HTMLInputElement | HTMLTextAreaElement, value: string): string | null {
  guard(el)
  if (el.maxLength > 0 && value.length > el.maxLength) return 'too_long'
  try { el.focus() } catch { /* hidden frame */ }
  const focused = el.ownerDocument.activeElement === el
  setNative(el, value)
  fire(el, 'input', 'change')
  // Leave the box once, so the site's blur checks run exactly once.
  if (focused) el.blur()
  else fire(el, 'blur', 'focusout')
  return null
}

export function radioGroup(el: HTMLInputElement): HTMLInputElement[] {
  if (!el.name) return [el]
  return Array.from(el.ownerDocument.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${el.name.replace(/"/g, '\\"')}"]`))
}

function radioLabel(radio: HTMLInputElement): string {
  const label = radio.closest('label') ?? (radio.id ? radio.ownerDocument.querySelector(`label[for="${radio.id}"]`) : null)
  return (label?.textContent ?? radio.value).replace(/\s+/g, ' ').trim()
}

/** The choices a person sees, for quick replies and for matching a spoken answer. */
export function optionsOf(el: Element): string[] {
  if (el instanceof win(el).HTMLSelectElement) {
    return Array.from((el as HTMLSelectElement).options).filter((o) => o.value !== '' && !o.disabled).map((o) => o.text.trim())
  }
  if ((el as HTMLInputElement).type === 'radio') return radioGroup(el as HTMLInputElement).map(radioLabel)
  return []
}

function findOption(el: HTMLSelectElement, wants: string[]): HTMLOptionElement | undefined {
  const options = Array.from(el.options).filter((o) => o.value !== '')
  const w = wants.map(norm).filter(Boolean)
  return options.find((o) => w.some((x) => norm(o.text) === x || norm(o.value) === x)) ??
    options.find((o) => w.some((x) => norm(o.text).startsWith(x + ' ') || norm(o.text).startsWith(x + ' –')))
}

/**
 * Choose an option, waiting up to 5 s for lists that load later. `beforeChange` runs just before the change event,
 * because the page may reload right after it.
 */
export async function chooseOption(el: HTMLSelectElement, wants: string[], beforeChange: () => void, waitMs = 5000): Promise<string | null> {
  guard(el)
  let option = findOption(el, wants)
  for (let t = 0; !option && t < waitMs / 200; t++) {
    await sleep(200)
    option = findOption(el, wants)
  }
  if (!option) return 'not_in_list'
  if (el.value === option.value) return null
  beforeChange()
  setNative(el, option.value)
  fire(el, 'input', 'change') // jQuery and Select2 handlers also receive native events
  return null
}

export function chooseRadio(el: HTMLInputElement, wants: string[]): string | null {
  guard(el)
  const w = wants.map(norm)
  const radio = radioGroup(el).find((r) => w.includes(norm(r.value)) || w.includes(norm(radioLabel(r))))
  if (!radio) return 'not_in_list'
  if (!radio.checked) radio.click()
  return null
}

/** Dates arrive as yyyy-mm-dd. */
export function formatDate(iso: string, format: string | null): string {
  const [y, m, d] = iso.split('-')
  return (format ?? 'dd/mm/yyyy').toLowerCase().replace('dd', d).replace('mm', m).replace('yyyy', y)
}

/** Operate a jQuery UI calendar so the site's own onSelect runs (for example to fill the age). */
async function pickWithDatepicker(el: HTMLInputElement, iso: string): Promise<string | null> {
  const $ = win(el).jQuery
  const [y, m, d] = iso.split('-').map(Number)
  $(el).datepicker('show')
  await sleep(250)
  const dp = el.ownerDocument.getElementById('ui-datepicker-div')
  if (!dp) return 'no_calendar'
  const years = dp.querySelector<HTMLSelectElement>('.ui-datepicker-year')
  if (years) {
    if (!Array.from(years.options).some((o) => o.value === String(y))) { $(el).datepicker('hide'); return 'date_not_available' }
    setNative(years, String(y)); fire(years, 'change'); await sleep(200)
  }
  const months = dp.querySelector<HTMLSelectElement>('.ui-datepicker-month')
  if (months) { setNative(months, String(m - 1)); fire(months, 'change'); await sleep(200) }
  const day = Array.from(dp.querySelectorAll<HTMLAnchorElement>('td[data-handler=selectDay] a')).find((a) => (a.textContent ?? '').trim() === String(d))
  if (!day) { $(el).datepicker('hide'); return 'date_not_available' }
  day.click() // a calendar cell inside the calendar's own container, not a form button
  await sleep(250)
  return null
}

export async function fillDate(el: HTMLInputElement, iso: string, format: string | null): Promise<string | null> {
  guard(el)
  const $ = win(el).jQuery
  if (el.classList.contains('hasDatepicker') && $?.fn?.datepicker) return pickWithDatepicker(el, iso)
  if (el.type === 'date') {
    setNative(el, iso)
    fire(el, 'input', 'change')
    return null
  }
  return fillText(el, formatDate(iso, format))
}

/** What the page now shows for this control, to read back. Refuses sensitive controls. */
export function shown(el: Element): string {
  guard(el)
  const W = win(el)
  if (el instanceof W.HTMLSelectElement) {
    const s = el as HTMLSelectElement
    return s.value === '' ? '' : (s.options[s.selectedIndex]?.text ?? '').trim()
  }
  const input = el as HTMLInputElement
  if (input.type === 'radio') {
    const checked = radioGroup(input).find((r) => r.checked)
    return checked ? radioLabel(checked) : ''
  }
  if (input.type === 'checkbox') return input.checked ? 'checked' : ''
  if (input.type === 'file') return input.files?.length ? String(input.files.length) : ''
  return (input.value ?? '').trim()
}

/** Emptiness only: allowed on the user's own steps, including sensitive ones. The value never leaves here. */
export function isEmpty(el: Element): boolean {
  const input = el as HTMLInputElement
  if (input.type === 'file') return !input.files || input.files.length === 0
  if (input.type === 'checkbox') return !input.checked
  if (input.type === 'radio') return !radioGroup(input).some((r) => r.checked)
  return (input.value ?? '').trim().length === 0
}

/** The element a person sees for this control (Select2 hides the real list). */
export function visual(el: HTMLElement): HTMLElement {
  if (el.classList.contains('select2-hidden-accessible')) {
    const next = el.nextElementSibling as HTMLElement | null
    if (next?.classList.contains('select2')) return next
  }
  if ((el as HTMLInputElement).type === 'radio') return (el.closest('td, fieldset, .form-group, .radio-group') as HTMLElement) ?? el
  return el
}
