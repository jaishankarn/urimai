import { useState } from 'react'
import type { Content, Lang, Result } from '../api'
import { say, type Suggestions } from '../voice'
import Icon from './icons'
import { Checks, Conflicts, Sources } from './Results'
import { secondary } from './ui'

type Props = {
  ui: Content['ui']
  lang: Lang
  found: Suggestions
  /** The full results, for each suggestion's checks, conflicts and sources. */
  results: Result[]
  voiceReady: boolean
  onDocuments: (schemeId: string) => void
  onAll: () => void
}

/** Up to three suggestions, in a fixed order, one open at a time. Every word comes from saved lines and reviewed rules. */
export default function Top({ ui, lang, found, results, voiceReady, onDocuments, onAll }: Props) {
  const [open, setOpen] = useState(0)
  return (
    <div className="flex flex-col gap-3 pt-3">
      {found.suggestions.length === 0 && <p>{found.speech[0]}</p>}
      <ol className="flex flex-col gap-3">
        {found.suggestions.map((item, index) => {
          const shown = open === index
          const schemes = results.filter((result) => item.scheme_ids.includes(result.scheme_id))
          return (
            <li key={item.key} className={`animate-arrive rounded-2xl border ${shown ? 'border-edge shadow-soft' : 'border-line'}`} data-suggestion={item.key}>
              <button type="button" aria-expanded={shown} onClick={() => setOpen(shown ? -1 : index)} className="flex w-full items-start gap-3 p-4 text-left">
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg font-bold ${shown ? 'bg-fill text-on-fill' : 'bg-tint text-brand'}`}>
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="font-semibold">{item.title}</span>
                  {item.amounts.map((amount) => (
                    <span key={amount} className="text-lg font-bold">
                      {amount}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 rounded-full bg-tint px-3 font-semibold text-brand">
                    <Icon name="check" className="size-4" /> {ui.outcome_potentially_eligible}
                  </span>
                </span>
                <Icon name="down" className={`size-5 text-muted ${shown ? 'rotate-180' : ''}`} />
              </button>
              {item.note && <p className="px-4 pb-3">{item.note}</p>}
              {shown && (
                <div className="border-t border-line p-4 pt-1">
                  <h4 className="mt-2 font-bold">{ui.reasons}</h4>
                  <ul>
                    {item.reasons.map((reason) => (
                      <li key={reason} className="flex gap-2">
                        <Icon name="check" className="mt-1 size-4 text-brand" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                  {voiceReady && (
                    <button type="button" className={`${secondary} mt-3`} onClick={() => say([item.detail], lang)}>
                      {ui.hear_details}
                    </button>
                  )}
                  {schemes.map((result) => (
                    <div key={result.scheme_id} data-scheme={result.scheme_id}>
                      {schemes.length > 1 && <h4 className="mt-4 font-bold text-brand">{result.name[lang]}</h4>}
                      {!result.reviewed && <p className="mt-2 font-semibold text-danger">{ui.not_reviewed}</p>}
                      <Checks ui={ui} lang={lang} result={result} />
                      <Conflicts ui={ui} lang={lang} result={result} />
                      <Sources ui={ui} result={result} />
                      {result.reviewed && (
                        <button type="button" className={`${secondary} mt-2`} onClick={() => onDocuments(result.scheme_id)}>
                          {ui.documents_button}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {found.others.length > 0 && <p>{ui.say_more.replace('{count}', String(found.others.length))}</p>}
      <button type="button" className={secondary} onClick={onAll}>
        {ui.see_all}
      </button>
      {voiceReady && (
        <button type="button" className={secondary} onClick={() => say(found.speech, lang)}>
          {ui.replay}
        </button>
      )}
    </div>
  )
}
