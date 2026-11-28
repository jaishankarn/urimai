import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Content, Lang } from '../api'
import { hush, record, transcribe } from '../voice'
import { secondary } from './ui'

type Props = {
  ui: Content['ui']
  lang: Lang
  busy: boolean
  /** What the person said or typed. */
  onSaid: (text: string) => void
}

/** Tap to speak, tap to stop. Typing always works too. Give it a new key for each step. */
export default function Mic({ ui, lang, busy, onSaid }: Props) {
  const [state, setState] = useState<'idle' | 'starting' | 'recording' | 'hearing'>('idle')
  const [problem, setProblem] = useState('')
  const [typed, setTyped] = useState('')
  const recording = useRef<{ stop: () => void; cancel: () => void } | null>(null)
  const alive = useRef(true)
  // Set before waiting for the microphone, so a second tap cannot start a second, hidden recording.
  const starting = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      recording.current?.cancel()
    }
  }, [])

  async function tap() {
    if (state === 'recording') return recording.current?.stop()
    if (starting.current) return
    starting.current = true
    setState('starting')
    hush()
    setProblem('')
    try {
      const started = await record(async (audio) => {
        if (!alive.current) return // left this step: nothing is sent
        setState('hearing')
        try {
          const text = await transcribe(audio, lang)
          if (!alive.current) return
          if (text) onSaid(text)
          else setProblem(ui.not_caught)
        } catch {
          if (alive.current) setProblem(ui.voice_down)
        } finally {
          if (alive.current) setState('idle')
        }
      })
      if (!alive.current) return started.cancel()
      recording.current = started
      setState('recording')
    } catch {
      setState('idle')
      setProblem(ui.mic_blocked)
    } finally {
      starting.current = false
    }
  }

  function send(event: FormEvent) {
    event.preventDefault()
    if (!typed.trim()) return
    hush()
    onSaid(typed.trim())
    setTyped('')
  }

  const working = busy || state === 'hearing' || state === 'starting'
  const label = state === 'recording' ? ui.mic_stop : working ? ui.thinking : ui.mic_start

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        onClick={tap}
        disabled={working}
        aria-pressed={state === 'recording'}
        className="flex size-40 flex-col items-center justify-center gap-2 rounded-full border-4 border-emerald-900 bg-emerald-800 p-4 text-white disabled:border-stone-400 disabled:bg-stone-300 disabled:text-stone-700 aria-pressed:animate-pulse aria-pressed:border-red-900 aria-pressed:bg-red-700"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-14 fill-none stroke-current stroke-2">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        <span className="text-base font-semibold">{label}</span>
      </button>
      <p role="status" className="min-h-7 text-lg font-medium">
        {state === 'recording' ? ui.listening : ''}
      </p>
      {problem && (
        <p role="alert" className="text-lg text-red-800">
          {problem}
        </p>
      )}
      <form onSubmit={send} className="flex w-full gap-2">
        <input
          aria-label={ui.type_instead}
          placeholder={ui.type_instead}
          value={typed}
          maxLength={1000}
          onChange={(event) => setTyped(event.target.value)}
          className="min-h-14 min-w-0 flex-1 rounded-xl border-2 border-stone-400 bg-white px-3 text-lg"
        />
        <button type="submit" className={`${secondary} w-auto`} disabled={!typed.trim() || working || state === 'recording'}>
          {ui.send}
        </button>
      </form>
    </div>
  )
}
