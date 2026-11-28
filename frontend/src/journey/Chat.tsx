import { useEffect, useRef, type ReactNode } from 'react'
import Icon from './icons'

/** `sub` is the same line in the other language. `badge` marks what Urimai noted down. */
export type Turn = { from: 'urimai' | 'me'; text: string; sub?: string; badge?: string; spoken?: boolean }

type BotProps = { children: ReactNode; sub?: string; subLang?: string; badge?: string }

/** Something Urimai says, with the other language under it. */
export function Bot({ children, sub, subLang, badge }: BotProps) {
  return (
    <div className="max-w-[92%] shrink-0 self-start rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 shadow-soft">
      <div>
        {children}
        {badge && <span className="ml-2 inline-block rounded-full bg-warn-tint px-2 font-semibold text-warn">{badge}</span>}
      </div>
      {sub && (
        <p lang={subLang} className="text-muted">
          {sub}
        </p>
      )}
    </div>
  )
}

type Props = {
  log: Turn[]
  /** The language of the second line. */
  subLang: string
  /** Changes when there is a new prompt, so it is scrolled into view. */
  at: string
  /** Quick replies, in a row above the microphone. */
  replies?: ReactNode
  /** The microphone and typing box. */
  mic?: ReactNode
  children: ReactNode
}

/** The conversation: what has been said, what is being asked now, and the ways to answer. */
export default function Chat({ log, subLang, at, replies, mic, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const now = useRef<HTMLDivElement>(null)

  // The braces matter: React would call anything an effect returns as its clean-up.
  useEffect(() => {
    if (box.current && now.current) box.current.scrollTop = now.current.offsetTop - 12
  }, [at, log.length])

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div ref={box} className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-page px-3 py-3">
        <div className="mt-auto" />
        {log.map((turn, index) =>
          turn.from === 'me' ? (
            <p key={index} className="flex max-w-[85%] shrink-0 items-center gap-2 self-end rounded-2xl rounded-br-md bg-fill px-4 py-3 break-words text-on-fill">
              {turn.spoken && <Icon name="mic" className="size-4" />}
              <span className="min-w-0">{turn.text}</span>
            </p>
          ) : (
            <Bot key={index} sub={turn.sub} subLang={subLang} badge={turn.badge}>
              {turn.text}
            </Bot>
          ),
        )}
        <div ref={now} className="flex shrink-0 flex-col gap-3">
          {children}
        </div>
      </div>
      {(replies || mic) && (
        <div className="flex flex-col gap-2 border-t border-line bg-surface p-3">
          {replies && <div className="flex flex-wrap gap-2 *:grow">{replies}</div>}
          {mic}
        </div>
      )}
    </div>
  )
}
