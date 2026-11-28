import { labelText } from './labels'

// Same detector as backend/app/contracts/forms.py; keep the two in step. "pin code" is a postal code, not a PIN.
export const SENSITIVE =
  /aadhaa?r|\buid\b|\botp\b|one.?time|captcha|security code|password|passwd|\bpin\b(?!\s*code)|\bcvv\b|(?:^|[^n]\s)card\s*(?:no|number)|(?:credit|debit|atm) card|account (no|number)|\bifsc\b|கடவுச்சொல்|ஆதார்/i

/** R1: a control the widget must never read or fill. */
export function isSensitive(el: Element): boolean {
  const input = el as HTMLInputElement
  if (input.type === 'password') return true
  const auto = (el.getAttribute('autocomplete') ?? '').toLowerCase()
  if (['one-time-code', 'current-password', 'new-password'].includes(auto) || auto.startsWith('cc-')) return true
  return SENSITIVE.test([el.getAttribute('name') ?? '', el.id, labelText(el)].join(' | '))
}
