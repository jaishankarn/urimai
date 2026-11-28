import type { Content, Lang } from '../api'
import { say, type Suggestions } from '../voice'
import { card, secondary, title } from './ui'

type Props = { ui: Content['ui']; lang: Lang; found: Suggestions }

/** Up to three suggestions, in a fixed order. Every word comes from saved lines and reviewed rules. */
export default function Top({ ui, lang, found }: Props) {
  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className={title}>{ui.suggestions_title}</h2>
      <p className="text-lg font-semibold">{found.suggestions.length ? ui.no_guarantee : found.speech[0]}</p>
      <ol className="flex flex-col gap-3">
        {found.suggestions.map((item, index) => (
          <li key={item.key} className={`${card} border-2 border-emerald-800`} data-suggestion={item.key}>
            <h3 className="text-xl font-bold">
              {index + 1}. {item.title}
            </h3>
            <ul className="mt-2 text-lg font-semibold">
              {item.amounts.map((amount) => (
                <li key={amount}>{amount}</li>
              ))}
            </ul>
            {item.note && <p className="mt-2 text-lg">{item.note}</p>}
            <p className="mt-2 text-lg">
              <strong>{ui.reasons}:</strong> {item.reasons.join('; ')}
            </p>
            {item.check && (
              <p className="mt-2 text-lg">
                <strong>{ui.checks}:</strong> {item.check}
              </p>
            )}
            <button type="button" className={`${secondary} mt-3`} onClick={() => say([item.detail], lang)}>
              {ui.hear_details}
            </button>
          </li>
        ))}
      </ol>
      {found.others.length > 0 && <p className="text-lg">{ui.say_more.replace('{count}', String(found.others.length))}</p>}
      <button type="button" className={secondary} onClick={() => say(found.speech, lang)}>
        {ui.replay}
      </button>
    </section>
  )
}
