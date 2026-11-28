import type { Content, Lang, Outcome, Result } from '../api'
import Icon from './icons'
import { card, link, secondary, title, warning } from './ui'

const GROUPS: { outcome: Outcome; style: string }[] = [
  { outcome: 'potentially_eligible', style: 'border-edge bg-tint text-brand' },
  { outcome: 'needs_more_information', style: 'border-warn-line bg-warn-tint text-warn' },
  { outcome: 'appears_ineligible', style: 'border-line bg-line text-ink' },
]

type PartProps = { ui: Content['ui']; lang: Lang; result: Result }
const heading = 'mt-3 font-bold'

export function Checks({ ui, lang, result }: PartProps) {
  if (result.checks.length === 0) return null
  return (
    <>
      <h5 className={heading}>{ui.checks}</h5>
      <ul className="list-disc pl-5">
        {result.checks.map((check) => (
          <li key={check.id}>{check.text[lang]}</li>
        ))}
      </ul>
    </>
  )
}

export function Conflicts({ ui, lang, result }: PartProps) {
  if (result.conflicts.length === 0) return null
  return (
    <div className={`${warning} mt-3`}>
      <h5 className="flex items-start gap-2 font-bold text-warn">
        <Icon name="alert" className="mt-0.5 size-5" /> {ui.conflicts}
      </h5>
      <ul className="list-disc pl-5">
        {result.conflicts.map((conflict) => (
          <li key={conflict.id}>{conflict.text[lang]}</li>
        ))}
      </ul>
    </div>
  )
}

export function Sources({ ui, result }: { ui: Content['ui']; result: Result }) {
  return (
    <details className="mt-3">
      <summary className="min-h-12 content-center font-semibold text-brand">
        {ui.sources} ({result.sources.length})
      </summary>
      <ul className="flex flex-col gap-2">
        {result.sources.map((source) => (
          <li key={source.id} className="break-words">
            <a className="text-brand underline" href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            <br />
            {ui.source_date}: {source.source_date ?? ui.date_unknown} · {ui.checked_on}: {source.checked_on}
          </li>
        ))}
      </ul>
    </details>
  )
}

type CardProps = { ui: Content['ui']; lang: Lang; result: Result; district: string; onDocuments: () => void }

function Card({ ui, lang, result, district, onDocuments }: CardProps) {
  const ineligible = result.outcome === 'appears_ineligible'
  // Amounts, how to apply and documents appear only for a reviewed rule that has not been ruled out.
  const actionable = result.reviewed && !ineligible
  const group = GROUPS.find((g) => g.outcome === result.outcome)!

  return (
    <article className={card} data-scheme={result.scheme_id} data-outcome={result.outcome}>
      <h4 className="font-bold">{result.name[lang]}</h4>
      <p className={`mt-2 inline-block rounded-lg border px-3 py-1 font-semibold ${group.style}`}>
        {ui[`outcome_${result.outcome}`]}
      </p>
      {!result.reviewed && <p className="mt-2 text-base font-semibold text-danger">{ui.not_reviewed}</p>}

      {!ineligible && result.amounts.length > 0 && (
        <>
          <h5 className={heading}>{ui.amounts}</h5>
          <ul className="list-disc pl-5 text-base">
            {result.amounts.map((amount) => (
              <li key={amount.en}>{amount[lang]}</li>
            ))}
          </ul>
        </>
      )}

      {result.conditions.length > 0 && (
        <>
          <h5 className={heading}>{ui.reasons}</h5>
          <ul className="text-base">
            {result.conditions.map((condition) => (
              <li key={condition.id} className="border-b border-line py-1">
                {condition.text[lang]} — <strong>{ui[`status_${condition.status}`]}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      {!ineligible && <Checks ui={ui} lang={lang} result={result} />}
      <Conflicts ui={ui} lang={lang} result={result} />

      {actionable && (
        <>
          <h5 className={heading}>{ui.apply}</h5>
          <p className="text-base">{result.apply.text[lang]}</p>
          {result.apply.service_code && (
            <p className="text-base">
              {ui.service_code}: {result.apply.service_code}
            </p>
          )}
          {result.apply.charge_rupees !== null && (
            <p className="text-base">
              {ui.charge}: ₹{result.apply.charge_rupees}
            </p>
          )}
          {district && (
            <p className="text-base">
              {ui.your_district}: {district}
            </p>
          )}
        </>
      )}

      <Sources ui={ui} result={result} />

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
  /** Back to the top suggestions, when there are any. */
  onBack?: () => void
}

export default function Results({ ui, lang, results, district, onDocuments, onBack }: Props) {
  return (
    <div className="flex w-full flex-col gap-3 pt-3">
      {onBack && (
        <button type="button" className={`${link} self-start`} onClick={onBack}>
          ← {ui.back_to_top}
        </button>
      )}
      {GROUPS.map(({ outcome }) => {
        const found = results.filter((result) => result.outcome === outcome)
        if (found.length === 0) return null
        const label = `${ui[`outcome_${outcome}`]} (${found.length})`
        const cards = found.map((result) => (
          <Card key={result.scheme_id} ui={ui} lang={lang} result={result} district={district} onDocuments={() => onDocuments(result.scheme_id)} />
        ))
        // Benefits that appear not to apply stay closed until asked for.
        return outcome === 'appears_ineligible' ? (
          <details key={outcome}>
            <summary className={`${title} min-h-12 content-center`}>{label}</summary>
            <div className="flex flex-col gap-3">{cards}</div>
          </details>
        ) : (
          <section key={outcome} className="flex flex-col gap-3">
            <h3 className={title}>{label}</h3>
            {cards}
          </section>
        )
      })}
    </div>
  )
}
