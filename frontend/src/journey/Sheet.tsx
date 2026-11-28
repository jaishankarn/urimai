import type { ReactNode } from 'react'
import type { Content, Question } from '../api'
import { answerLabel, type Answers } from './answers'
import Icon from './icons'

type SheetProps = {
  head: ReactNode
  /** Stays in view above the scrolling part. */
  notice?: ReactNode
  footer?: ReactNode
  /** Changes when a different view is shown, so it starts at the top. */
  view: string
  children: ReactNode
}

/** The right side: one card that holds the person's details, then the suggested schemes. */
export default function Sheet({ head, notice, footer, view, children }: SheetProps) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-2">{head}</div>
      {notice && <div className="border-b border-line bg-page px-5 py-2">{notice}</div>}
      <div key={view} className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5">
        {children}
      </div>
      {footer}
    </div>
  )
}

const HOUSEHOLD = ['property_value', 'adult_relative_at_home', 'bpl_card']
const HUSBAND = ['widowed', 'death_cause', 'death_at_work', 'insurance_deduction']

const sectionOf = (id: string) =>
  id.startsWith('husband_') || HUSBAND.includes(id) ? 'husband' : HOUSEHOLD.includes(id) ? 'household' : 'you'

type DetailsProps = {
  ui: Content['ui']
  /** Only the questions that are visible and answered. */
  questions: Question[]
  answers: Answers
  onEdit: (id: string) => void
}

/** What Urimai has noted so far, in groups. Every detail can be changed. */
export function Details({ ui, questions, answers, onEdit }: DetailsProps) {
  if (questions.length === 0) return <p className="py-10 text-center text-muted">{ui.details_empty}</p>
  return (
    <>
      {(['you', 'husband', 'household'] as const).map((section) => {
        const rows = questions.filter((question) => sectionOf(question.id) === section)
        if (rows.length === 0) return null
        return (
          <section key={section}>
            <h3 className="mt-4 font-bold text-brand">{ui[`section_${section}`]}</h3>
            <ul>
              {rows.map((question) => (
                <li key={question.id} data-detail={question.id} className="flex animate-arrive items-center gap-3 border-b border-line py-1">
                  <div className="grid min-w-0 flex-1 gap-x-3 lg:grid-cols-2">
                    <span className="text-muted">{ui[`label_${question.id}`]}</span>
                    <strong className="font-semibold">{answerLabel(question, answers[question.id], ui.dont_know)}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(question.id)}
                    aria-label={`${ui.edit}: ${ui[`label_${question.id}`]}`}
                    title={ui.edit}
                    className="grid size-12 shrink-0 place-items-center rounded-xl text-muted hover:bg-tint hover:text-brand"
                  >
                    <Icon name="edit" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
