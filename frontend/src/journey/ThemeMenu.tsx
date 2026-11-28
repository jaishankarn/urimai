import { useRef } from 'react'
import type { Content } from '../api'
import { MODES, THEMES, useAppearance } from '../theme'
import Icon from './icons'
import { chip, primary, title } from './ui'

/** A palette button that opens the colour choices. */
export default function ThemeMenu({ ui, className }: { ui: Content['ui']; className: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { theme, mode, setTheme, setMode } = useAppearance()
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label={ui.appearance} title={ui.appearance} className={className}>
        <Icon name="palette" />
      </button>
      <dialog ref={dialog} aria-label={ui.appearance} className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-line bg-surface p-5 text-left text-base font-normal text-ink backdrop:bg-black/50">
        <h2 className={title}>{ui.appearance}</h2>
        <div role="group" aria-label={ui.appearance} className="mt-3 grid grid-cols-2 gap-2">
          {THEMES.map((name) => (
            <button key={name} type="button" aria-pressed={theme === name} onClick={() => setTheme(name)} className={`${chip} flex items-center gap-2 !text-ink aria-pressed:border-2`}>
              {/* data-theme here makes the dot show that theme's own colour. */}
              <span data-theme={name} aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border border-fill-edge bg-fill text-on-fill">
                {theme === name && <Icon name="check" className="size-4" />}
              </span>
              <span className="min-w-0 text-left">{ui[`theme_${name}`]}</span>
            </button>
          ))}
        </div>
        <h3 className="mt-4 font-bold">{ui.mode_label}</h3>
        <div role="group" aria-label={ui.mode_label} className="mt-2 flex flex-wrap gap-2 *:grow">
          {MODES.map((name) => (
            <button key={name} type="button" aria-pressed={mode === name} onClick={() => setMode(name)} className={`${chip} aria-pressed:!bg-fill aria-pressed:!text-on-fill`}>
              {ui[`mode_${name}`]}
            </button>
          ))}
        </div>
        <button type="button" className={`${primary} mt-4`} onClick={() => dialog.current?.close()}>
          {ui.close}
        </button>
      </dialog>
    </>
  )
}
