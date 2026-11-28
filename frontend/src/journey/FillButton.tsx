import { useEffect, useState } from 'react'
import { getForms, startHandoff, type Content, type FormSummary, type Lang } from '../api'
import { primary } from './ui'

type Props = { ui: Content['ui']; lang: Lang; schemeId: string; facts: Record<string, string | number> }

/** "Fill the application with Urimai": hands the confirmed answers to the voice form widget in a new tab. */
export default function FillButton({ ui, lang, schemeId, facts }: Props) {
  const [form, setForm] = useState<FormSummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let live = true
    getForms(schemeId)
      .then((forms) => live && setForm(forms[0] ?? null))
      .catch(() => live && setForm(null))
    return () => {
      live = false
    }
  }, [schemeId])

  if (!form) return null

  async function open() {
    setError(false)
    // Opened inside the click so pop-up blockers allow it; pointed at the form once the handoff is ready.
    const tab = window.open('about:blank', '_blank')
    try {
      const url = await startHandoff(form!.form_id, lang, facts)
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch {
      tab?.close()
      setError(true)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button type="button" className={primary} onClick={open} data-form={form.form_id}>
        {ui.fill_button}
      </button>
      <p className="text-base">{ui.fill_note}</p>
      {form.demo && <p className="text-base font-semibold text-red-800">{ui.fill_demo_note}</p>}
      {error && <p className="text-base font-semibold text-red-800" role="alert">{ui.fill_error}</p>}
    </div>
  )
}
