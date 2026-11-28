export type Lang = 'en' | 'ta'
export type Text = { en: string; ta: string }
export type Mode = 'fill' | 'check' | 'attach' | 'user' | 'next' | 'submit'
export type Kind = 'text' | 'name_native' | 'name_latin' | 'digits' | 'mobile' | 'pincode' | 'email' | 'date' | 'choice' | 'address'

export type PlanField = {
  key: string
  find: { selector: string | null; labels: string[] }
  mode: Mode
  kind: Kind | null
  format: string | null
  source: string | null
  value: string | null
  aliases: Record<string, string[]> | null
  page: string
  optional: boolean
  reloads: boolean
  frame: string | null
  label: Text | null
  ask: Text | null
  say: Text | null
  help: Text | null
}

export type Plan = {
  form_id: string
  title: Text
  lang: Lang
  demo: boolean
  carried: boolean
  fingerprint: { labels: string[]; min_match: number }
  pages: string[]
  finish_page: string
  fields: PlanField[]
  lines: Record<Lang, Record<string, string>>
  token: string
  expires_at: string
  voice: { listen: boolean; speak: boolean; understand: boolean; transliterate: boolean }
}

export type Intent = 'yes' | 'no' | 'value' | 'done' | 'repeat' | 'skip' | 'stop' | 'back' | 'help' | 'unclear' | 'site'
export type Expecting = 'confirm' | 'value' | 'done'
export type Understanding = { intent: Intent; value?: string | null; problem?: string | null }

export type Message = { who: 'bot' | 'user'; text: string; tag?: 'filled' | 'yours' | 'checked'; warn?: boolean }

export type State = {
  v: 1
  plan: Plan
  done: Record<string, true>
  values: Record<string, string> // confirmed values for fill fields only, never sensitive
  tentative: Record<string, string> // filled, awaiting a yes (survives a page reload)
  nav: string | null // button the user was asked to press
  order: string[] // keys in the order they were finished, for "go back"
  log: Message[]
  started: boolean
  muted: boolean
  dock: 'right' | 'left'
  minimised: boolean
  startedAt: number
  lastActivity: number
}
