import type { Content, Lang, Outcome, Result } from '../api'
import { card, link, secondary, title } from './ui'

const GROUPS: { outcome: Outcome; style: string }[] = [
  { outcome: 'potentially_eligible', style: 'border-emerald-700 bg-emerald-100 text-emerald-950' },
  { outcome: 'needs_more_information', style: 'border-amber-600 bg-amber-100 text-amber-950' },
  { outcome: 'appears_ineligible', style: 'border-stone-400 bg-stone-200 text-stone-900' },
]

type CardProps = { ui: Content['ui']; lang: Lang; result: Result; district: string; onDocuments: () => void }

function Card({ ui, lang, result, district, onDocuments }: CardProps) {
  const ineligible = result.outcome === 'appears_ineligible'
  // Amounts, how to apply and documents appear only for a reviewed rule that has not been ruled out.
  const actionable = result.reviewed && !ineligible
  const group = GROUPS.find((g) => g.outcome === result.outcome)!
  const heading = 'mt-3 text-lg font-bold'

  return (
    <article className={card} data-scheme={result.scheme_id} data-outcome={result.outcome}>
      <h4 className="text-xl font-bold">{result.name[lang]}</h4>
      <p className={`mt-2 inline-block rounded-lg border px-3 py-1 text-lg font-semibold ${group.style}`}>
        {ui[`outcome_${result.outcome}`]}
      </p>
      {!result.reviewed && <p className="mt-2 text-lg font-semibold text-red-800">{ui.not_reviewed}</p>}

      {!ineligible && result.amounts.length > 0 && (
        <>
          <h5 className={heading}>{ui.amounts}</h5>
          <ul className="list-disc pl-5 text-lg">
            {result.amounts.map((amount) => (
              <li key={amount.en}>{amount[lang]}</li>
            ))}
          </ul>
        </>
      )}

      {result.conditions.length > 0 && (
        <>
          <h5 className={heading}>{ui.reasons}</h5>
          <ul className="text-lg">
            {result.conditions.map((condition) => (
              <li key={condition.id} className="border-b border-stone-200 py-1">
                {condition.text[lang]} — <strong>{ui[`status_${condition.status}`]}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      {!ineligible && (
        <>
          <h5 className={heading}>{ui.checks}</h5>
          <ul className="list-disc pl-5 text-lg">
            {result.checks.map((check) => (
              <li key={check.id}>{check.text[lang]}</li>
            ))}
          </ul>
        </>
      )}

      {result.conflicts.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-600 p-3">
          <h5 className="text-lg font-bold">{ui.conflicts}</h5>
          <ul className="list-disc pl-5 text-base">
            {result.conflicts.map((conflict) => (
              <li key={conflict.id}>{conflict.text[lang]}</li>
            ))}
          </ul>
        </div>
      )}

      {actionable && (
        <>
          <h5 className={heading}>{ui.apply}</h5>
          <p className="text-lg">{result.apply.text[lang]}</p>
          {result.apply.service_code && (
            <p className="text-lg">
              {ui.service_code}: {result.apply.service_code}
            </p>
          )}
          {result.apply.charge_rupees !== null && (
            <p className="text-lg">
              {ui.charge}: ₹{result.apply.charge_rupees}
            </p>
          )}
          {district && (
            <p className="text-lg">
              {ui.your_district}: {district}
            </p>
          )}
        </>
      )}

      <details className="mt-3">
        <summary className="min-h-12 cursor-pointer text-lg font-semibold">
          {ui.sources} ({result.sources.length})
        </summary>
        <ul className="flex flex-col gap-2">
          {result.sources.map((source) => (
            <li key={source.id} className="text-base break-words">
              <a className="text-emerald-900 underline" href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
              <br />
              {ui.source_date}: {source.source_date ?? ui.date_unknown} · {ui.checked_on}: {source.checked_on}
            </li>
          ))}
        </ul>
      </details>

      {actionable && (
        <button type="button" className={`${secondary} mt-3`} onClick={onDocuments}>
          {ui.documents_button}
        </button>
      )}
    </article>
  )
}

type Props = {
  ui: Content['ui']
  lang: Lang
  results: Result[]
  district: string
  onDocuments: (schemeId: string) => void
  onBack: () => void
  onRestart: () => void
}

export default function Results({ ui, lang, results, district, onDocuments, onBack, onRestart }: Props) {
  return (
    <div className="flex w-full flex-col gap-4">
      <button type="button" className={`${link} self-start`} onClick={onBack}>
        ← {ui.back}
      </button>
      <h2 className={title}>{ui.results_title}</h2>
      <p className="text-lg font-semibold">{ui.no_guarantee}</p>
      <p className="text-base text-stone-700">{ui.amounts_note}</p>
      {GROUPS.map(({ outcome }) => {
        const found = results.filter((result) => result.outcome === outcome)
        if (found.length === 0) return null
        return (
          <section key={outcome} className="flex flex-col gap-3">
            <h3 className="text-xl font-bold">
              {ui[`outcome_${outcome}`]} ({found.length})
            </h3>
            {found.map((result) => (
              <Card
                key={result.scheme_id}
                ui={ui}
                lang={lang}
                result={result}
                district={district}
                onDocuments={() => onDocuments(result.scheme_id)}
              />
            ))}
          </section>
        )
      })}
      <button type="button" className={secondary} onClick={onRestart}>
        {ui.start_again}
      </button>
    </div>
  )
}
