/**
 * Urimai voice form widget. A department adds one line to its form pages:
 *   <script src="https://<urimai-host>/widget/v1/widget.js" data-site-key="<key>" defer></script>
 * It fills only values the user confirms, never touches sensitive fields and never submits (see docs).
 */
import * as api from './api'
import { siteKey } from './config'
import { Runner } from './flow/runner'
import * as store from './state'
import type { Lang } from './types'
import { Panel, type Reply } from './ui/panel'

declare const __URIMAI_TEST__: boolean

const LAUNCHER = 'Fill by voice · குரல் மூலம் நிரப்பு'
let runner: Runner | null = null
let panel: Panel
let starting = false

function codeFromAddress(): string | null {
  const match = location.hash.match(/[#&]urimai=([\w-]{8,64})/)
  if (!match) return null
  // Remove it at once, so it is not bookmarked, shared or reused.
  const rest = location.hash.replace(match[0], '').replace(/^[#&]+/, '')
  history.replaceState(history.state, '', location.pathname + location.search + (rest ? `#${rest}` : ''))
  return match[1]
}

function stopped(): void {
  runner = null
  panel.launcher(LAUNCHER, true)
}

function begin(s: ReturnType<typeof store.fresh>, restored: boolean): void {
  runner = new Runner(s, panel, stopped)
  panel.launcher(LAUNCHER, s.minimised)
  panel.open(!s.minimised)
  if (restored) {
    runner.restoreLog()
    runner.recover()
  }
  store.save(s)
  void runner.run()
}

async function start(code: string | null, lang: Lang | null): Promise<void> {
  if (starting) return
  starting = true
  panel.open(true)
  panel.launcher(LAUNCHER, false)
  try {
    const plan = await api.startSession(siteKey, code, lang)
    begin(store.fresh(plan), false)
  } catch (e) {
    const codeName = e instanceof api.ApiError ? e.code : 'error'
    if (code && codeName === 'code_expired') {
      // Fall back to filling without carried values: the user is asked for everything.
      panel.add({ who: 'bot', text: 'This link has expired or was already used. You can still fill the form by voice.\nஇந்த இணைப்பு காலாவதியானது. குரல் மூலம் நிரப்பலாம்.', warn: true })
      starting = false
      return chooseLanguage()
    }
    panel.add({ who: 'bot', text: codeName === 'offline' || codeName === 'network'
      ? 'Cannot reach the Urimai server. Please try again.\nஉரிமை சேவையகத்தை அடைய முடியவில்லை. மீண்டும் முயலுங்கள்.'
      : 'The voice helper is not available on this page.\nஇந்தப் பக்கத்தில் குரல் உதவி கிடைக்கவில்லை.', warn: true })
    panel.launcher(LAUNCHER, true)
    panel.buttons([])
  } finally {
    starting = false
  }
}

function chooseLanguage(): void {
  panel.open(true)
  panel.launcher(LAUNCHER, false)
  panel.add({ who: 'bot', text: 'மொழியைத் தேர்ந்தெடுங்கள் · Choose a language' })
  panel.buttons([
    { label: 'தமிழ்', reply: { kind: 'intent', intent: 'value', value: 'ta', label: 'தமிழ்' }, primary: true },
    { label: 'English', reply: { kind: 'intent', intent: 'value', value: 'en', label: 'English' } },
  ])
}

function onReply(r: Reply): void {
  if (runner) return runner.receive(r)
  if (r.kind === 'intent' && r.intent === 'value' && (r.value === 'ta' || r.value === 'en')) void start(null, r.value)
}

function boot(): void {
  if (!siteKey || document.getElementById('urimai-widget-host')) return
  panel = new Panel({
    reply: onReply,
    mic: () => void runner?.toggleMic(),
    launcher: () => {
      if (runner) {
        runner.s.minimised = false
        store.save(runner.s)
        panel.open(true)
        panel.launcher(LAUNCHER, false)
      } else chooseLanguage()
    },
    close: () => {
      if (runner?.isWaiting) runner.receive({ kind: 'intent', intent: 'stop', label: '✕' })
      else if (!runner) { panel.open(false); panel.launcher(LAUNCHER, true) }
    },
    minimise: () => {
      panel.open(false)
      panel.launcher(LAUNCHER, true)
      if (runner) { runner.s.minimised = true; store.save(runner.s) }
    },
    dock: () => runner?.toggleDock(),
    mute: () => runner?.toggleMute(),
    language: () => runner?.toggleLanguage(),
  })
  panel.launcher(LAUNCHER, true)
  const code = codeFromAddress()
  const saved = store.load()
  if (code) void start(code, null)
  else if (saved) begin(saved, true)
  // A handoff link opened in a tab already on this page changes only the fragment.
  window.addEventListener('hashchange', () => {
    const next = codeFromAddress()
    if (!next) return
    if (runner) runner.stop()
    panel.reset()
    void start(next, null)
  })

  if (__URIMAI_TEST__) {
    ;(window as unknown as Record<string, unknown>).__urimaiTest = {
      state: () => runner?.s ?? store.load(),
      waiting: () => runner?.isWaiting ?? false,
      current: () => runner?.current ?? null,
      turn: () => runner?.turns ?? 0,
      hear: (text: string) => onReply({ kind: 'text', text }),
      tap: (intent: 'yes' | 'no' | 'done' | 'repeat' | 'skip' | 'back' | 'help' | 'stop', value?: string) =>
        onReply({ kind: 'intent', intent, value, label: value ?? intent }),
    }
  }
}

if (document.readyState === 'complete') boot()
else window.addEventListener('load', boot) // after frames have loaded
