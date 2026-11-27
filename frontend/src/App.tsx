import { useEffect, useState } from 'react'

const LANGUAGES = [
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'en', label: 'English' },
]

/** Asks the backend what is configured and returns a notice to show, if any. */
function useServerNotice() {
  const [notice, setNotice] = useState('')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error(`health check returned ${response.status}`)
        return response.json()
      })
      .then((health) => setNotice(health.sarvam_configured ? '' : 'Sarvam key not set'))
      .catch(() => setNotice('Cannot reach the Urimai server'))
  }, [])

  return notice
}

export default function App() {
  const [language, setLanguage] = useState('en')
  const notice = useServerNotice()

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-8 bg-amber-50 px-4 py-8 text-center text-stone-900">
      <header>
        <h1 className="text-4xl font-bold text-emerald-800">Urimai</h1>
        <p className="mt-2 text-lg">Your Voice. Your Rights. Your Benefits.</p>
      </header>

      <div role="group" aria-label="Choose a language" className="grid w-full grid-cols-2 gap-3">
        {LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={language === code}
            onClick={() => setLanguage(code)}
            className="min-h-14 rounded-xl border-2 border-emerald-800 bg-white text-xl font-semibold aria-pressed:bg-emerald-800 aria-pressed:text-white"
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled
        className="flex size-44 flex-col items-center justify-center gap-2 rounded-full border-4 border-dashed border-stone-400 bg-stone-200 p-4 text-stone-700"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-14 fill-none stroke-current stroke-2">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        <span className="text-base font-semibold">Voice is not working yet</span>
      </button>

      <p role="status" className="text-lg font-medium text-amber-900">
        {notice}
      </p>
    </main>
  )
}
