import type { Lang } from './api'

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json()
}

export type Facts = Record<string, string | number>
export type Suggestion = { key: string; scheme_ids: string[]; title: string; amounts: string[]; reasons: string[]; check: string; note: string | null; detail: string }
export type Suggestions = { suggestions: Suggestion[]; others: { id: string; name: { en: string; ta: string } }[]; speech: string[] }

export const understand = (lang: Lang, text: string, question_id: string | null) =>
  post<{ facts: Facts; dont_know: boolean }>('/api/conversation/understand', { lang, text, question_id })
export const nextQuestion = (facts: Facts, skipped: string[]) =>
  post<{ question_id: string | null }>('/api/conversation/next', { facts, skipped })
export const getSuggestions = (facts: Facts, lang: Lang) => post<Suggestions>('/api/conversation/suggest', { facts, lang })

export async function transcribe(audio: Blob, lang: Lang): Promise<string> {
  const response = await fetch(`/api/voice/stt?lang=${lang}`, { method: 'POST', headers: { 'Content-Type': audio.type }, body: audio })
  if (!response.ok) throw new Error(`speech to text returned ${response.status}`)
  return (await response.json()).text
}

// ---- speaking ----
const player = new Audio()
let turn = 0

/** Stop talking, for example before recording so the microphone does not hear Urimai. */
export function hush() {
  turn++
  player.pause()
}

async function speech(text: string, lang: Lang): Promise<Blob | null> {
  try {
    const response = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, text }),
    })
    return response.ok ? await response.blob() : null
  } catch {
    return null
  }
}

/** Speak saved lines one after another. Silently gives up if voice fails: the same text is on screen. */
export async function say(parts: string[], lang: Lang): Promise<void> {
  hush()
  const mine = turn
  // Ask for every part at once, so there is no long silence between them.
  const prepared = parts.map((text) => speech(text, lang))
  for (const next of prepared) {
    const audio = await next
    if (!audio || mine !== turn) return
    const url = URL.createObjectURL(audio)
    await new Promise<void>((done) => {
      player.onended = player.onerror = player.onpause = () => done()
      player.src = url
      player.play().catch(() => done())
    })
    URL.revokeObjectURL(url)
    if (mine !== turn) return
  }
}

// ---- recording ----
const LONGEST_MS = 28_000 // speech to text accepts at most 30 seconds

/** Starts recording. Call stop() to finish; onDone then receives the audio. cancel() throws it away. */
export async function record(onDone: (audio: Blob) => void): Promise<{ stop: () => void; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  let keep = true
  const stop = () => recorder.state !== 'inactive' && recorder.stop()
  const timer = window.setTimeout(stop, LONGEST_MS)
  recorder.ondataavailable = (event) => chunks.push(event.data)
  recorder.onstop = () => {
    window.clearTimeout(timer)
    stream.getTracks().forEach((track) => track.stop())
    if (keep) onDone(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
  }
  recorder.start()
  return {
    stop,
    cancel: () => {
      keep = false
      stop()
    },
  }
}
