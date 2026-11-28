import { useEffect, useState } from 'react'
import { checkEligibility, getContent, getHealth, type Content, type Lang, type Result } from './api'
import { answerLabel, toFacts, visibleQuestions, type Answers } from './journey/answers'
import Confirm from './journey/Confirm'
import Documents from './journey/Documents'
import Language from './journey/Language'
import Questions from './journey/Questions'
import Results from './journey/Results'
import Talk from './journey/Talk'
import Top from './journey/Top'
import { getSuggestions, hush, say, type Suggestions } from './voice'

const UNREACHABLE = 'Cannot reach the Urimai server'

type Step =
  | { name: 'language' }
  | { name: 'talk' }
  | { name: 'question'; id: string; editing: boolean }
  | { name: 'confirm' }
  | { name: 'results' }
  | { name: 'documents'; schemeId: string }

/** Asks the backend what is configured and returns a notice to show, if any. */
function useServerNotice() {
  const [notice, setNotice] = useState('')
  const [voiceReady, setVoiceReady] = useState(false)

  useEffect(() => {
    getHealth()
      .then((health) => {
        setVoiceReady(health.sarvam_configured)
        setNotice(health.sarvam_configured ? '' : 'Sarvam key not set')
      })
      .catch(() => setNotice(UNREACHABLE))
  }, [])

  return { notice, voiceReady }
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
  const { notice, voiceReady } = useServerNotice()
  // True once the person chose to talk; results are then also summed up and spoken.
  const [spokenJourney, setSpokenJourney] = useState(false)
  const [top, setTop] = useState<Suggestions | null>(null)

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
      const facts = toFacts(visible, answers)
      const [found, suggested] = await Promise.all([
        checkEligibility(facts),
        // The summary is extra: if it fails, the full results still show.
        spokenJourney ? getSuggestions(facts, shownLang).catch(() => null) : null,
      ])
      setResults(found)
      setTop(suggested)
      setStep({ name: 'results' })
      if (suggested) say(suggested.speech, shownLang)
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
          voiceReady={voiceReady}
          onLanguage={setLang}
          onStart={() => {
            setSpokenJourney(false)
            setStep({ name: 'question', id: visible[0].id, editing: false })
          }}
          onTalk={() => {
            setSpokenJourney(true)
            setAnswers({})
            setStep({ name: 'talk' })
          }}
        />
      )
    }
    const ui = content.ui
    if (step.name === 'talk') {
      return (
        <Talk
          content={content}
          lang={shownLang}
          answers={answers}
          onAnswers={setAnswers}
          onFinished={() => setStep({ name: 'confirm' })}
          onLeave={() => {
            hush()
            setStep({ name: 'language' })
          }}
        />
      )
    }
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
          // A spoken conversation skips questions that cannot change a result, so only answered ones are listed.
          questions={visible.filter((q) => answers[q.id] !== undefined)}
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
    const details = (
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
          hush()
          setAnswers({})
          setResults([])
          setTop(null)
          setStep({ name: 'language' })
        }}
      />
    )
    return (
      <>
        {top && <Top ui={ui} lang={shownLang} found={top} />}
        {details}
      </>
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
