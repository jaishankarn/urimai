import type { Content, Lang } from '../api'
import { primary } from './ui'

const LANGUAGES = [
  { code: 'ta', label: 'தமிழ்', ready: true },
  { code: 'hi', label: 'हिन्दी', ready: false },
  { code: 'te', label: 'తెలుగు', ready: false },
  { code: 'en', label: 'English', ready: true },
]

type Props = { lang: Lang; content: Content | null; onLanguage: (lang: Lang) => void; onStart: () => void }

export default function Language({ lang, content, onLanguage, onStart }: Props) {
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <p className="text-lg">{content?.ui.tagline ?? 'Your Voice. Your Rights. Your Benefits.'}</p>
      <div role="group" aria-label="Choose a language" className="grid w-full grid-cols-2 gap-3">
        {LANGUAGES.map(({ code, label, ready }) => (
          <button
            key={code}
            type="button"
            disabled={!ready}
            aria-pressed={lang === code}
            onClick={() => onLanguage(code as Lang)}
            className="min-h-14 rounded-xl border-2 border-emerald-800 bg-white text-xl font-semibold aria-pressed:bg-emerald-800 aria-pressed:text-white disabled:border-stone-300 disabled:bg-stone-100 disabled:text-stone-500"
          >
            <span lang={code}>{label}</span>
            {!ready && <span className="block text-sm font-normal">coming soon</span>}
          </button>
        ))}
      </div>
      {content && (
        <>
          <p className="text-lg">{content.ui.intro}</p>
          <button type="button" className={primary} onClick={onStart}>
            {content.ui.start}
          </button>
          <p className="text-base text-stone-700">{content.ui.voice_not_ready}</p>
          <p className="text-base text-stone-700">{content.ui.memory_note}</p>
        </>
      )}
    </div>
  )
}
