const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** All the text a person would read as this control's label, lower case. */
export function labelText(el: Element): string {
  const doc = el.ownerDocument
  const parts: string[] = []
  if (el.id) doc.querySelectorAll(`label[for="${cssEscape(el.id)}"]`).forEach((l) => parts.push(l.textContent ?? ''))
  const wrapping = el.closest('label')
  if (wrapping) parts.push(wrapping.textContent ?? '')
  parts.push(el.getAttribute('aria-label') ?? '', el.getAttribute('placeholder') ?? '', el.getAttribute('name') ?? '')
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) labelledBy.split(/\s+/).forEach((id) => parts.push(doc.getElementById(id)?.textContent ?? ''))
  // Old forms: the label is the first cell of the same table row.
  const row = el.closest('tr')
  if (row) {
    const cell = Array.from(row.children).find((c) => (c.tagName === 'TD' || c.tagName === 'TH') && !c.contains(el))
    if (cell) parts.push(cell.textContent ?? '')
  }
  const group = el.closest('.form-group, .field, .form-row')
  const groupLabel = group?.querySelector('label, .control-label')
  if (groupLabel && !groupLabel.contains(el)) parts.push(groupLabel.textContent ?? '')
  return squash(parts.join(' ')).toLowerCase()
}

export function cssEscape(s: string): string {
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS
  return css?.escape ? css.escape(s) : s.replace(/["\\]/g, '\\$&')
}

const LATIN = /^[\x20-\x7e]+$/

/** Latin hints match on word boundaries ("age" must not match "village"); other scripts as substrings. */
export function hintMatches(text: string, hint: string): boolean {
  const h = hint.toLowerCase().trim()
  if (!h) return false
  if (!LATIN.test(h)) return text.includes(h)
  const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text)
}
