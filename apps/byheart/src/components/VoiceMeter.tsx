import { useEffect, useRef } from 'react'

const BARS = 5
// The bars in the middle stand tallest, so speech reads as a swell rather than a staircase.
const SHAPE = [0.55, 0.8, 1, 0.8, 0.55]
const QUIET = 0.14

/**
 * A small set of bars that move with your voice, so you can tell the microphone is hearing
 * you. Speech recognition gives no sound level, so this listens alongside it. If the
 * microphone cannot be opened, the bars simply stay still.
 */
export const VoiceMeter = () => {
  const bars = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const run: { stopped: boolean; frame: number; stream?: MediaStream; context?: AudioContext } = {
      stopped: false,
      frame: 0,
    }
    const levels = Array<number>(BARS).fill(QUIET)

    const draw = () => {
      bars.current.forEach((bar, i) => {
        if (bar) bar.style.transform = `scaleY(${levels[i]})`
      })
    }
    draw()

    const listen = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (run.stopped) return stream.getTracks().forEach((t) => t.stop())
      const context = new AudioContext()
      run.stream = stream
      run.context = context
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.6
      context.createMediaStreamSource(stream).connect(analyser)
      const bins = new Uint8Array(analyser.frequencyBinCount)
      // Where the voice lives: roughly 100 Hz to 3 kHz, split into one band per bar.
      const hz = context.sampleRate / analyser.fftSize
      const low = Math.max(1, Math.round(100 / hz))
      const high = Math.round(3000 / hz)
      const band = (high - low) / BARS

      const tick = () => {
        analyser.getByteFrequencyData(bins)
        for (let b = 0; b < BARS; b++) {
          let sum = 0
          const from = Math.floor(low + b * band)
          const to = Math.floor(low + (b + 1) * band)
          for (let k = from; k < to; k++) sum += bins[k]
          const loud = Math.min(1, Math.max(0, (sum / (to - from) / 255 - 0.25) * 2.2))
          const target = QUIET + (1 - QUIET) * loud * SHAPE[b]
          // Rise quickly, fall gently, as a level meter does.
          levels[b] += (target - levels[b]) * (target > levels[b] ? 0.55 : 0.18)
        }
        draw()
        run.frame = requestAnimationFrame(tick)
      }
      tick()
    }
    listen().catch(() => {})

    return () => {
      run.stopped = true
      cancelAnimationFrame(run.frame)
      run.stream?.getTracks().forEach((t) => t.stop())
      run.context?.close().catch(() => {})
    }
  }, [])

  return (
    <span className="voice-meter" aria-hidden="true">
      {SHAPE.map((_, i) => (
        <span key={i} ref={(el) => void (bars.current[i] = el)} />
      ))}
    </span>
  )
}
