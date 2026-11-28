import { useState, type FormEvent, type ReactNode } from 'react'
import type { Content, Question } from '../api'
import Chat, { Bot, type Turn } from './Chat'
import Icon from './icons'
import { chip, field, pill, primary } from './ui'

type Props = {
  ui: Content['ui']
  question: Question
  position: number
  total: number
  answer: string | undefined
  onAnswer: (value: string) => void
  onBack: () => void
  onReplay?: () => void
  log: Turn[]
  /** The question in the other language. */
  sub?: string
  subLang: string
  /** The microphone, when the person is talking. */
  mic?: ReactNode
}

/** One question at a time. Render with key={question.id} so typed input resets between questions. */
export default function Questions({ ui, question, position, total, answer, onAnswer, onBack, onReplay, log, sub, subLang, mic }: Props) {
  const [typed, setTyped] = useState(answer && answer !== 'unknown' ? answer : '')
  const [invalid, setInvalid] = useState(false)
  const range = { min: question.min ?? 0, max: question.max ?? 120 }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (question.type === 'select') {
      if (typed) onAnswer(typed)
      return
    }
    const number = Number(typed)
    if (typed.trim() && Number.isInteger(number) && number >= range.min && number <= range.max) onAnswer(String(number))
    else setInvalid(true)
  }

  // A few answers sit with the quick replies. A longer list stays in the conversation, so none of it is hidden.
  const quick = question.type === 'choice' && (question.options?.length ?? 0) <= 4
  const choices = (style: string) =>
    question.options?.map((option) => (
      <button key={option.value} type="button" aria-pressed={answer === option.value} className={style} onClick={() => onAnswer(option.value)}>
        {option.label}
      </button>
    ))

  const replies = (
    <>
      {quick && choices(chip)}
      {question.type !== 'choice' && (
        <form onSubmit={submit} className="flex w-full flex-wrap gap-2" noValidate>
          {question.type === 'select' ? (
            <select aria-labelledby="question" value={typed} onChange={(event) => setTyped(event.target.value)} className={`${field} min-w-0 flex-1`}>
              <option value="">—</option>
              {question.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-labelledby="question"
              aria-invalid={invalid}
              inputMode="numeric"
              placeholder={ui.enter_number}
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value)
                setInvalid(false)
              }}
              className={`${field} min-w-0 flex-1 basis-40`}
            />
          )}
          <button type="submit" className={`${primary} !w-auto`} disabled={!typed}>
            {ui.next}
          </button>
          {question.type === 'number' && (
            <button type="button" className={`${chip} grow`} onClick={() => onAnswer('unknown')}>
              {ui.dont_know}
            </button>
          )}
          {invalid && (
            <p role="alert" className="w-full text-danger">
              {ui.number_invalid.replace('{min}', String(range.min)).replace('{max}', String(range.max))}
            </p>
          )}
        </form>
      )}
      <button type="button" className={chip} onClick={onBack}>
        ← {ui.back}
      </button>
      {onReplay && (
        <button type="button" className={chip} onClick={onReplay}>
          {ui.replay} <Icon name="again" className="inline size-4" />
        </button>
      )}
    </>
  )

  return (
    <Chat log={log} subLang={subLang} at={question.id} replies={replies} mic={mic}>
      {total > 0 && <p className="text-muted">{ui.question_of.replace('{n}', String(position)).replace('{total}', String(total))}</p>}
      <Bot sub={sub} subLang={subLang}>
        <h2 id="question" className="font-semibold">
          {question.text}
        </h2>
      </Bot>
      {question.type === 'choice' && !quick && (
        <div role="group" aria-labelledby="question" className="flex flex-wrap gap-2">
          {choices(pill)}
        </div>
      )}
    </Chat>
  )
}
