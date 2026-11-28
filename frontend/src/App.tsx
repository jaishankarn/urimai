import { useEffect, useRef, useState } from 'react'
import { checkEligibility, getContent, getHealth, type Content, type Lang, type Result } from './api'
import { answerLabel, toFacts, visibleQuestions, type Answers } from './journey/answers'
import Chat, { Bot, type Turn } from './journey/Chat'
import Documents from './journey/Documents'
import Icon from './journey/icons'
import Language from './journey/Language'
import Questions from './journey/Questions'
import Results from './journey/Results'
import Sheet, { Details } from './journey/Sheet'
import Talk from './journey/Talk'
import ThemeMenu from './journey/ThemeMenu'
import Top from './journey/Top'
import { chip, primary, title } from './journey/ui'
import { getSuggestions, hush, nextQuestion, say, type Suggestions } from './voice'

const UNREACHABLE = 'Cannot reach the Urimai server'

type Step =
  | { name: 'language' }
  | { name: 'talk' }
  // `walkingBack`: reached with Back from the confirm screen after talking, so Back keeps going backwards.
  | { name: 'question'; id: string; editing: boolean; walkingBack?: boolean }
  | { name: 'confirm' }
  // `all`: the full list instead of the top suggestions.
  | { name: 'results'; all?: boolean }
  | { name: 'documents'; schemeId: string; all?: boolean }

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
  // `other` is the same text in the other language, for the second line of each chat bubble.
  const [loaded, setLoaded] = useState<{ lang: Lang; content: Content; other: Content } | null>(null)
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
  // The conversation so far, kept here so it stays on screen from one step to the next. Held in memory only.
  const [log, setLog] = useState<Turn[]>([])
  const [change, setChange] = useState<{ id: string } | null>(null)
  // After confirming, the right side shows the schemes or the details.
  const [side, setSide] = useState<'schemes' | 'details'>('schemes')
  // On a phone only one side fits, so these are tabs.
  const [tab, setTab] = useState<'talk' | 'side'>('talk')
  // Goes up whenever answers may change, so a late reply about older answers is ignored.
  const run = useRef(0)

  useEffect(() => {
    let current = true
    setLoadFailed(false)
    Promise.all([getContent(lang), getContent(lang === 'en' ? 'ta' : 'en')])
      .then(([content, other]) => current && setLoaded({ lang, content, other }))
      .catch(() => current && setLoadFailed(true))
    return () => {
      current = false
    }
  }, [lang])

  // Lines to say once the confirm screen is up. Said here because the conversation screen stops its own voice as it closes.
  const announce = useRef<string[] | null>(null)
  useEffect(() => {
    if (step.name === 'confirm' && announce.current) {
      say(announce.current, loaded?.lang ?? 'en')
      announce.current = null
    }
  }, [step])

  // On a phone, show the details to be checked before anyone is asked to confirm them.
  useEffect(() => {
    if (step.name === 'confirm') setTab('side')
  }, [step])

  const content = loaded?.content ?? null
  const shownLang = loaded?.lang ?? 'en'
  const other = loaded?.other ?? null
  const otherLang = shownLang === 'en' ? 'ta' : 'en'
  const visible = content ? visibleQuestions(content.questions, answers) : []
  // A spoken conversation skips questions that cannot change a result, so only answered ones are listed.
  const answered = visible.filter((q) => answers[q.id] !== undefined)
  const addToLog = (turns: Turn[]) => setLog((earlier) => [...earlier, ...turns])

  /** Anything worked out from the old answers is thrown away. */
  function clearResults() {
    run.current++
    hush()
    setResults([])
    setTop(null)
    setBusy(false)
    setCheckFailed(false)
    setSide('schemes')
  }

  function restart() {
    clearResults()
    setAnswers({})
    setLog([])
    setChange(null)
    setTab('talk')
    setStep({ name: 'language' })
  }

  function edit(id: string) {
    clearResults()
    setTab('talk')
    // While talking, the conversation asks again itself, so the microphone stays.
    if (step.name === 'talk') setChange({ id })
    else setStep({ name: 'question', id, editing: true })
  }

  function answer(id: string, value: string, editing: boolean) {
    const next = { ...answers, [id]: value }
    const question = content!.questions.find((q) => q.id === id)!
    addToLog([
      { from: 'urimai', text: question.text, sub: other!.questions.find((q) => q.id === id)!.text },
      { from: 'me', text: answerLabel(question, value, content!.ui.dont_know) },
    ])
    setAnswers(next)
    const list = visibleQuestions(content!.questions, next)
    if (spokenJourney && editing) return afterSpokenEdit(list, next)
    const position = list.findIndex((q) => q.id === id)
    // While editing, only stop at questions that became visible and have no answer yet.
    const following = editing ? list.find((q) => next[q.id] === undefined) : list[position + 1]
    setStep(following ? { name: 'question', id: following.id, editing } : { name: 'confirm' })
  }

  /** A spoken conversation left some questions unasked on purpose: after a change, ask only what now matters. */
  async function afterSpokenEdit(list: Content['questions'], next: Answers) {
    const skipped = list.filter((q) => q.type === 'number' && next[q.id] === 'unknown').map((q) => q.id)
    const mine = ++run.current
    try {
      const { question_id } = await nextQuestion(toFacts(list, next), skipped)
      if (mine === run.current) setStep(question_id ? { name: 'question', id: question_id, editing: true } : { name: 'confirm' })
    } catch {
      if (mine === run.current) setStep({ name: 'confirm' })
    }
  }

  function back(id: string, editing: boolean, walkingBack?: boolean) {
    if (walkingBack) {
      // Through the answered questions to the start, so there is always a way out.
      const asked = visible.filter((q) => answers[q.id] !== undefined)
      const before = asked[asked.findIndex((q) => q.id === id) - 1]
      return setStep(before ? { name: 'question', id: before.id, editing: true, walkingBack } : { name: 'language' })
    }
    if (editing) return setStep({ name: 'confirm' })
    const previous = visible[visible.findIndex((q) => q.id === id) - 1]
    setStep(previous ? { name: 'question', id: previous.id, editing } : { name: 'language' })
  }

  async function confirm() {
    const mine = ++run.current
    setBusy(true)
    setCheckFailed(false)
    try {
      const facts = toFacts(visible, answers)
      const [found, suggested] = await Promise.all([
        checkEligibility(facts),
        // The summary is extra: if it fails, the full results still show.
        getSuggestions(facts, shownLang).catch(() => null),
      ])
      if (mine !== run.current) return
      addToLog([
        { from: 'urimai', text: content!.ui.confirm_title, sub: other!.ui.confirm_title },
        { from: 'me', text: content!.ui.see_results },
      ])
      setResults(found)
      setTop(suggested)
      setSide('schemes')
      setTab('side')
      setStep({ name: 'results' })
      // Read aloud only to someone who chose to talk.
      if (suggested && spokenJourney) say(suggested.speech, shownLang)
    } catch {
      if (mine === run.current) setCheckFailed(true)
    } finally {
      if (mine === run.current) setBusy(false)
    }
  }

  const confirmed = step.name === 'results' || step.name === 'documents'
  const confirmButton = content && (
    <button type="button" className={primary} onClick={confirm} disabled={busy}>
      {busy ? content.ui.checking : checkFailed ? content.ui.try_again : content.ui.see_results}
    </button>
  )

  function conversation(content: Content, other: Content) {
    const ui = content.ui
    if (step.name === 'talk') {
      return (
        <Talk
          content={content}
          other={other}
          lang={shownLang}
          answers={answers}
          onAnswers={setAnswers}
          log={log}
          onLog={addToLog}
          change={change}
          onFinished={(speech) => {
            announce.current = speech
            setStep({ name: 'confirm' })
          }}
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
          total={spokenJourney ? 0 : visible.length}
          answer={answers[question.id]}
          onAnswer={(value) => answer(question.id, value, step.editing)}
          onBack={() => back(question.id, step.editing, step.walkingBack)}
          log={log}
          sub={other.questions.find((q) => q.id === question.id)!.text}
          subLang={otherLang}
        />
      )
    }
    if (step.name === 'confirm') {
      return (
        <Chat
          log={log}
          subLang={otherLang}
          at="confirm"
          replies={
            <>
              {confirmButton}
              <button
                type="button"
                className={chip}
                onClick={() => {
                  clearResults()
                  // After talking, go back to the last answered question and return here once it is answered.
                  const asked = spokenJourney ? answered : visible
                  setTab('talk')
                  setStep({ name: 'question', id: (asked.at(-1) ?? visible[0]).id, editing: spokenJourney, walkingBack: spokenJourney })
                }}
              >
                ← {ui.back}
              </button>
              {voiceReady && spokenJourney && (
                <button type="button" className={chip} onClick={() => say([ui.say_confirm], shownLang)}>
                  {ui.replay}
                </button>
              )}
            </>
          }
        >
          <Bot sub={`${other.ui.confirm_title}. ${other.ui.confirm_help}`} subLang={otherLang}>
            <strong>{ui.confirm_title}.</strong> {ui.confirm_help}
          </Bot>
          {checkFailed && (
            <p role="alert" className="text-danger">
              {ui.error_check}
            </p>
          )}
        </Chat>
      )
    }
    const closing = top?.suggestions.length ? 'say_intro' : top ? null : 'results_title'
    return (
      <Chat
        log={log}
        subLang={otherLang}
        at="results"
        replies={
          voiceReady && top ? (
            <button type="button" className={chip} onClick={() => say(top.speech, shownLang)}>
              {ui.replay}
            </button>
          ) : undefined
        }
      >
        <Bot sub={closing ? other.ui[closing] : undefined} subLang={otherLang}>
          {closing ? ui[closing] : top!.speech[0]}
        </Bot>
      </Chat>
    )
  }

  function summary(content: Content) {
    const ui = content.ui
    const showing = confirmed ? side : 'details'
    const head = (
      <>
        <h2 className={title}>{showing === 'schemes' ? ui.suggestions_title : ui.details_title}</h2>
        {confirmed ? (
          <div className="flex gap-1 rounded-2xl bg-page p-1">
            {(['schemes', 'details'] as const).map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={side === name}
                onClick={() => setSide(name)}
                className="min-h-12 rounded-xl px-4 font-semibold text-muted aria-pressed:bg-surface aria-pressed:text-brand aria-pressed:shadow-soft"
              >
                {name === 'schemes' ? ui.step_schemes : ui.details_title}
              </button>
            ))}
          </div>
        ) : (
          <span className="rounded-full bg-tint px-3 py-1 font-semibold text-brand">
            {ui.details_count.replace('{count}', String(answered.length))}
          </span>
        )}
      </>
    )
    const district = visible.find((q) => q.id === 'district')
    const documents = (schemeId: string, all?: boolean) => setStep({ name: 'documents', schemeId, all })

    function body() {
      if (showing === 'details') {
        return (
          <>
            <Details ui={ui} questions={answered} answers={answers} onEdit={edit} />
            {!confirmed && answered.length > 0 && (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-page p-3 text-muted">
                <Icon name="lock" /> {ui.details_locked}
              </p>
            )}
          </>
        )
      }
      if (step.name === 'documents') {
        const result = results.find((r) => r.scheme_id === step.schemeId)!
        return <Documents key={step.schemeId} ui={ui} lang={shownLang} result={result} onBack={() => setStep({ name: 'results', all: step.all })} />
      }
      if (step.name !== 'results') return null
      if (top && !step.all) {
        return (
          <Top
            ui={ui}
            lang={shownLang}
            found={top}
            results={results}
            voiceReady={voiceReady}
            onDocuments={(schemeId) => documents(schemeId)}
            onAll={() => setStep({ name: 'results', all: true })}
          />
        )
      }
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
          onDocuments={(schemeId) => documents(schemeId, true)}
          onBack={top ? () => setStep({ name: 'results' }) : undefined}
        />
      )
    }

    return (
      <Sheet
        head={head}
        view={`${showing}-${step.name}-${step.name === 'results' && step.all}`}
        notice={
          showing === 'schemes' ? (
            <p>
              <strong>{ui.no_guarantee}</strong> {ui.amounts_note}
            </p>
          ) : undefined
        }
        footer={
          // On a phone the conversation is on the other tab, so the confirm button is here too.
          step.name === 'confirm' ? <div className="border-t border-line p-3 min-[800px]:hidden">{confirmButton}</div> : undefined
        }
      >
        {body()}
      </Sheet>
    )
  }

  /** The conversation card: who is talking, how far along, and what Urimai will never do. */
  function journey(content: Content, other: Content) {
    const ui = content.ui
    const stage = confirmed ? 'step_schemes' : step.name === 'confirm' ? 'step_confirm' : 'step_talk'
    const total = stage === 'step_talk' ? visible.length : answered.length
    const done = answered.length
    const hidden = (name: 'talk' | 'side') => (tab === name ? '' : 'max-[800px]:hidden')
    return (
      <>
        <nav className="mx-3 mt-2 flex gap-1 rounded-2xl border border-line bg-surface p-1 min-[800px]:hidden">
          {(['talk', 'side'] as const).map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={tab === name}
              onClick={() => setTab(name)}
              className="min-h-12 flex-1 rounded-xl font-semibold text-muted aria-pressed:bg-fill aria-pressed:text-on-fill"
            >
              {name === 'talk' ? ui.step_talk : confirmed ? ui.step_schemes : ui.details_title}
            </button>
          ))}
        </nav>
        <main lang={shownLang} className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 p-3 min-[800px]:grid-cols-[48fr_52fr]">
          <section aria-label={ui.step_talk} className={`${hidden('talk')} flex min-h-0 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-soft`}>
            <header className="flex items-center gap-3 bg-head px-4 py-2 text-white">
              <span aria-hidden="true" lang="ta" className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-lg font-bold text-on-gold">
                உ
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <h1 className="text-lg font-bold">{ui.assistant_title}</h1>
                <p className="text-white/80 max-[800px]:hidden">
                  {ui.assistant_sub} · <span lang={otherLang}>{other.ui.assistant_sub}</span>
                </p>
              </div>
              <ThemeMenu ui={ui} className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-white/15" />
              <button type="button" onClick={restart} aria-label={ui.start_again} title={ui.start_again} className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-white/15">
                <Icon name="again" />
              </button>
            </header>
            <div className="border-b border-line px-4 pt-1 pb-2">
              <p className="text-muted">
                {ui[stage]} · {done} / {total}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-fill transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
              </div>
            </div>
            {conversation(content, other)}
            <p className="border-t border-line px-3 py-1 text-center text-muted max-[800px]:hidden">{ui.safety_note}</p>
          </section>
          <aside className={`${hidden('side')} flex min-h-0 flex-col`}>{summary(content)}</aside>
        </main>
      </>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page text-ink">
      {step.name === 'language' || !content || !other ? (
        <main lang={shownLang} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <div className="m-auto flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-6 shadow-soft">
            <div className="flex w-full items-center">
              <span className="size-12 shrink-0" />
              <h1 className="flex-1 text-center text-3xl font-bold text-brand">Urimai</h1>
              {content ? (
                <ThemeMenu ui={content.ui} className="grid size-12 shrink-0 place-items-center rounded-full border border-edge text-brand hover:bg-tint" />
              ) : (
                <span className="size-12 shrink-0" />
              )}
            </div>
            <Language
              lang={lang}
              content={content}
              voiceReady={voiceReady}
              onLanguage={setLang}
              onStart={() => {
                setSpokenJourney(false)
                clearResults()
                setLog([])
                setTab('talk')
                setStep({ name: 'question', id: visible[0].id, editing: false })
              }}
              onTalk={() => {
                setSpokenJourney(true)
                clearResults()
                setAnswers({})
                setLog([])
                setChange(null)
                setTab('talk')
                setStep({ name: 'talk' })
              }}
            />
          </div>
        </main>
      ) : (
        journey(content, other)
      )}
      <p role="status" className="px-3 pb-1 text-center font-medium text-warn empty:hidden">
        {loadFailed ? UNREACHABLE : notice}
      </p>
    </div>
  )
}
