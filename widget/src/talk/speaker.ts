import * as api from '../api'
import type { Lang } from '../types'

/** Plays the widget's questions aloud. Text is always shown too; speech is an extra. */
export class Speaker {
  private audio: HTMLAudioElement | null = null
  private turn = 0

  constructor(private enabled: () => boolean, private onFail: (code: string) => void) {}

  async say(text: string, lang: Lang): Promise<void> {
    this.stop()
    if (!this.enabled() || !text.trim()) return
    const turn = ++this.turn
    try {
      const blob = await api.speak(text.slice(0, 600), lang)
      if (turn !== this.turn) return // a newer line or a barge-in
      const url = URL.createObjectURL(blob)
      this.audio = new Audio(url)
      this.audio.onended = () => URL.revokeObjectURL(url)
      await this.audio.play().catch(() => undefined) // autoplay may be blocked until the first tap
    } catch (e) {
      this.onFail(e instanceof api.ApiError ? e.code : 'voice_failed')
    }
  }

  stop(): void {
    this.turn++
    if (this.audio) {
      this.audio.pause()
      this.audio = null
    }
  }
}
