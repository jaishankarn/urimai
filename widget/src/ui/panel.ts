/** The widget's interface, inside a shadow root so the site's styles and ours never clash. */
import type { Message } from '../types'

export type Reply =
  | { kind: 'text'; text: string }
  | { kind: 'intent'; intent: 'yes' | 'no' | 'done' | 'repeat' | 'skip' | 'back' | 'help' | 'stop' | 'value'; value?: string; label: string }
  | { kind: 'audio'; audio: Blob }
  | { kind: 'site' } // the website showed a problem while the widget was waiting

export type Button = { label: string; reply: Reply; primary?: boolean }

export type Handlers = {
  reply: (r: Reply) => void
  mic: () => void
  launcher: () => void
  close: () => void
  minimise: () => void
  dock: () => void
  mute: () => void
  language: () => void
}

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans Tamil", "Latha", "Nirmala UI", Roboto, sans-serif; }
.launcher { position: fixed; bottom: 20px; right: 20px; z-index: 2147483646; min-height: 56px; padding: 0 22px; border: 0;
  border-radius: 28px; background: #065f46; color: #fff; font-size: 18px; font-weight: 700; cursor: pointer;
  box-shadow: 0 6px 20px rgba(0,0,0,.3); display: flex; align-items: center; gap: 10px; }
.launcher.left { right: auto; left: 20px; }
.panel { position: fixed; bottom: 16px; right: 16px; z-index: 2147483647; width: 390px; max-height: min(640px, calc(100vh - 32px));
  background: #fffdf7; color: #1c1917; border: 2px solid #065f46; border-radius: 16px; display: flex; flex-direction: column;
  box-shadow: 0 10px 40px rgba(0,0,0,.35); font-size: 17px; line-height: 1.45; }
.panel.left { right: auto; left: 16px; }
.head { display: flex; align-items: center; gap: 4px; padding: 8px 8px 8px 14px; background: #065f46; color: #fff; border-radius: 13px 13px 0 0; }
.title { flex: 1; font-weight: 700; font-size: 16px; }
.icon { min-width: 40px; min-height: 40px; border: 0; background: transparent; color: #fff; font-size: 18px; cursor: pointer; border-radius: 8px; }
.icon:hover, .icon:focus-visible { background: rgba(255,255,255,.18); outline: 2px solid #fff; }
.badge { background: #b91c1c; color: #fff; font-size: 13px; font-weight: 700; padding: 3px 14px; }
.progress { padding: 6px 14px 0; font-size: 14px; color: #44403c; }
.bar { height: 8px; background: #e7e5e4; border-radius: 4px; margin: 4px 14px 0; overflow: hidden; }
.bar > div { height: 100%; background: #16a34a; width: 0; transition: width .3s; }
.log { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; min-height: 140px; }
.msg { padding: 9px 12px; border-radius: 12px; max-width: 92%; white-space: pre-wrap; word-wrap: break-word; }
.bot { background: #ecfdf5; border: 1px solid #a7f3d0; align-self: flex-start; }
.user { background: #1e3a8a; color: #fff; align-self: flex-end; }
.warn { border: 2px solid #f59e0b; background: #fffbeb; }
.tag { display: inline-block; margin-left: 6px; font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 10px; vertical-align: middle; }
.tag.filled { background: #dcfce7; color: #166534; } .tag.yours { background: #dbeafe; color: #1e40af; } .tag.checked { background: #f5f5f4; color: #44403c; }
.quick { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 12px 0; max-height: 34vh; overflow-y: auto; }
.quick button { min-height: 44px; padding: 6px 16px; font-size: 17px; border-radius: 22px; border: 2px solid #065f46; background: #fff; color: #065f46; cursor: pointer; font-weight: 600; }
.quick button.primary { background: #065f46; color: #fff; }
.quick button:focus-visible, .row button:focus-visible, .row input:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
.row { display: flex; gap: 8px; padding: 10px 12px 12px; align-items: center; }
.row input { flex: 1; min-height: 46px; font-size: 17px; padding: 0 12px; border: 2px solid #a8a29e; border-radius: 12px; min-width: 0; }
.send { min-height: 46px; padding: 0 14px; font-size: 16px; border-radius: 12px; border: 0; background: #44403c; color: #fff; cursor: pointer; }
.mic { width: 62px; height: 62px; border-radius: 50%; border: 0; background: #065f46; color: #fff; font-size: 26px; cursor: pointer; flex: none; }
.mic.rec { background: #dc2626; animation: pulse 1.2s infinite; }
.mic[hidden] { display: none; }
.busy { opacity: .6; pointer-events: none; }
@keyframes pulse { 50% { box-shadow: 0 0 0 10px rgba(220,38,38,.25); } }
@media (prefers-reduced-motion: reduce) { .mic.rec { animation: none; } .bar > div { transition: none; } }
@media (max-width: 640px) {
  .panel, .panel.left { left: 0; right: 0; bottom: 0; width: 100%; max-height: 52vh; height: 52vh; border-radius: 16px 16px 0 0; border-width: 2px 0 0; }
  .launcher, .launcher.left { left: 12px; right: 12px; bottom: 12px; justify-content: center; }
}
.hidden { display: none !important; }
`

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

export class Panel {
  private root: ShadowRoot
  private launcherBtn = el('button', 'launcher')
  private panel = el('div', 'panel hidden')
  private titleEl = el('div', 'title')
  private badge = el('div', 'badge hidden')
  private progressText = el('div', 'progress')
  private barFill = el('div')
  private log = el('div', 'log')
  private quick = el('div', 'quick')
  private input = el('input')
  private sendBtn = el('button', 'send')
  private micBtn = el('button', 'mic')
  private icons: Record<string, HTMLButtonElement> = {}
  private host: HTMLElement

  constructor(private h: Handlers) {
    const host = document.createElement('div')
    host.id = 'urimai-widget-host'
    host.style.cssText = 'display:block;width:1px;height:0;margin:0;padding:0;border:0'
    this.host = host
    document.body.appendChild(host)
    this.root = host.attachShadow({ mode: 'open' })
    const style = el('style')
    style.textContent = CSS
    this.launcherBtn.type = 'button'
    this.launcherBtn.addEventListener('click', () => h.launcher())

    const head = el('div', 'head')
    head.appendChild(this.titleEl)
    for (const [name, symbol, handler] of [['language', 'அ/A', h.language], ['mute', '🔊', h.mute], ['dock', '⇆', h.dock],
      ['minimise', '–', h.minimise], ['close', '✕', h.close]] as const) {
      const b = el('button', 'icon', symbol) as HTMLButtonElement
      b.type = 'button'
      b.addEventListener('click', () => handler())
      this.icons[name] = b
      head.appendChild(b)
    }
    const bar = el('div', 'bar')
    bar.appendChild(this.barFill)
    this.log.setAttribute('aria-live', 'polite')
    this.log.setAttribute('role', 'log')
    const row = el('div', 'row')
    this.input.type = 'text'
    this.input.autocomplete = 'off'
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendText() })
    this.sendBtn.type = 'button'
    this.sendBtn.addEventListener('click', () => this.sendText())
    this.micBtn.type = 'button'
    this.micBtn.textContent = '🎤'
    this.micBtn.addEventListener('click', () => h.mic())
    row.append(this.input, this.sendBtn, this.micBtn)
    this.panel.setAttribute('role', 'dialog')
    this.panel.append(head, this.badge, this.progressText, bar, this.log, this.quick, row)
    this.root.append(style, this.launcherBtn, this.panel)
  }

  private sendText(): void {
    const text = this.input.value.trim()
    if (!text) return
    this.input.value = ''
    this.h.reply({ kind: 'text', text })
  }

  labels(lines: Record<string, string>, demo: boolean, muted: boolean): void {
    this.titleEl.textContent = lines.title
    this.badge.textContent = lines.demo_badge
    this.badge.classList.toggle('hidden', !demo)
    this.input.placeholder = lines.type_here
    this.input.setAttribute('aria-label', lines.type_here)
    this.sendBtn.textContent = lines.send
    this.micBtn.setAttribute('aria-label', lines.mic)
    const titles: Record<string, string> = { language: lines.language, mute: muted ? lines.unmute : lines.mute, dock: lines.dock,
      minimise: lines.minimise, close: lines.stop }
    for (const [name, b] of Object.entries(this.icons)) { b.title = titles[name]; b.setAttribute('aria-label', titles[name]) }
    this.icons.mute.textContent = muted ? '🔇' : '🔊'
    this.icons.language.textContent = lines.language
  }

  launcher(text: string, show: boolean): void {
    this.launcherBtn.innerHTML = ''
    this.launcherBtn.append(el('span', '', '🎤'), el('span', '', text))
    this.launcherBtn.classList.toggle('hidden', !show)
  }

  open(show: boolean): void {
    this.panel.classList.toggle('hidden', !show)
    // Extra room at the end of the page, so the last fields and buttons can scroll above the panel.
    this.host.style.height = show ? `${Math.round(this.panel.getBoundingClientRect().height + 24)}px` : '0'
  }

  /** True if the panel covers this rectangle on screen. */
  covers(rect: DOMRect): boolean {
    if (!this.isOpen) return false
    const p = this.panel.getBoundingClientRect()
    return rect.left < p.right && rect.right > p.left && rect.top < p.bottom && rect.bottom > p.top
  }

  get isOpen(): boolean {
    return !this.panel.classList.contains('hidden')
  }

  dock(side: 'left' | 'right'): void {
    this.panel.classList.toggle('left', side === 'left')
    this.launcherBtn.classList.toggle('left', side === 'left')
  }

  add(m: Message, tagText = ''): void {
    const div = el('div', `msg ${m.who}${m.warn ? ' warn' : ''}`, m.text)
    if (m.tag && tagText) div.appendChild(el('span', `tag ${m.tag}`, tagText))
    this.log.appendChild(div)
    this.log.scrollTop = this.log.scrollHeight
  }

  reset(): void {
    this.log.innerHTML = ''
  }

  buttons(list: Button[]): void {
    this.quick.innerHTML = ''
    for (const b of list) {
      const btn = el('button', b.primary ? 'primary' : '', b.label) as HTMLButtonElement
      btn.type = 'button'
      btn.addEventListener('click', () => this.h.reply(b.reply))
      this.quick.appendChild(btn)
    }
  }

  busy(on: boolean): void {
    this.quick.classList.toggle('busy', on)
  }

  progress(text: string, fraction: number): void {
    this.progressText.textContent = text
    this.barFill.style.width = `${Math.round(fraction * 100)}%`
  }

  mic(state: 'hidden' | 'idle' | 'rec', label: string): void {
    this.micBtn.hidden = state === 'hidden'
    this.micBtn.classList.toggle('rec', state === 'rec')
    this.micBtn.textContent = state === 'rec' ? '⏹' : '🎤'
    this.micBtn.setAttribute('aria-label', label)
    this.micBtn.title = label
  }

  focusInput(): void {
    if (this.micBtn.hidden) this.input.focus({ preventScroll: true })
  }
}
