/**
 * Runs the form on the current page: greet, then for each field (fill/check first, then the user's own steps,
 * then the button) find it, act, verify and confirm. State lives in the tab, so a page reload resumes here.
 */
import * as api from '../api'
import { chooseOption, chooseRadio, fillDate, fillText, formatDate, isEmpty, optionsOf, Refused, shown, sleep, visual } from '../dom/act'
import { alertsSince, emptyRequired, errorTextNear, fieldsWithErrors, pageSummary, referenceNumber, takeInvalid,
  waitForFieldProblem, watchAlerts, watchInvalid, type SiteProblem } from '../dom/errors'
import { hintMatches, labelText } from '../dom/labels'
import { fingerprintMatches, locate } from '../dom/locate'
import * as store from '../state'
import { localUnderstand, spell } from '../talk/local'
import { Mic } from '../talk/mic'
import { Speaker } from '../talk/speaker'
import type { Expecting, Lang, Message, PlanField, State, Text, Understanding } from '../types'
import { clearHighlights, highlight } from '../ui/highlight'
import type { Button, Panel, Reply } from '../ui/panel'

const RANK: Record<string, number> = { fill: 0, check: 0, attach: 0, user: 1, next: 2, submit: 2 }
const SILENCE_MS = 20_000
const ATTEMPTS = 5

/** Thrown to leave the current field and pick the next one (after "go back", "skip" or a stop). */
class Jump extends Error {}
class Stopped extends Error {}

const path = (p: string) => p.replace(/\/+$/, '') || '/'
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

export class Runner {
  private waiting: ((r: Reply) => void) | null = null
  private prompt: () => string = () => ''
  private mic = new Mic()
  private speaker: Speaker
  private voiceListen: boolean
  private lastUtterance = ''
  private silenceTimer = 0
  private stopped = false
  private problems: { list: SiteProblem[]; summary: string } | null = null
  /** What the widget is waiting for (field key and phase); read by the test driver and useful for debugging. */
  current: { key: string; phase: 'start' | 'value' | 'confirm' | 'done' | 'nav' } | null = null

  constructor(public s: State, private panel: Panel, private onStop: () => void) {
    this.speaker = new Speaker(() => this.s.plan.voice.speak && !this.s.muted, (code) => this.voiceTrouble(code))
    this.voiceListen = this.s.plan.voice.listen && Mic.supported()
    api.setToken(s.plan.token)
    this.refreshChrome()
    watchAlerts()
    watchInvalid()
  }

  // ---- language ----
  get lang(): Lang { return this.s.plan.lang }
  L(key: string, vars: Record<string, string> = {}): string {
    const text = this.s.plan.lines[this.lang][key] ?? this.s.plan.lines.en[key] ?? key
    return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
  }
  t(text: Text | null): string { return text ? text[this.lang] : '' }
  problem(key: string | null | undefined, vars: Record<string, string> = {}): string {
    const name = `problem_${key ?? 'not_understood'}`
    return this.L(name in this.s.plan.lines.en ? name : 'problem_not_understood', vars)
  }
  label(f: PlanField): string { return this.t(f.label) || this.t(f.say) || f.key }

  refreshChrome(): void {
    const lines = this.s.plan.lines[this.lang]
    this.panel.labels(lines, this.s.plan.demo, this.s.muted)
    this.panel.dock(this.s.dock)
    this.panel.mic(this.voiceListen ? 'idle' : 'hidden', lines.mic)
    const countable = this.s.plan.fields
    const done = countable.filter((f) => this.s.done[f.key]).length
    this.panel.progress(this.L('progress', { done: String(done), total: String(countable.length) }), done / countable.length)
  }

  // ---- talking ----
  say(text: string, extra: Partial<Message> = {}, speak = true): void {
    const m: Message = { who: 'bot', text, ...extra }
    this.s.log.push(m)
    store.save(this.s)
    this.panel.add(m, m.tag ? this.L(`tag_${m.tag}`) : '')
    if (speak) void this.speaker.say(text, this.lang)
  }
  private ask(prompt: () => string, extra: Partial<Message> = {}): void {
    this.prompt = prompt
    this.say(prompt(), extra)
  }
  private userSaid(text: string): void {
    const m: Message = { who: 'user', text }
    this.s.log.push(m)
    store.save(this.s)
    this.panel.add(m)
  }
  private voiceTrouble(code: string): void {
    if (code === 'key_not_set' || code === 'voice_paused' || code === 'voice_failed') {
      if (this.s.plan.voice.speak || this.voiceListen) this.say(this.L('voice_failed'), { warn: true }, false)
      this.s.plan.voice = { listen: false, speak: false, understand: false, transliterate: false }
      this.voiceListen = false
      this.refreshChrome()
    } else if (code === 'session_expired') this.expire()
  }

  // ---- input from the panel ----
  receive(r: Reply): void {
    if (this.stopped) return
    this.speaker.stop() // barge-in
    const resolve = this.waiting
    if (!resolve) return
    this.waiting = null
    clearTimeout(this.silenceTimer)
    resolve(r)
  }

  async toggleMic(): Promise<void> {
    if (!this.voiceListen) return
    if (this.mic.recording) { this.mic.stop(); return }
    this.speaker.stop()
    try {
      await this.mic.start((audio) => {
        this.panel.mic('idle', this.L('mic'))
        this.receive({ kind: 'audio', audio })
      })
      this.panel.mic('rec', this.L('mic_stop'))
      this.say(this.L('listening'), {}, false)
    } catch {
      this.say(this.L('voice_failed'), { warn: true }, false) // permission denied or no microphone
      this.voiceListen = false
      this.refreshChrome()
    }
  }

  /** Counts questions asked; the test driver waits for it to move on. */
  turns = 0

  private next(buttons: Button[]): Promise<Reply> {
    this.turns++
    this.panel.buttons(buttons)
    this.panel.focusInput()
    return new Promise((resolve) => {
      this.waiting = resolve
      let nudged = false
      const nudge = () => {
        if (this.waiting !== resolve || this.mic.recording) return
        if (!nudged) {
          nudged = true
          this.say(this.L('silence', { ask: this.prompt() }))
        }
      }
      this.silenceTimer = window.setTimeout(nudge, SILENCE_MS)
    })
  }

  private fieldInfo(f: PlanField, options: string[]): api.FieldInfo {
    return { key: f.key, kind: f.kind, label: this.label(f), options, aliases: f.aliases }
  }

  /** One reply from the user, understood. Commands that apply anywhere are handled here. */
  private async reply(expecting: Expecting, f: PlanField, buttons: Button[], options: string[] = []): Promise<Understanding> {
    for (;;) {
      const r = await this.next(buttons)
      let u: Understanding
      if (r.kind === 'site') return { intent: 'site' }
      if (r.kind === 'intent') {
        this.userSaid(r.label)
        u = { intent: r.intent, value: r.value ?? null }
      } else {
        let text = r.kind === 'text' ? r.text : ''
        this.panel.busy(true)
        try {
          if (r.kind === 'audio') {
            this.say(this.L('thinking'), {}, false)
            const mode = f.kind === 'name_latin' ? 'translit' : f.kind === 'name_native' ? 'transcribe' : 'codemix'
            text = await api.listen(r.audio, this.lang, mode)
          }
          this.userSaid(text)
          this.lastUtterance = text
          u = await api.understand(this.fieldInfo(f, options), expecting, text, this.lang)
        } catch (e) {
          const code = e instanceof api.ApiError ? e.code : 'error'
          this.panel.busy(false)
          if (code === 'session_expired') { this.expire(); throw new Stopped() }
          if (r.kind === 'audio') {
            this.say(this.L(code === 'unclear' ? 'not_understood' : code === 'offline' || code === 'network' ? 'offline' : 'voice_failed'), { warn: true })
            if (code !== 'unclear') this.voiceTrouble('voice_failed')
            continue
          }
          if (code === 'offline' || code === 'network') this.say(this.L('offline'), { warn: true }, false)
          this.lastUtterance = text
          u = localUnderstand(expecting, text)
        }
        this.panel.busy(false)
      }
      const handled = await this.common(u, f)
      if (!handled) return u
    }
  }

  /** repeat, help, stop, back, skip. Returns true when the same question should be asked again. */
  private async common(u: Understanding, f: PlanField): Promise<boolean> {
    switch (u.intent) {
      case 'repeat':
        this.say(this.prompt())
        return true
      case 'help':
        this.say(this.t(f.help) || this.L('no_help'))
        return true
      case 'stop':
        await this.confirmStop()
        return true
      case 'back':
        this.goBack(f)
        throw new Jump()
      case 'skip':
        if (f.optional) {
          this.say(this.L('skipped', { label: this.label(f) }))
          this.markDone(f)
          throw new Jump()
        }
        this.say(this.L('cannot_skip', { label: this.label(f) }))
        return true
    }
    return false
  }

  async confirmStop(): Promise<void> {
    this.say(this.L('stop_confirm'))
    const r = await this.next([this.btn('yes', 'yes', true), this.btn('no', 'no')])
    if (r.kind === 'intent' ? r.intent === 'yes' : localUnderstand('confirm', r.kind === 'text' ? r.text : '').intent === 'yes') {
      this.stop()
      throw new Stopped()
    }
    this.say(this.prompt())
  }

  stop(message = 'stopped'): void {
    this.stopped = true
    this.waiting = null
    this.speaker.stop()
    this.mic.stop()
    clearHighlights()
    this.panel.buttons([])
    this.say(this.L(message), {}, false)
    api.end()
    store.clear()
    this.onStop()
  }

  private expire(): void {
    if (!this.stopped) this.stop('session_expired')
  }

  private goBack(f: PlanField): void {
    const previous = this.s.order.filter((k) => k !== f.key).pop()
    const target = this.s.plan.fields.find((x) => x.key === previous && path(x.page) === path(location.pathname))
    if (!target) { this.say(this.L('nothing_before')); return }
    this.s.order = this.s.order.filter((k) => k !== target.key)
    delete this.s.done[target.key]
    delete this.s.values[target.key]
    delete this.s.tentative[target.key]
    store.save(this.s)
    this.say(this.L('back_to', { label: this.label(target) }))
  }

  private btn(key: string, intent: 'yes' | 'no' | 'done' | 'repeat' | 'skip' | 'back' | 'help', primary = false): Button {
    return { label: this.L(key), reply: { kind: 'intent', intent, label: this.L(key) }, primary }
  }

  private markDone(f: PlanField, value?: string): void {
    this.s.done[f.key] = true
    delete this.s.tentative[f.key]
    if (value !== undefined && f.mode === 'fill') this.s.values[f.key] = value
    this.s.order = [...this.s.order.filter((k) => k !== f.key), f.key]
    store.save(this.s)
    this.refreshChrome()
  }

  /** Highlight a control; if the panel covers it, move the panel to the other side. */
  private mark(el: HTMLElement, kind: 'now' | 'done' | 'yours'): void {
    highlight(el, kind, innerWidth <= 640, (rect) => {
      if (innerWidth > 640 && this.panel.covers(rect)) this.toggleDock()
    })
  }

  // ---- pages ----
  private onThisPage(f: PlanField): boolean {
    return path(f.page) === path(location.pathname)
  }

  private nextField(): PlanField | undefined {
    return this.s.plan.fields
      .filter((f) => !this.s.done[f.key] && this.onThisPage(f))
      .sort((a, b) => RANK[a.mode] - RANK[b.mode])[0]
  }

  /** After a reload or a new page: re-check earlier fields and collect whatever the site now says is wrong. */
  recover(): void {
    if (this.s.nav) {
      const f = this.s.plan.fields.find((x) => x.key === this.s.nav)
      if (!f || !this.onThisPage(f) || !locate(f)) {
        if (f) this.markDone(f)
      }
      this.s.nav = null
    }
    const list = fieldsWithErrors()
    const summary = pageSummary()
    if (list.length || summary) this.problems = { list, summary }
    for (const f of this.s.plan.fields) {
      if (!this.s.done[f.key] || !this.onThisPage(f) || f.mode === 'next' || f.mode === 'submit') continue
      const el = locate(f)
      if (!el || list.some((p) => p.el && this.fieldFor(p.el) === f)) continue
      if (f.mode === 'user' && isEmpty(el)) {
        delete this.s.done[f.key]
        this.say(this.L('redo_field', { label: this.label(f) }), { warn: true })
      } else if (f.mode === 'fill' && this.s.values[f.key] !== undefined && !this.matches(f, el, this.s.values[f.key])) {
        delete this.s.done[f.key] // the page lost it (for example after a reload): refilled without asking again
      }
    }
    store.save(this.s)
    this.refreshChrome()
  }

  /** The form-map field a control on the page belongs to, if any. */
  private fieldFor(el: HTMLElement): PlanField | undefined {
    return this.s.plan.fields.find((f) => {
      if (!this.onThisPage(f) || f.mode === 'next' || f.mode === 'submit') return false
      const found = locate(f)
      if (!found) return false
      if (found === el) return true
      const a = found as HTMLInputElement
      const b = el as HTMLInputElement
      return a.type === 'radio' && b.type === 'radio' && a.name === b.name && a.ownerDocument === b.ownerDocument
    })
  }

  private reopen(f: PlanField, message: string): void {
    delete this.s.done[f.key]
    delete this.s.values[f.key]
    delete this.s.tentative[f.key]
    this.s.order = this.s.order.filter((k) => k !== f.key)
    store.save(this.s)
    this.refreshChrome()
    this.say(`${this.L('redo_field', { label: this.label(f) })} ${this.L('site_error', { message })}`, { warn: true })
  }

  /**
   * Tell the person what the site says and put it right. We cannot know every check a site makes, so:
   * a message beside a field we filled re-opens that field; a message beside a field we do not know becomes the
   * person's step; a message we cannot place is read out and the person chooses what to change.
   */
  private async handleProblems(found: { list: SiteProblem[]; summary: string }): Promise<void> {
    if (found.summary) this.say(this.L('page_errors', { message: found.summary }), { warn: true })
    let placed = false
    for (const p of found.list) {
      const f = p.el ? this.fieldFor(p.el) : undefined
      if (f && f.mode === 'fill') {
        this.reopen(f, p.message)
        placed = true
      } else if (f) {
        delete this.s.done[f.key]
        this.say(`${this.L('redo_field', { label: this.label(f) })} ${this.L('site_error', { message: p.message })}`, { warn: true })
        placed = true
      } else if (p.el) {
        await this.extraStep(p.el, p.message)
        placed = true
      }
    }
    if (placed || !found.summary) return
    // Only a message for the whole page: find the field it names, or ask.
    const named = this.s.plan.fields.filter((f) => f.mode === 'fill' && this.s.done[f.key] && this.onThisPage(f) &&
      [...f.find.labels, f.label?.en ?? '', f.label?.ta ?? ''].some((h) => h && hintMatches(found.summary.toLowerCase(), h.toLowerCase())))
    if (named.length === 1) return this.reopen(named[0], found.summary)
    await this.askWhich(found.summary)
  }

  private async askWhich(message: string): Promise<void> {
    const filled = this.s.plan.fields.filter((f) => f.mode === 'fill' && this.s.done[f.key] && this.onThisPage(f))
    if (!filled.length) return
    const myself = this.L('fix_myself')
    const labels = filled.map((f) => this.label(f))
    const choice: PlanField = { ...filled[0], key: 'which', kind: 'choice', aliases: null, label: { en: 'detail', ta: 'விவரம்' }, help: null, optional: false }
    this.ask(() => this.L('which_field'))
    this.current = { key: 'which', phase: 'value' }
    const buttons: Button[] = [...labels, myself].map((l) => ({ label: l, reply: { kind: 'intent', intent: 'value', value: l, label: l } }))
    for (;;) {
      const u = await this.reply('value', choice, buttons, [...labels, myself])
      if (u.intent === 'value' && u.value === myself) {
        this.say(this.L('wait_done'))
        await this.waitDone(choice, null)
        return
      }
      const f = filled[labels.indexOf(u.value ?? '')]
      if (f) return this.reopen(f, message)
      this.say(this.problem(u.problem, { options: '' }))
    }
  }

  /** A box the form map does not know about: the person fills it, the widget waits and checks it is not empty. */
  private async extraStep(el: HTMLElement, message: string): Promise<void> {
    const name = labelText(el).replace(/[*:]/g, '').trim().slice(0, 60) || this.L('this_box')
    const f: PlanField = { key: 'extra', find: { selector: null, labels: [] }, mode: 'user', kind: null, format: null, source: null,
      value: null, aliases: null, page: location.pathname, optional: false, reloads: false, frame: null,
      label: { en: name, ta: name }, ask: null, say: null, help: null }
    this.mark(el, 'yours')
    this.current = { key: `extra:${el.id || el.getAttribute('name') || name}`, phase: 'done' }
    this.ask(() => `${message ? this.L('site_error', { message }) + ' ' : ''}${this.L('extra_field', { label: name })}`, { tag: 'yours', warn: true })
    for (;;) {
      const u = await this.reply('done', f, [this.btn('done', 'done', true), this.btn('repeat', 'repeat')])
      if (u.intent !== 'done' && u.intent !== 'yes') { this.say(this.L('wait_done')); continue }
      // Still empty though required, or still refused by the browser's own check.
      const c = el as HTMLInputElement
      const required = c.required || el.getAttribute('aria-required') === 'true'
      if (el.isConnected && ((required && isEmpty(el)) || (c.validity && !c.validity.valid))) {
        this.say(this.L('still_empty'), { warn: true })
        continue
      }
      return
    }
  }

  private matches(f: PlanField, el: HTMLElement, value: string): boolean {
    const now = shown(el)
    if (el.tagName === 'SELECT') return norm(now) === norm(value) || norm((el as HTMLSelectElement).value) === norm(value)
    if (f.kind === 'date') return now === formatDate(value, f.format) || (el as HTMLInputElement).value === value
    return norm(now) === norm(this.formatted(f, value))
  }

  private formatted(f: PlanField, value: string): string {
    if (f.format === 'upper') return value.toUpperCase()
    if (f.format === 'lower') return value.toLowerCase()
    return value
  }

  // ---- the run ----
  async run(): Promise<void> {
    try {
      if (path(location.pathname) === path(this.s.plan.finish_page)) return this.finish()
      if (!this.s.started) await this.greet()
      const start = path(this.s.plan.pages[0])
      const known = this.s.plan.pages.some((p) => path(p) === path(location.pathname))
      if (!known || (path(location.pathname) === start &&
          fingerprintMatches(this.s.plan.fingerprint.labels) < this.s.plan.fingerprint.min_match)) {
        return await this.guide()
      }
      if (this.problems) {
        const found = this.problems
        this.problems = null
        await this.handleProblems(found)
      }
      for (;;) {
        const f = this.nextField()
        if (!f) return
        try {
          await this.field(f)
        } catch (e) {
          if (!(e instanceof Jump)) throw e
        }
      }
    } catch (e) {
      if (!(e instanceof Stopped)) throw e
    }
  }

  private async greet(): Promise<void> {
    this.say(this.L(this.s.plan.carried ? 'greet_carried' : 'greet'), {}, false)
    if (!this.voiceListen) this.say(this.L('voice_off'), { warn: true }, false)
    else this.say(this.L('voice_ready'), {}, false)
    this.prompt = () => this.L(this.s.plan.carried ? 'greet_carried' : 'greet')
    this.current = { key: 'start', phase: 'start' }
    // The first tap also lets the browser play speech.
    await this.next([{ label: this.L('start'), reply: { kind: 'intent', intent: 'yes', label: this.L('start') }, primary: true }])
    this.s.started = true
    store.save(this.s)
  }

  private async field(f: PlanField): Promise<void> {
    const el = locate(f)
    if (f.mode === 'user') return this.userStep(f, el)
    if (f.mode === 'next' || f.mode === 'submit') return this.button(f, el)
    if (!el) {
      this.say(this.L('not_found', { label: this.label(f) }), { warn: true })
      return this.waitDone(f, null)
    }
    if (f.mode === 'check') return this.check(f, el)
    return this.fill(f, el)
  }

  private async fill(f: PlanField, el: HTMLElement): Promise<void> {
    let confirmedBefore = this.s.values[f.key] !== undefined && !this.s.tentative[f.key]
    let value: string | null = this.s.tentative[f.key] ?? this.s.values[f.key] ?? f.value
    if (value === null && f.source?.startsWith('field.')) value = await this.derive(f)
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      this.mark(visual(el), 'now')
      if (value === null) value = await this.askValue(f, el)
      const before = errorTextNear(el)
      const since = Date.now()
      let problem: string | null
      try {
        problem = await this.act(f, el, value)
      } catch (e) {
        if (e instanceof Refused) return this.userStep(f, el)
        throw e
      }
      if (problem) {
        this.say(problem === 'not_in_list'
          ? this.L('not_in_list', { value, label: this.label(f), options: optionsOf(el).slice(0, 12).join(', ') })
          : this.problem(problem), { warn: true })
        value = null
        confirmedBefore = false
        continue
      }
      // Whatever the site says about this value, in any of the usual ways (we do not know its rules in advance).
      const error = await waitForFieldProblem(el, before, since, f.reloads ? 300 : 800)
      if (error) {
        this.say(this.L('site_error', { message: error }), { warn: true })
        value = null
        confirmedBefore = false
        continue
      }
      const display = f.kind === 'date' ? formatDate(value, 'dd/mm/yyyy') : shown(el) || value
      if (confirmedBefore) {
        this.say(this.L('refilled', { label: this.label(f), value: display }), { tag: 'filled' })
        this.markDone(f, value)
        return
      }
      const yes = await this.confirm(f, display)
      if (yes === true) {
        this.say(`✓ ${this.label(f)}: ${display}`, { tag: 'filled' }, false)
        this.mark(visual(el), 'done')
        this.markDone(f, value)
        return
      }
      if (typeof yes === 'string' && norm(this.formatted(f, yes)) === norm(this.formatted(f, value))) {
        // Saying the same value again means it is right.
        this.say(`✓ ${this.label(f)}: ${display}`, { tag: 'filled' }, false)
        this.markDone(f, value)
        return
      }
      delete this.s.tentative[f.key]
      value = yes // a correction, or null to ask
    }
    this.say(this.L('gave_up', { label: this.label(f) }), { warn: true })
    await this.waitDone(f, el)
  }

  /** An English-letters name made from the confirmed native-script name, when transliteration is available. */
  private async derive(f: PlanField): Promise<string | null> {
    const from = this.s.values[f.source!.slice('field.'.length)]
    if (!from || !this.s.plan.voice.transliterate) return null
    try {
      const latin = (await api.transliterate(from)).toUpperCase().replace(/[^A-Z .]/g, '').trim()
      return latin || null
    } catch {
      return null
    }
  }

  private async act(f: PlanField, el: HTMLElement, value: string): Promise<string | null> {
    const keepForReload = () => {
      this.s.tentative[f.key] = value
      store.save(this.s) // the page may reload right after the change event
    }
    let problem: string | null
    if (el.tagName === 'SELECT') {
      const wants = [value, ...(f.aliases?.[value] ?? [])]
      if (!(el as HTMLSelectElement).options.length || optionsOf(el).length === 0) this.say(this.L('loading_list'), {}, false)
      problem = await chooseOption(el as HTMLSelectElement, wants, keepForReload)
      if (!problem && f.reloads) await sleep(1500) // a reload stops this script here; if not, carry on
    } else if ((el as HTMLInputElement).type === 'radio') {
      problem = chooseRadio(el as HTMLInputElement, [value])
    } else if (f.kind === 'date') {
      problem = await fillDate(el as HTMLInputElement, value, f.format)
    } else {
      problem = fillText(el as HTMLInputElement, this.formatted(f, value))
    }
    if (!problem) keepForReload()
    return problem
  }

  /** Read back and get a yes. Returns true, a corrected value, or null to ask again. */
  private async confirm(f: PlanField, display: string): Promise<true | string | null> {
    const line = f.kind === 'name_latin'
      ? () => this.L('spelled_check', { label: this.label(f), value: display, spelled: spell(display) })
      : () => this.L('filled_check', { label: this.label(f), value: display })
    this.ask(line)
    this.current = { key: f.key, phase: 'confirm' }
    for (;;) {
      const u = await this.reply('confirm', f, [this.btn('yes', 'yes', true), this.btn('no', 'no'), this.btn('repeat', 'repeat'),
        ...(f.help ? [this.btn('help', 'help')] : []), ...(this.s.order.length ? [this.btn('back', 'back')] : [])])
      if (u.intent === 'yes' || u.intent === 'done') return true
      if (u.intent === 'no') return u.value ?? null
      if (u.intent === 'value' && u.value) return u.value
      this.say(this.problem(u.problem, { options: '' }))
    }
  }

  private async askValue(f: PlanField, el: HTMLElement): Promise<string> {
    const options = f.kind === 'choice' ? optionsOf(el) : []
    const question = () => this.t(f.ask) || this.L('ask_again', { label: this.label(f) })
    this.ask(question)
    this.current = { key: f.key, phase: 'value' }
    if (options.length) this.say(this.L('choose_option'), {}, false)
    for (;;) {
      const buttons: Button[] = options.slice(0, 40).map((o) => ({ label: o, reply: { kind: 'intent', intent: 'value', value: o, label: o } }))
      buttons.push(this.btn('repeat', 'repeat'))
      if (f.optional) buttons.push(this.btn('skip', 'skip'))
      if (f.help) buttons.push(this.btn('help', 'help'))
      if (this.s.order.length) buttons.push(this.btn('back', 'back'))
      const u = await this.reply('value', f, buttons, options)
      if (u.intent === 'value' && u.value) {
        // A name said in Tamil for a box that needs English letters: convert it when we can, and the person
        // confirms the spelling. Otherwise it is filled as said and the website says if it objects.
        if (f.kind === 'name_latin' && /[^\x00-\x7f]/.test(u.value) && this.s.plan.voice.transliterate) {
          try {
            const latin = (await api.transliterate(u.value)).replace(/[^A-Za-z .]/g, '').trim()
            if (latin) return latin
          } catch { /* fill as said */ }
        }
        return u.value
      }
      this.say(this.problem(u.problem, { options: options.length ? this.L('options_are', { options: options.slice(0, 12).join(', ') }) : '' }), { warn: true })
    }
  }

  private async check(f: PlanField, el: HTMLElement): Promise<void> {
    const now = shown(el)
    this.mark(visual(el), 'now')
    if (!now) {
      this.say(this.L('check_empty', { label: this.label(f) }), { tag: 'checked' })
    } else if (f.value === null || norm(now) === norm(f.value)) {
      this.say(this.L(f.value === null ? 'check_shown' : 'checked_ok', { label: this.label(f), value: now }), { tag: 'checked' })
    } else {
      this.say(this.L('check_mismatch', { label: this.label(f), value: now, expected: f.value }), { warn: true })
      this.ask(() => this.L('is_form_right'))
      this.current = { key: f.key, phase: 'confirm' }
      const u = await this.reply('confirm', f, [this.btn('yes', 'yes', true), this.btn('no', 'no'), this.btn('back', 'back')])
      if (u.intent === 'no') {
        // The site calculates this from an earlier answer: re-open that answer. Nothing is changed silently.
        this.goBack(f)
        return
      }
    }
    this.markDone(f)
  }

  private async userStep(f: PlanField, el: HTMLElement | null): Promise<void> {
    if (el) this.mark(visual(el), 'yours')
    this.ask(() => `${this.L('your_part')} ${this.t(f.say) || this.L('not_found', { label: this.label(f) })}`, { tag: 'yours' })
    await this.waitDone(f, el)
  }

  private async waitDone(f: PlanField, el: HTMLElement | null): Promise<void> {
    if (f.key !== 'extra') this.current = { key: f.key, phase: 'done' }
    for (;;) {
      const u = await this.reply('done', f, [this.btn('done', 'done', true), this.btn('repeat', 'repeat'), this.btn('help', 'help')])
      if (u.intent !== 'done' && u.intent !== 'yes') {
        this.say(this.L('wait_done'))
        continue
      }
      if (el && el.isConnected && isEmpty(el)) {
        this.say(this.L('still_empty'), { warn: true })
        continue
      }
      this.markDone(f)
      return
    }
  }

  private async button(f: PlanField, el: HTMLElement | null): Promise<void> {
    // Required boxes the form map does not know about are still the person's to fill before the button.
    for (const extra of emptyRequired(isEmpty).filter((x) => !this.fieldFor(x))) await this.extraStep(extra, '')
    if (el) this.mark(el, 'yours')
    this.s.nav = f.key
    store.save(this.s)
    this.ask(() => `${this.t(f.say)} ${this.L('press_button')}`, { tag: 'yours' })
    this.current = { key: f.key, phase: 'nav' }
    // The widget never presses it (R2). It waits until the page changes, and watches for the site refusing it.
    const since = Date.now()
    const summaryBefore = pageSummary()
    const errorsBefore = new Set(fieldsWithErrors().map((p) => p.message))
    takeInvalid()
    let found: { list: SiteProblem[]; summary: string } | null = null
    const watch = window.setInterval(() => {
      const invalid = takeInvalid()
      const popups = alertsSince(since)
      const summary = pageSummary()
      const fresh = fieldsWithErrors().filter((p) => !errorsBefore.has(p.message))
      if (invalid.length || popups.length || fresh.length || (summary && summary !== summaryBefore)) {
        found = { list: [...invalid, ...fresh], summary: [summary !== summaryBefore ? summary : '', ...popups].filter(Boolean).join(' ') }
        this.receive({ kind: 'site' })
      }
    }, 700)
    try {
      for (;;) {
        const u = await this.reply('done', f, [this.btn('repeat', 'repeat'), ...(this.s.order.length ? [this.btn('back', 'back')] : [])])
        if (u.intent === 'site' && found) {
          window.clearInterval(watch)
          this.s.nav = null
          store.save(this.s)
          await this.handleProblems(found)
          throw new Jump()
        }
        this.say(this.L('press_button'))
      }
    } finally {
      window.clearInterval(watch)
    }
  }

  private async guide(): Promise<void> {
    this.say(this.L('guidance_mode'), { warn: true })
    for (const f of this.s.plan.fields.filter((x) => this.onThisPage(x) && !this.s.done[x.key])) {
      const el = locate(f)
      if (el) this.mark(visual(el), 'yours')
      if (f.mode === 'next' || f.mode === 'submit') return this.button(f, el)
      this.ask(() => f.mode === 'user' ? this.t(f.say) : this.L('guidance_step', { label: this.label(f) }))
      await this.waitDone(f, null) // guidance fills nothing, so it does not check the page either
    }
  }

  private finish(): void {
    const ref = referenceNumber()
    this.say(this.L('finished'))
    this.say(ref ? this.L('reference', { ref }) : this.L('no_reference'), {}, false)
    this.say(this.L('not_guaranteed'), {}, false)
    this.panel.buttons([])
    this.stopped = true
    api.end()
    store.clear()
  }

  // ---- panel actions ----
  toggleLanguage(): void {
    this.s.plan.lang = this.lang === 'ta' ? 'en' : 'ta'
    store.save(this.s)
    this.refreshChrome()
    if (this.waiting) this.say(this.prompt())
  }
  toggleMute(): void {
    this.s.muted = !this.s.muted
    if (this.s.muted) this.speaker.stop()
    store.save(this.s)
    this.refreshChrome()
  }
  toggleDock(): void {
    this.s.dock = this.s.dock === 'right' ? 'left' : 'right'
    store.save(this.s)
    this.refreshChrome()
  }
  restoreLog(): void {
    this.panel.reset()
    for (const m of this.s.log) this.panel.add(m, m.tag ? this.L(`tag_${m.tag}`) : '')
  }
  get isWaiting(): boolean { return this.waiting !== null }
}
