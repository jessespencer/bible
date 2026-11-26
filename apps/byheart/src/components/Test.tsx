import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Book } from '../lib/bible'
import { rangeLabel, share, type TestMode, type TestRecord, type VerseScore } from '../lib/score'
import { senseLines } from '../lib/text'
import { VoiceMeter } from './VoiceMeter'
import { Heart } from './Heart'
import { PassageText } from './PassageText'

const MODE_NAMES: Record<TestMode, string> = {
  speaking: 'said aloud',
  words: 'typed in full',
  initials: 'typed by first letters',
}

const percent = (value: number) => `${Math.round(value * 100)}%`

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

interface TestReadyProps {
  title: string
  subtitle?: string
  mode: TestMode
  canSpeak: boolean
  onMode: (mode: TestMode) => void
  onBegin: () => void
}

export const TestReady = ({ title, subtitle, mode, canSpeak, onMode, onBegin }: TestReadyProps) => {
  const begin = useRef<HTMLButtonElement>(null)
  useEffect(() => begin.current?.focus({ preventScroll: true }), [])
  const modes: { id: TestMode; label: string }[] = [
    ...(canSpeak ? [{ id: 'speaking' as const, label: 'Say it' }] : []),
    { id: 'words', label: 'Type every word' },
    { id: 'initials', label: 'Type first letters' },
  ]
  return (
    <div className="test-ready">
      <p className="test-kicker">A test</p>
      <h2 className="test-title">{title}</h2>
      {subtitle && <p className="test-subtitle">{subtitle}</p>}
      <div className="test-modes" role="radiogroup" aria-label="How you will recite">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            className={mode === m.id ? 'on' : ''}
            onClick={() => onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button ref={begin} type="button" className="primary" onClick={onBegin}>
        Begin
      </button>
      <p className="test-note">Stop whenever you like. Only what you reach is scored.</p>
    </div>
  )
}

interface TestBannerProps {
  startedAt: number
  onStop: () => void
  // Set when the test is spoken: empty while all is well, or what went wrong with the microphone.
  listening?: string
}

export const TestBanner = ({ startedAt, onStop, listening }: TestBannerProps) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="test-banner" role="region" aria-label="Test">
      {listening ? (
        <span className="test-live test-mic-problem">{listening}</span>
      ) : (
        <span className="test-live">
          <span className="test-signal" aria-hidden="true">
            {listening === undefined ? <span className="test-dot" /> : <VoiceMeter />}
          </span>
          {listening === undefined ? 'Testing' : 'Listening'}
        </span>
      )}
      <span className="test-clock" aria-label="Time so far">
        {clock(Math.max(0, now - startedAt) / 1000)}
      </span>
      <button type="button" className="test-stop" onClick={onStop}>
        <span aria-hidden="true" className="test-stop-mark" />
        Stop
      </button>
    </div>
  )
}

interface ScorecardProps {
  book: Book
  translation: string
  scores: VerseScore[]
  seconds: number
  mode: TestMode
  previous?: TestRecord
  children?: ReactNode
}

export const Scorecard = ({ book, translation, scores, seconds, mode, previous, children }: ScorecardProps) => {
  if (!scores.length) {
    return (
      <div className="scorecard">
        <h1 className="score-figure">—</h1>
        <p className="session-message">Nothing scored. A verse counts once you reach most of it.</p>
        <div className="score-actions">{children}</div>
      </div>
    )
  }
  const words = scores.reduce((sum, s) => sum + s.words, 0)
  const recalled = words - scores.reduce((sum, s) => sum + s.missed, 0)
  const typos = scores.reduce((sum, s) => sum + s.typos, 0)
  const result = recalled / words
  const label = rangeLabel(book, scores[0], scores[scores.length - 1])
  const slipped = scores.filter((s) => s.tokens)
  const beaten = previous && result > share(previous.best)

  return (
    <div className="scorecard">
      {result === 1 && <Heart />}
      <h1 className="score-figure">{percent(result)}</h1>
      <p className="score-words">
        {recalled} of {words} words by heart
        {typos > 0 && `, ${typos === 1 ? 'one' : typos} with a slip of the pen`}
      </p>
      <p className="score-meta">
        {label} · {translation} · {MODE_NAMES[mode]} · {clock(seconds)}
      </p>
      {previous && (
        <p className="score-history">
          {beaten ? 'A new best. ' : ''}
          {previous.best === previous.last || share(previous.best) === share(previous.last)
            ? `Last time ${percent(share(previous.last))}`
            : `Best before ${percent(share(previous.best))} · last time ${percent(share(previous.last))}`}
        </p>
      )}

      <ol className="score-verses" aria-label="Verse by verse">
        {scores.map((s) => (
          <li key={`${s.chapter}:${s.verse}`} className={s.clean ? 'clean' : 'stumbled'}>
            <span className="score-ref">{scores[0].chapter === scores[scores.length - 1].chapter ? s.verse : `${s.chapter}:${s.verse}`}</span>
            <span className="score-mark">{s.missed ? `${s.missed} missed` : '✓'}</span>
          </li>
        ))}
      </ol>

      {slipped.length > 0 && (
        <section className="score-slips" aria-label="Where it slipped">
          {slipped.map((s) => {
            const missed = new Set(s.missedIds)
            const typoed = new Set(s.typoIds)
            return (
              <div key={`${s.chapter}:${s.verse}`} className="score-slip">
                <p className="score-slip-ref">
                  {s.chapter}:{s.verse}
                </p>
                <PassageText
                  lines={senseLines(s.tokens!)}
                  reveal="blank"
                  stateOf={(t) => (missed.has(t.id) ? 'helped' : typoed.has(t.id) ? 'typo' : 'plain')}
                />
              </div>
            )
          })}
          <p className="score-key">
            {slipped.some((s) => s.missed) && <span className="w-helped">Missed</span>}
            {slipped.some((s) => s.missed) && typos > 0 && ' · '}
            {typos > 0 && <span className="w-typo">A slip of the pen</span>}
          </p>
        </section>
      )}
      <div className="score-actions">{children}</div>
    </div>
  )
}
