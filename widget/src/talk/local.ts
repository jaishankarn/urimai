import type { Expecting, Understanding } from '../types'

/** Minimal understanding used only when the Urimai server cannot be reached. */
const YES = /^(yes|ok|okay|correct|sari|aamaa?|ஆமாம்|ஆம்|சரி)$/i
const NO = /^(no|illa|illai|இல்லை|இல்ல)$/i
const DONE = /^(done|ok|ஆச்சு|முடிந்தது|முடிஞ்சது)$/i

export function localUnderstand(expecting: Expecting, text: string): Understanding {
  const t = text.trim().replace(/[.!?]+$/, '')
  if (expecting === 'done') return { intent: DONE.test(t) || YES.test(t) ? 'done' : 'unclear' }
  if (YES.test(t)) return { intent: 'yes' }
  if (NO.test(t)) return { intent: 'no' }
  return expecting === 'value' && t ? { intent: 'value', value: t } : { intent: 'unclear' }
}

/** "SELVI" -> "S E L V I", for reading a spelling back. */
export const spell = (s: string) => s.replace(/\s+/g, '').split('').join(' ')
