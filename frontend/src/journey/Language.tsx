import type { Content, Lang } from '../api'
import { primary, secondary } from './ui'

const LANGUAGES = [
  { code: 'ta', label: 'தமிழ்', ready: true },
  { code: 'hi', label: 'हिन्दी', ready: false },
  { code: 'te', label: 'తెలుగు', ready: false },
  { code: 'en', label: 'English', ready: true },
]

type Props = {
  lang: Lang
  content: Content | null
  voiceReady: boolean
  onLanguage: (lang: Lang) => void
  onStart: () => void
  onTalk: () => void
}

export default function Language({ lang, content, voiceReady, onLanguage, onStart, onTalk }: Props) {
  return (
    <div className="flex w-full flex-col items-center gap-4 text-center">
      <p className="font-semibold text-brand">{content?.ui.tagline ?? 'Your Voice. Your Rights. Your Benefits.'}</p>
      <div role="group" aria-label="Choose a language" className="grid w-full grid-cols-2 gap-3">
        {LANGUAGES.map(({ code, label, ready }) => (
          <button
            key={code}
            type="button"
            disabled={!ready}
            aria-pressed={lang === code}
            onClick={() => onLanguage(code as Lang)}
            className="min-h-14 rounded-2xl border border-edge bg-surface text-lg font-semibold text-brand aria-pressed:border-fill-edge aria-pressed:bg-fill aria-pressed:text-on-fill disabled:border-line disabled:bg-page disabled:text-muted"
          >
            <span lang={code}>{label}</span>
            {!ready && <span className="block text-base font-normal">coming soon</span>}
          </button>
        ))}
      </div>
      {content && (
        <>
          <p>{content.ui.intro}</p>
          {voiceReady && (
            <button type="button" className={primary} onClick={onTalk}>
              {content.ui.talk_button}
            </button>
          )}
          <button type="button" className={voiceReady ? secondary : primary} onClick={onStart}>
            {voiceReady ? content.ui.tap_button : content.ui.start}
          </button>
          {!voiceReady && <p className="text-base text-muted">{content.ui.no_key_voice}</p>}
          <p className="text-base text-muted">{content.ui.memory_note}</p>
        </>
      )}
    </div>
  )
}
