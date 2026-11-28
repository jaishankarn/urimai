import { useEffect, useRef, useState } from 'react'
import type { Content, Lang } from '../api'
import { hush, nextQuestion, say, understand, type Facts } from '../voice'
import { answerLabel, toFacts, visibleQuestions, type Answers } from './answers'
import Chat, { Bot, type Turn } from './Chat'
import Mic from './Mic'
import Questions from './Questions'
import { card, chip, primary, title } from './ui'

type Props = {
  content: Content
  /** The same text in the other language, for the second line of each bubble. */
  other: Content
  lang: Lang
  answers: Answers
  onAnswers: (answers: Answers) => void
  /** Nothing more to ask: the person now checks every answer. `speech` is said once that screen is shown. */
  onFinished: (speech: string[]) => void
  onLeave: () => void
  /** The conversation so far. The parent keeps it, so it stays on screen after this part ends. */
  log: Turn[]
  onLog: (turns: Turn[]) => void
  /** A detail the person chose to change: ask that question again. */
  change: { id: string } | null
}

type Stage =
  | { name: 'consent' }
  | { name: 'story' }
  | { name: 'check'; said: string; found: Facts }
  | { name: 'question'; id: string }

/** The spoken part of the journey. Code chooses every question; the AI only turns replies into suggestions. */
export default function Talk({ content, other, lang, answers, onAnswers, onFinished, onLeave, log, onLog, change }: Props) {
  const { ui, questions } = content
  const [stage, setStage] = useState<Stage>({ name: 'consent' })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  // Every move to a new step gets a number, so a late reply from an earlier step is ignored.
  const step = useRef(0)
  // Questions already passed, so that Back goes to the previous one.
  const passed = useRef<string[]>([])

  // Leaving the conversation also moves on a step: replies still on their way must not change anything.
  useEffect(
    () => () => {
      step.current++
      hush()
    },
    [],
  )

  const spoken = (id: string, value: string) => {
    const question = questions.find((q) => q.id === id)!
    return { question: question.text, answer: answerLabel(question, value, ui.dont_know) }
  }

  function go(next: Stage, speech: string[]) {
    step.current++
    setProblem('')
    setBusy(false)
    setStage(next)
    say(speech, lang)
  }

  /** `readBack` is said before the next question, so the person hears what was noted. */
  async function askNext(known: Answers, readBack: string[] = []) {
    onAnswers(known)
    const mine = ++step.current
    setBusy(true)
    const visible = visibleQuestions(questions, known)
    const skipped = visible.filter((q) => q.type === 'number' && known[q.id] === 'unknown').map((q) => q.id)
    try {
      const { question_id } = await nextQuestion(toFacts(visible, known), skipped)
      if (mine !== step.current) return
      if (question_id === null) return onFinished([...readBack, ui.say_confirm])
      if (stage.name === 'question') passed.current.push(stage.id)
      go({ name: 'question', id: question_id }, [...readBack, questions.find((q) => q.id === question_id)!.text])
    } catch {
      if (mine !== step.current) return
      setBusy(false)
      setProblem(ui.error_check)
    }
  }

  const otherLang = lang === 'en' ? 'ta' : 'en'
  /** One of Urimai's lines, in both languages. */
  const line = (key: string): Turn => ({ from: 'urimai', text: ui[key], sub: other.ui[key] })
  const asked = (id: string): Turn => ({
    from: 'urimai',
    text: questions.find((q) => q.id === id)!.text,
    sub: other.questions.find((q) => q.id === id)!.text,
  })

  async function hear(said: string, questionId: string | null, aloud: boolean) {
    const mine = step.current
    setBusy(true)
    setProblem('')
    try {
      const { facts, dont_know } = await understand(lang, said, questionId)
      if (mine !== step.current) return
      setBusy(false)
      if (questionId === null) {
        onLog([line('say_greeting'), { from: 'me', text: said, spoken: aloud }])
        const lines = Object.entries(facts).map(([id, value]) => spoken(id, String(value)))
        return go(
          { name: 'check', said, found: facts },
          lines.length ? [ui.say_story_confirm, ...lines.map((l) => `${l.question} ${l.answer}.`)] : [ui.understood_none],
        )
      }
      const value = questionId in facts ? String(facts[questionId]) : dont_know ? 'unknown' : undefined
      if (value === undefined) {
        setProblem(ui.not_caught)
        return say([ui.not_caught], lang)
      }
      const noted = spoken(questionId, value)
      onLog([
        asked(questionId),
        { from: 'me', text: said, spoken: aloud },
        { from: 'urimai', text: `${ui[`label_${questionId}`]}: ${noted.answer}`, badge: ui.last_answer },
      ])
      askNext({ ...answers, [questionId]: value }, [`${ui.last_answer}: ${spoken(questionId, value).answer}.`])
    } catch {
      if (mine !== step.current) return
      setBusy(false)
      setProblem(ui.voice_down)
    }
  }

  // The person tapped "change" on the summary: ask that question here, with the microphone.
  useEffect(() => {
    if (!change) return
    if (stage.name === 'question' && stage.id !== change.id) passed.current.push(stage.id)
    go({ name: 'question', id: change.id }, [questions.find((q) => q.id === change.id)!.text])
  }, [change])

  function previousQuestion() {
    const previous = passed.current.pop()
    go(previous ? { name: 'question', id: previous } : { name: 'story' }, previous ? [questions.find((q) => q.id === previous)!.text] : [])
  }

  const back = (
    <button type="button" className={chip} onClick={stage.name === 'check' ? () => go({ name: 'story' }, []) : onLeave}>
      ← {ui.back}
    </button>
  )
  const alert = problem && (
    <p role="alert" className="w-full text-center text-danger">
      {problem}
    </p>
  )
  // The microphone. A new key for each step throws away a recording from the step before.
  const mic = (key: string, questionId: string | null) => (
    <>
      {alert}
      <Mic key={key} ui={ui} otherUi={other.ui} lang={lang} busy={busy} onSaid={(text, aloud) => hear(text, questionId, aloud)} />
    </>
  )

  if (stage.name === 'consent') {
    return (
      <Chat
        log={log}
        subLang={otherLang}
        at="consent"
        replies={
          <>
            <button
              type="button"
              className={primary}
              onClick={() => {
                onLog([line('consent'), { from: 'me', text: ui.talk_start }])
                go({ name: 'story' }, [ui.say_greeting])
              }}
            >
              {ui.talk_start}
            </button>
            {back}
          </>
        }
      >
        <Bot sub={other.ui.consent} subLang={otherLang}>
          {ui.consent}
        </Bot>
      </Chat>
    )
  }

  if (stage.name === 'story') {
    return (
      <Chat
        log={log}
        subLang={otherLang}
        at="story"
        mic={mic('story', null)}
        replies={
          <>
            {back}
            <button type="button" className={chip} onClick={() => say([ui.say_greeting], lang)}>
              {ui.replay}
            </button>
            <button type="button" className={chip} onClick={() => askNext(answers)}>
              {ui.story_skip}
            </button>
          </>
        }
      >
        <Bot sub={other.ui.say_greeting} subLang={otherLang}>
          <h2 className="font-semibold">{ui.say_greeting}</h2>
        </Bot>
      </Chat>
    )
  }

  if (stage.name === 'check') {
    const found = Object.entries(stage.found)
    const heading = found.length ? 'understood' : 'understood_none'
    return (
      <Chat
        log={log}
        subLang={otherLang}
        at="check"
        replies={
          <>
            {found.length > 0 && (
              <button
                type="button"
                className={primary}
                disabled={busy}
                onClick={() => {
                  onLog([{ from: 'me', text: ui.story_yes }])
                  askNext({ ...answers, ...Object.fromEntries(found.map(([id, v]) => [id, String(v)])) })
                }}
              >
                {ui.story_yes}
              </button>
            )}
            <button type="button" className={chip} disabled={busy} onClick={() => go({ name: 'story' }, [ui.say_greeting])}>
              {ui.story_again}
            </button>
            {alert}
          </>
        }
      >
        <Bot sub={other.ui[heading]} subLang={otherLang}>
          <h2 className={title}>{ui[heading]}</h2>
        </Bot>
        {found.length > 0 && (
          <ul className={`${card} flex flex-col divide-y divide-line !py-1`}>
            {found.map(([id, value]) => {
              const noted = spoken(id, String(value))
              return (
                <li key={id} className="py-2" data-understood={id}>
                  <p className="text-muted">{noted.question}</p>
                  <p className="font-semibold">{noted.answer}</p>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {back}
          <button type="button" className={chip} disabled={busy} onClick={() => askNext(answers)}>
            {ui.story_skip}
          </button>
        </div>
      </Chat>
    )
  }

  const question = questions.find((q) => q.id === stage.id)!
  const answer = (value: string) => {
    hush()
    onLog([asked(question.id), { from: 'me', text: spoken(question.id, value).answer }])
    askNext({ ...answers, [question.id]: value })
  }
  return (
    <Questions
      key={`tap-${question.id}`}
      ui={ui}
      question={question}
      position={0}
      total={0}
      answer={answers[question.id]}
      onAnswer={answer}
      onBack={previousQuestion}
      onReplay={() => say([question.text], lang)}
      log={log}
      sub={asked(question.id).sub}
      subLang={otherLang}
      mic={mic(question.id, question.id)}
    />
  )
}
