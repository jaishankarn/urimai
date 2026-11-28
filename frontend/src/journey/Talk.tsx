import { useEffect, useRef, useState } from 'react'
import type { Content, Lang } from '../api'
import { hush, nextQuestion, say, understand, type Facts } from '../voice'
import { answerLabel, toFacts, visibleQuestions, type Answers } from './answers'
import Mic from './Mic'
import Questions from './Questions'
import { card, link, primary, secondary, title } from './ui'

type Props = {
  content: Content
  lang: Lang
  answers: Answers
  onAnswers: (answers: Answers) => void
  /** Nothing more to ask: the person now checks every answer. */
  onFinished: () => void
  onLeave: () => void
}

type Stage =
  | { name: 'consent' }
  | { name: 'story' }
  | { name: 'check'; said: string; found: Facts }
  | { name: 'question'; id: string }

/** The spoken part of the journey. Code chooses every question; the AI only turns replies into suggestions. */
export default function Talk({ content, lang, answers, onAnswers, onFinished, onLeave }: Props) {
  const { ui, questions } = content
  const [stage, setStage] = useState<Stage>({ name: 'consent' })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [noted, setNoted] = useState<{ said: string; id: string; value: string } | null>(null)
  // Every move to a new step gets a number, so a late reply from an earlier step is ignored.
  const step = useRef(0)

  useEffect(() => () => hush(), [])

  const spoken = (id: string, value: string) => {
    const question = questions.find((q) => q.id === id)!
    return { question: question.text, answer: answerLabel(question, value, ui.dont_know) }
  }

  function go(next: Stage, speech: string[]) {
    step.current++
    setProblem('')
    setBusy(false)
    setStage(next)
    window.scrollTo(0, 0)
    say(speech, lang)
  }

  async function askNext(known: Answers) {
    onAnswers(known)
    const mine = ++step.current
    setBusy(true)
    const visible = visibleQuestions(questions, known)
    const skipped = visible.filter((q) => q.type === 'number' && known[q.id] === 'unknown').map((q) => q.id)
    try {
      const { question_id } = await nextQuestion(toFacts(visible, known), skipped)
      if (mine !== step.current) return
      if (question_id === null) {
        say([ui.say_confirm], lang)
        return onFinished()
      }
      go({ name: 'question', id: question_id }, [questions.find((q) => q.id === question_id)!.text])
    } catch {
      if (mine !== step.current) return
      setBusy(false)
      setProblem(ui.error_check)
    }
  }

  async function hear(said: string, questionId: string | null) {
    const mine = step.current
    setBusy(true)
    setProblem('')
    try {
      const { facts, dont_know } = await understand(lang, said, questionId)
      if (mine !== step.current) return
      setBusy(false)
      if (questionId === null) {
        const lines = Object.entries(facts).map(([id, value]) => spoken(id, String(value)))
        return go(
          { name: 'check', said, found: facts },
          lines.length ? [ui.say_story_confirm, lines.map((l) => `${l.question} ${l.answer}.`).join(' ')] : [ui.understood_none],
        )
      }
      const value = questionId in facts ? String(facts[questionId]) : dont_know ? 'unknown' : undefined
      if (value === undefined) {
        setNoted(null)
        setProblem(ui.not_caught)
        return say([ui.not_caught], lang)
      }
      setNoted({ said, id: questionId, value })
      askNext({ ...answers, [questionId]: value })
    } catch {
      if (mine !== step.current) return
      setBusy(false)
      setProblem(ui.voice_down)
    }
  }

  const back = (
    <button type="button" className={`${link} self-start`} onClick={onLeave}>
      ← {ui.back}
    </button>
  )
  const alert = problem && (
    <p role="alert" className="text-lg text-red-800">
      {problem}
    </p>
  )

  if (stage.name === 'consent') {
    return (
      <div className="flex w-full flex-col gap-4">
        {back}
        <p className={`${card} text-lg`}>{ui.consent}</p>
        <button type="button" className={primary} onClick={() => go({ name: 'story' }, [ui.say_greeting])}>
          {ui.talk_start}
        </button>
      </div>
    )
  }

  if (stage.name === 'story') {
    return (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        {back}
        <h2 className={title}>{ui.say_greeting}</h2>
        <button type="button" className={link} onClick={() => say([ui.say_greeting], lang)}>
          {ui.replay}
        </button>
        <Mic key="story" ui={ui} lang={lang} busy={busy} onSaid={(text) => hear(text, null)} />
        {alert}
        <button type="button" className={link} onClick={() => askNext(answers)}>
          {ui.story_skip}
        </button>
      </div>
    )
  }

  if (stage.name === 'check') {
    const found = Object.entries(stage.found)
    return (
      <div className="flex w-full flex-col gap-4">
        {back}
        <div className={card}>
          <p className="text-base text-stone-700">{ui.you_said}</p>
          <p className="text-xl" data-transcript>
            {stage.said}
          </p>
        </div>
        <h2 className={title}>{found.length ? ui.understood : ui.understood_none}</h2>
        <ul className="flex flex-col gap-2">
          {found.map(([id, value]) => {
            const line = spoken(id, String(value))
            return (
              <li key={id} className={card} data-understood={id}>
                <p className="text-base text-stone-700">{line.question}</p>
                <p className="text-xl font-semibold">{line.answer}</p>
              </li>
            )
          })}
        </ul>
        {found.length > 0 && (
          <button
            type="button"
            className={primary}
            disabled={busy}
            onClick={() => askNext({ ...answers, ...Object.fromEntries(found.map(([id, v]) => [id, String(v)])) })}
          >
            {ui.story_yes}
          </button>
        )}
        <button type="button" className={secondary} disabled={busy} onClick={() => go({ name: 'story' }, [ui.say_greeting])}>
          {ui.story_again}
        </button>
        <button type="button" className={link} disabled={busy} onClick={() => askNext(answers)}>
          {ui.story_skip}
        </button>
        {alert}
      </div>
    )
  }

  const question = questions.find((q) => q.id === stage.id)!
  const visible = visibleQuestions(questions, { ...answers })
  const answer = (value: string) => {
    hush()
    setNoted(null)
    askNext({ ...answers, [question.id]: value })
  }
  return (
    <div className="flex w-full flex-col gap-4">
      {noted && (
        <p className={`${card} text-base`} data-noted>
          {ui.you_said}: “{noted.said}” — {ui.last_answer}: <strong>{spoken(noted.id, noted.value).answer}</strong>
        </p>
      )}
      <Mic key={question.id} ui={ui} lang={lang} busy={busy} onSaid={(text) => hear(text, question.id)} />
      {alert}
      <Questions
        key={`tap-${question.id}`}
        ui={ui}
        question={question}
        position={visible.filter((q) => answers[q.id] !== undefined).length + 1}
        total={0}
        answer={answers[question.id]}
        onAnswer={answer}
        onBack={onLeave}
      />
      <button type="button" className={link} onClick={() => say([question.text], lang)}>
        {ui.replay}
      </button>
    </div>
  )
}
