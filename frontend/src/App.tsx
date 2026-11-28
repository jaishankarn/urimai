import { useEffect, useState } from 'react'
import { checkEligibility, getContent, getHealth, type Content, type Lang, type Result } from './api'
import { answerLabel, toFacts, visibleQuestions, type Answers } from './journey/answers'
import Confirm from './journey/Confirm'
import Documents from './journey/Documents'
import Language from './journey/Language'
import Questions from './journey/Questions'
import Results from './journey/Results'

const UNREACHABLE = 'Cannot reach the Urimai server'

type Step =
  | { name: 'language' }
  | { name: 'question'; id: string; editing: boolean }
  | { name: 'confirm' }
  | { name: 'results' }
  | { name: 'documents'; schemeId: string }

/** Asks the backend what is configured and returns a notice to show, if any. */
function useServerNotice() {
  const [notice, setNotice] = useState('')

  useEffect(() => {
    getHealth()
      .then((health) => setNotice(health.sarvam_configured ? '' : 'Sarvam key not set'))
      .catch(() => setNotice(UNREACHABLE))
  }, [])

  return notice
}

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [loaded, setLoaded] = useState<{ lang: Lang; content: Content } | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [step, setStep] = useState<Step>({ name: 'language' })
  const [answers, setAnswers] = useState<Answers>({})
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)
  const notice = useServerNotice()

  useEffect(() => {
    let current = true
    setLoadFailed(false)
    getContent(lang)
      .then((content) => current && setLoaded({ lang, content }))
      .catch(() => current && setLoadFailed(true))
    return () => {
      current = false
    }
  }, [lang])

  // Each new step starts at the top of the page. The braces matter: scrollTo can return a Promise,
  // and React would try to call anything an effect returns as its clean-up.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  const content = loaded?.content ?? null
  const shownLang = loaded?.lang ?? 'en'
  const visible = content ? visibleQuestions(content.questions, answers) : []

  function answer(id: string, value: string, editing: boolean) {
    const next = { ...answers, [id]: value }
    setAnswers(next)
    const list = visibleQuestions(content!.questions, next)
    const position = list.findIndex((q) => q.id === id)
    // While editing, only stop at questions that became visible and have no answer yet.
    const following = editing ? list.find((q) => next[q.id] === undefined) : list[position + 1]
    setStep(following ? { name: 'question', id: following.id, editing } : { name: 'confirm' })
  }

  function back(id: string, editing: boolean) {
    if (editing) return setStep({ name: 'confirm' })
    const previous = visible[visible.findIndex((q) => q.id === id) - 1]
    setStep(previous ? { name: 'question', id: previous.id, editing } : { name: 'language' })
  }

  async function confirm() {
    setBusy(true)
    setCheckFailed(false)
    try {
      setResults(await checkEligibility(toFacts(visible, answers)))
      setStep({ name: 'results' })
    } catch {
      setCheckFailed(true)
    } finally {
      setBusy(false)
    }
  }

  function screen() {
    if (step.name === 'language' || !content) {
      return (
        <Language
          lang={lang}
          content={content}
          onLanguage={setLang}
          onStart={() => setStep({ name: 'question', id: visible[0].id, editing: false })}
        />
      )
    }
    const ui = content.ui
    if (step.name === 'question') {
      const position = visible.findIndex((q) => q.id === step.id)
      const question = visible[position]
      return (
        <Questions
          key={question.id}
          ui={ui}
          question={question}
          position={position + 1}
          total={visible.length}
          answer={answers[question.id]}
          onAnswer={(value) => answer(question.id, value, step.editing)}
          onBack={() => back(question.id, step.editing)}
        />
      )
    }
    if (step.name === 'confirm') {
      return (
        <Confirm
          ui={ui}
          questions={visible}
          answers={answers}
          busy={busy}
          failed={checkFailed}
          onEdit={(id) => setStep({ name: 'question', id, editing: true })}
          onConfirm={confirm}
          onBack={() => setStep({ name: 'question', id: visible[visible.length - 1].id, editing: false })}
        />
      )
    }
    if (step.name === 'documents') {
      const result = results.find((r) => r.scheme_id === step.schemeId)!
      return <Documents ui={ui} lang={shownLang} result={result} onBack={() => setStep({ name: 'results' })} />
    }
    const district = visible.find((q) => q.id === 'district')
    return (
      <Results
        ui={ui}
        lang={shownLang}
        results={results}
        district={
          district && answers.district && answers.district !== 'unknown'
            ? answerLabel(district, answers.district, ui.dont_know)
            : ''
        }
        onDocuments={(schemeId) => setStep({ name: 'documents', schemeId })}
        onBack={() => setStep({ name: 'confirm' })}
        onRestart={() => {
          setAnswers({})
          setResults([])
          setStep({ name: 'language' })
        }}
      />
    )
  }

  return (
    <div className="min-h-dvh bg-amber-50 text-stone-900">
      <main lang={shownLang} className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-6">
        <h1 className="text-3xl font-bold text-emerald-800">Urimai</h1>
        {screen()}
        <p role="status" className="text-center text-lg font-medium text-amber-900">
          {loadFailed ? UNREACHABLE : notice}
        </p>
      </main>
    </div>
  )
}
