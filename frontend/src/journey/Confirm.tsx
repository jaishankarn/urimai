import type { Content, Question } from '../api'
import { answerLabel, type Answers } from './answers'
import { card, link, primary, title } from './ui'

type Props = {
  ui: Content['ui']
  questions: Question[]
  answers: Answers
  busy: boolean
  failed: boolean
  onEdit: (id: string) => void
  onConfirm: () => void
  onBack: () => void
}

export default function Confirm({ ui, questions, answers, busy, failed, onEdit, onConfirm, onBack }: Props) {
  return (
    <div className="flex w-full flex-col gap-4">
      <button type="button" className={`${link} self-start`} onClick={onBack}>
        ← {ui.back}
      </button>
      <h2 className={title}>{ui.confirm_title}</h2>
      <p className="text-lg">{ui.confirm_help}</p>
      <ul className="flex flex-col gap-2">
        {questions.map((question) => (
          <li key={question.id} className={card}>
            <p className="text-base text-stone-700">{question.text}</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xl font-semibold">{answerLabel(question, answers[question.id], ui.dont_know)}</p>
              <button type="button" className={link} onClick={() => onEdit(question.id)}>
                {ui.edit}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {failed && (
        <p role="alert" className="text-lg text-red-800">
          {ui.error_check}
        </p>
      )}
      <button type="button" className={primary} onClick={onConfirm} disabled={busy}>
        {busy ? ui.checking : failed ? ui.try_again : ui.see_results}
      </button>
    </div>
  )
}
