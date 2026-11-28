import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Content, Lang } from '../api'
import { hush, record, transcribe } from '../voice'
import Icon from './icons'
import { field } from './ui'

type Props = {
  ui: Content['ui']
  /** The screen text in the other language, shown beside the main button's words. */
  otherUi: Content['ui']
  lang: Lang
  busy: boolean
  /** What the person said or typed. `spoken` is false for typing. */
  onSaid: (text: string, spoken: boolean) => void
}

/** Tap to speak, tap to stop. Typing always works too. Give it a new key for each step. */
export default function Mic({ ui, otherUi, lang, busy, onSaid }: Props) {
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
          if (text) onSaid(text, true)
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
    onSaid(typed.trim(), false)
    setTyped('')
  }

  const working = busy || state === 'hearing' || state === 'starting'
  const key = state === 'recording' ? 'mic_stop' : working ? 'thinking' : 'mic_start'

  return (
    <div className="flex w-full flex-col gap-2">
      <p role="status" className="text-center font-semibold text-danger empty:hidden">
        {state === 'recording' ? ui.listening : ''}
      </p>
      {problem && (
        <p role="alert" className="text-center text-danger">
          {problem}
        </p>
      )}
      <button
        type="button"
        onClick={tap}
        disabled={working}
        aria-label={ui[key]}
        aria-pressed={state === 'recording'}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-fill-edge bg-fill px-4 py-2 font-semibold text-on-fill shadow-soft hover:brightness-110 disabled:border-line disabled:bg-line disabled:text-muted aria-pressed:animate-pulse aria-pressed:border-red-700 aria-pressed:bg-red-700 aria-pressed:text-white"
      >
        <Icon name={state === 'recording' ? 'stop' : 'mic'} />
        <span>
          {ui[key]} · {otherUi[key]}
        </span>
      </button>
      <form onSubmit={send} className="flex w-full gap-2">
        <input
          aria-label={ui.type_instead}
          placeholder={ui.type_instead}
          value={typed}
          maxLength={1000}
          onChange={(event) => setTyped(event.target.value)}
          className={`${field} min-w-0 flex-1`}
        />
        <button
          type="submit"
          aria-label={ui.send}
          title={ui.send}
          disabled={!typed.trim() || working || state === 'recording'}
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-edge bg-surface text-brand disabled:opacity-50"
        >
          <Icon name="send" />
        </button>
      </form>
    </div>
  )
}
