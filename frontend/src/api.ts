export type Lang = 'en' | 'ta'
export type Text = { en: string; ta: string }

export type Question = {
  id: string
  type: 'choice' | 'number' | 'select'
  text: string
  options: { value: string; label: string }[] | null
  show_if: Record<string, string[]> | null
  min: number | null
  max: number | null
}
export type Content = { ui: Record<string, string>; questions: Question[] }

export type Outcome = 'potentially_eligible' | 'needs_more_information' | 'appears_ineligible'
export type Source = { id: string; title: string; url: string; source_date: string | null; checked_on: string }
export type Note = { id: string; text: Text; source: string | null }
export type Documents = { confirmed: boolean; note: Text | null; items: { id: string; text: Text; how: Text | null }[] }
export type Result = {
  scheme_id: string
  name: Text
  outcome: Outcome
  reviewed: boolean
  amounts: Text[]
  conditions: { id: string; text: Text; status: 'met' | 'not_met' | 'unknown' | 'needs_check'; source: string }[]
  checks: Note[]
  conflicts: Note[]
  documents: Documents
  apply: { text: Text; service_code: string | null; charge_rupees: number | null }
  sources: Source[]
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json()
}

export const getContent = (lang: Lang) => json<Content>(`/api/content/${lang}`)

export const getHealth = () => json<{ sarvam_configured: boolean }>('/api/health')

/** Details go in the request body so they never appear in an address or a log. */
export const checkEligibility = (facts: Record<string, string | number>) =>
  json<{ results: Result[] }>('/api/eligibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(facts),
  }).then((body) => body.results)

export type FormSummary = { form_id: string; title: Text; start_url: string; demo: boolean }

export const getForms = (schemeId: string) => json<FormSummary[]>(`/api/forms?scheme_id=${encodeURIComponent(schemeId)}`)

/** Confirmed answers go to the server in the body and come back as a one-time link for the application page. */
export const startHandoff = (formId: string, lang: Lang, facts: Record<string, string | number>) =>
  json<{ url: string }>('/api/handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form_id: formId, lang, facts }),
  }).then((body) => body.url)
