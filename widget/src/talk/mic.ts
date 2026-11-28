/** Push-to-talk recording: tap to start, tap again (or 30 s) to stop. */
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
const MAX_MS = 30_000

export class Mic {
  private recorder: MediaRecorder | null = null
  private timer = 0

  static supported(): boolean {
    return typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined'
  }

  get recording(): boolean {
    return this.recorder?.state === 'recording'
  }

  async start(onDone: (audio: Blob) => void): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const type = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t))
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    recorder.onstop = () => {
      clearTimeout(this.timer)
      stream.getTracks().forEach((t) => t.stop())
      this.recorder = null
      onDone(new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' }))
    }
    recorder.start()
    this.recorder = recorder
    this.timer = window.setTimeout(() => this.stop(), MAX_MS)
  }

  stop(): void {
    if (this.recording) this.recorder!.stop()
  }
}
