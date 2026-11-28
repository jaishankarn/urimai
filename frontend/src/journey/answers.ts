import type { Question } from '../api'

export type Answers = Record<string, string>

/** A question is shown only when every answer it depends on belongs to a question that is itself shown. */
export function visibleQuestions(questions: Question[], answers: Answers): Question[] {
  const shown = new Set<string>()
  return questions.filter((question) => {
    const visible = Object.entries(question.show_if ?? {}).every(
      ([fact, values]) => shown.has(fact) && values.includes(answers[fact]),
    )
    if (visible) shown.add(question.id)
    return visible
  })
}

/** Only answers to visible questions are sent, so an old hidden answer can never affect a result. */
export function toFacts(visible: Question[], answers: Answers): Record<string, string | number> {
  const facts: Record<string, string | number> = {}
  for (const { id, type } of visible) {
    const answer = answers[id]
    if (answer === undefined) continue
    if (type !== 'number') facts[id] = answer
    else if (answer !== 'unknown') facts[id] = Number(answer)
  }
  return facts
}

export function answerLabel(question: Question, answer: string, dontKnow: string): string {
  if (answer === 'unknown') return dontKnow
  return question.options?.find((option) => option.value === answer)?.label ?? answer
}
