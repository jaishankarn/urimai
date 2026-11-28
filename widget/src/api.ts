import { apiBase } from './config'
import type { Expecting, Kind, Lang, Plan, Understanding } from './types'

export class ApiError extends Error {
  constructor(public code: string, public status = 0) {
    super(code)
  }
}

let token = ''
export const setToken = (t: string) => { token = t }

async function call(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.json !== undefined) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(apiBase + path, { method: 'POST', credentials: 'omit', ...init, headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body })
  } catch {
    throw new ApiError(navigator.onLine === false ? 'offline' : 'network')
  }
  if (!response.ok) {
    let code = 'error'
    try { code = (await response.json()).error ?? code } catch { /* not JSON */ }
    throw new ApiError(code, response.status)
  }
  return response
}

export const startSession = async (siteKey: string, code: string | null, lang: Lang | null): Promise<Plan> =>
  (await call('/api/widget/session', { json: { site_key: siteKey, code, lang } })).json()

export async function listen(audio: Blob, lang: Lang, mode: string): Promise<string> {
  const form = new FormData()
  form.append('audio', audio, 'reply')
  form.append('lang', lang)
  form.append('mode', mode)
  return (await (await call('/api/widget/listen', { body: form })).json()).text
}

export const speak = async (text: string, lang: Lang): Promise<Blob> =>
  (await call('/api/widget/speak', { json: { text, lang } })).blob()

export type FieldInfo = { key: string; kind: Kind | null; label: string; options: string[]; aliases: Record<string, string[]> | null }

export const understand = async (field: FieldInfo, expecting: Expecting, utterance: string, lang: Lang): Promise<Understanding> =>
  (await call('/api/widget/understand', { json: { field, expecting, utterance: utterance.slice(0, 500), lang } })).json()

export const transliterate = async (text: string): Promise<string> =>
  (await (await call('/api/widget/transliterate', { json: { text, lang: 'ta' } })).json()).text

export function end(): void {
  if (!token) return
  call('/api/widget/end', { json: {}, keepalive: true }).catch(() => undefined)
  token = ''
}
