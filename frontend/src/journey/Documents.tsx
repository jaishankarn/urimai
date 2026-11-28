import { useState } from 'react'
import type { Content, Lang, Result } from '../api'
import { card, link, primary, secondary, title } from './ui'

type Props = { ui: Content['ui']; lang: Lang; result: Result; onBack: () => void }

/** One document at a time. Choices stay in memory and are not saved. */
export default function Documents({ ui, lang, result, onBack }: Props) {
  const [index, setIndex] = useState(0)
  const [missing, setMissing] = useState<string[]>([])
  const { items, note, confirmed } = result.documents
  const item = items[index]

  function choose(has: boolean) {
    setMissing((list) => (has ? list.filter((id) => id !== item.id) : [...list.filter((id) => id !== item.id), item.id]))
    setIndex(index + 1)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <button type="button" className={`${link} self-start`} onClick={onBack}>
        ← {ui.back_to_results}
      </button>
      <h2 className={title}>
        {ui.documents_title}: {result.name[lang]}
      </h2>
      {note && <p className="rounded-lg border border-amber-600 p-3 text-base">{note[lang]}</p>}

      {!confirmed && <p className={`${card} text-xl`}>{ui.not_confirmed}</p>}

      {confirmed && item && (
        <div className={card}>
          <p className="text-base text-stone-700">
            {ui.document_of.replace('{n}', String(index + 1)).replace('{total}', String(items.length))}
          </p>
          <p className="my-3 text-2xl font-semibold">{item.text[lang]}</p>
          {item.how && (
            <p className="mb-3 text-lg">
              <strong>{ui.how_to_get}:</strong> {item.how[lang]}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <button type="button" className={primary} onClick={() => choose(true)}>
              {ui.have}
            </button>
            <button type="button" className={secondary} onClick={() => choose(false)}>
              {ui.dont_have}
            </button>
          </div>
        </div>
      )}

      {confirmed && !item && (
        <div className={card}>
          {missing.length === 0 ? (
            <p className="text-xl">{ui.have_all}</p>
          ) : (
            <>
              <h3 className="text-xl font-bold">{ui.still_need}</h3>
              <ul className="list-disc pl-5 text-lg">
                {items
                  .filter((entry) => missing.includes(entry.id))
                  .map((entry) => (
                    <li key={entry.id}>
                      {entry.text[lang]}
                      {entry.how && <span className="block text-base">{entry.how[lang]}</span>}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
