import { useState, type FormEvent } from 'react'
import type { Content, Question } from '../api'
import { link, primary, secondary, title } from './ui'

type Props = {
  ui: Content['ui']
  question: Question
  position: number
  total: number
  answer: string | undefined
  onAnswer: (value: string) => void
  onBack: () => void
}

/** One question at a time. Render with key={question.id} so typed input resets between questions. */
export default function Questions({ ui, question, position, total, answer, onAnswer, onBack }: Props) {
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

  return (
    <div className="flex w-full flex-col gap-4">
      <button type="button" className={`${link} self-start`} onClick={onBack}>
        ← {ui.back}
      </button>
      {total > 0 && (
        <p className="text-base text-stone-700">
          {ui.question_of.replace('{n}', String(position)).replace('{total}', String(total))}
        </p>
      )}
      <h2 id="question" className={title}>
        {question.text}
      </h2>

      {question.type === 'choice' &&
        question.options?.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={answer === option.value}
            className={`${secondary} aria-pressed:bg-emerald-100`}
            onClick={() => onAnswer(option.value)}
          >
            {option.label}
          </button>
        ))}

      {question.type !== 'choice' && (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          {question.type === 'select' ? (
            <select
              aria-labelledby="question"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="min-h-14 w-full rounded-xl border-2 border-stone-400 bg-white px-3 text-xl"
            >
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
              className="min-h-14 w-full rounded-xl border-2 border-stone-400 bg-white px-3 text-center text-3xl"
            />
          )}
          {invalid && (
            <p role="alert" className="text-lg text-red-800">
              {ui.number_invalid.replace('{min}', String(range.min)).replace('{max}', String(range.max))}
            </p>
          )}
          <button type="submit" className={primary} disabled={!typed}>
            {ui.next}
          </button>
          {question.type === 'number' && (
            <button type="button" className={secondary} onClick={() => onAnswer('unknown')}>
              {ui.dont_know}
            </button>
          )}
        </form>
      )}
    </div>
  )
}
