import { useEffect, useMemo, useRef, useState } from 'react'
import { prefersStillness } from '../lib/motion'
import { alignSpeech, emptyHeard, judgeWord, logRecital, noteHeard, scoreSpeech, type HeardLive } from '../lib/score'
import type { Typing } from '../lib/settings'
import { cleanWord, shuffled, vanishOrder, type Token } from '../lib/text'
import { VoiceMeter } from './VoiceMeter'
import { PassageText, type Reveal, type WordState } from './PassageText'

export interface TypedProgress {
  reached: number
  helped: Set<number>
  typos: Set<number>
}

interface TypedStageProps {
  tokens: Token[]
  lines: Token[][]
  reveal: Reveal
  targets: number[]
  typing: Typing
  verseNumbers?: number[]
  onDone: (helped: Set<number>, typos: Set<number>) => void
  onProgress?: (progress: TypedProgress) => void
  onSpeak?: () => void
  onTyping?: (typing: Typing) => void
}

// One engine for every typing stage. They differ only in what is left on the page, and in
// whether you type each word whole or only its first letter.
export const TypedStage = (props: TypedStageProps) => {
  const { tokens, lines, reveal, targets, typing, verseNumbers, onDone, onProgress, onSpeak, onTyping } = props
  const [position, setPosition] = useState(0)
  const [helped, setHelped] = useState<Set<number>>(new Set())
  const [typos, setTypos] = useState<Set<number>>(new Set())
  const [draft, setDraft] = useState('')
  const [wrong, setWrong] = useState<{ id: number; nonce: number }>()
  const input = useRef<HTMLInputElement>(null)
  const live = useRef({ position: 0, misses: 0, helped: new Set<number>(), typos: new Set<number>() })
  const longPassage = tokens.length > 70
  const targetSet = useMemo(() => new Set(targets), [targets])
  const words = typing === 'words'

  useEffect(() => {
    input.current?.focus({ preventScroll: true })
  }, [])

  // Follow the words smoothly, but a new passage simply opens at its first word.
  useEffect(() => {
    if (!longPassage) return
    document
      .querySelector(`[data-word="${targets[position]}"]`)
      ?.scrollIntoView({ block: 'center', behavior: position && !prefersStillness() ? 'smooth' : 'instant' })
  }, [longPassage, position, targets])

  const step = (asHelp: boolean) => {
    const state = live.current
    if (state.position >= targets.length) return
    if (asHelp) {
      state.helped.add(targets[state.position])
      setHelped(new Set(state.helped))
    }
    state.position += 1
    state.misses = 0
    setPosition(state.position)
    setDraft('')
    onProgress?.({ reached: state.position, helped: state.helped, typos: state.typos })
    if (state.position === targets.length) onDone(state.helped, state.typos)
  }

  const miss = () => {
    const state = live.current
    const id = targets[state.position]
    state.misses += 1
    setDraft('')
    if (state.misses >= 2) return step(true)
    setWrong({ id, nonce: Date.now() })
  }

  const press = (char: string) => {
    const typed = cleanWord(char)
    const state = live.current
    if (!typed || state.position >= targets.length) return
    if (typed === tokens[targets[state.position]].initial) return step(false)
    miss()
  }

  const submit = (text: string) => {
    const state = live.current
    if (!cleanWord(text) || state.position >= targets.length) return
    const id = targets[state.position]
    const verdict = judgeWord(tokens[id].word, text)
    if (verdict === 'wrong') return miss()
    if (verdict === 'typo') {
      state.typos.add(id)
      setTypos(new Set(state.typos))
    }
    step(false)
  }

  // Each word is checked when you finish it with a space. Moving on as soon as it matched
  // would take "in" out of "into" and spill the rest into the next word, so only the
  // passage's last word, with nothing after it, is taken the moment it is spelled right.
  const typeWords = (value: string) => {
    const parts = value.split(/\s+/)
    const rest = parts.pop() ?? ''
    parts.forEach(submit)
    const state = live.current
    const last = state.position === targets.length - 1
    if (last && judgeWord(tokens[targets[state.position]].word, rest) === 'right') return step(false)
    setDraft(rest)
  }

  const stateOf = (token: Token): WordState => {
    if (!targetSet.has(token.id)) return 'plain'
    if (helped.has(token.id)) return 'helped'
    if (typos.has(token.id)) return 'typo'
    const at = targets[position]
    if (token.id === at) return 'current'
    return token.id < (at ?? Infinity) ? 'done' : 'todo'
  }

  const at = targets[position]

  return (
    <div className="typed" onClick={() => input.current?.focus()}>
      <PassageText
        lines={lines}
        reveal={reveal}
        stateOf={stateOf}
        wrong={wrong}
        verseNumbers={verseNumbers}
        draft={words && at !== undefined ? { id: at, text: draft } : undefined}
      />
      <input
        ref={input}
        className="typed-input"
        aria-label={words ? 'Type each word' : 'Type the first letter of each word'}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        value={words ? draft : ''}
        onChange={(e) => (words ? typeWords(e.target.value) : [...e.target.value].forEach(press))}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault()
            step(true)
          } else if (e.key === 'Enter' && words) {
            e.preventDefault()
            submit(draft)
          }
        }}
      />
      <div className="stage-tools">
        <button type="button" className="quiet" onClick={() => step(true)}>
          Peek <kbd>Tab</kbd>
        </button>
        {onTyping && (
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setDraft('')
              onTyping(words ? 'initials' : 'words')
              input.current?.focus({ preventScroll: true })
            }}
          >
            {words ? 'Type first letters' : 'Type whole words'}
          </button>
        )}
        {onSpeak && (
          <button type="button" className="quiet" onClick={onSpeak}>
            Say it aloud instead
          </button>
        )}
      </div>
    </div>
  )
}

interface OrderStageProps {
  lines: Token[][]
  onDone: (misses: number) => void
}

const phrase = (line: Token[]) =>
  line.map((t) => `${t.before}${t.word}${t.after}`).join(' ')

export const OrderStage = ({ lines, onDone }: OrderStageProps) => {
  const chunks = useMemo(() => {
    if (lines.length >= 3) return lines
    const words = lines.flat()
    const size = Math.max(2, Math.ceil(words.length / 4))
    const out: Token[][] = []
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size))
    return out
  }, [lines])
  const [placed, setPlaced] = useState(0)
  const [wrong, setWrong] = useState<{ index: number; nonce: number }>()
  const misses = useRef(0)
  const order = useMemo(() => {
    const indices = chunks.map((_, i) => i)
    let mixed = shuffled(indices)
    while (mixed.length > 1 && mixed.every((v, i) => v === i)) mixed = shuffled(indices)
    return mixed
  }, [chunks])

  const choose = (index: number) => {
    if (index !== placed) {
      misses.current += 1
      setWrong({ index, nonce: Date.now() })
      return
    }
    setPlaced(placed + 1)
    if (placed + 1 === chunks.length) onDone(misses.current)
  }

  const chooseRef = useRef(choose)
  chooseRef.current = choose
  const remaining = order.filter((i) => i >= placed)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const pick = remaining[Number(e.key) - 1]
      if (pick !== undefined) chooseRef.current(pick)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="order">
      <div className="order-placed">
        {chunks.map((chunk, i) => (
          <p key={chunk[0].id} className={`sense ${i < placed ? 'order-in' : 'order-slot'}`}>
            {i < placed ? phrase(chunk) : ' '}
          </p>
        ))}
      </div>
      <ol className="order-pile">
        {remaining.map((index, i) => (
          <li key={`${index}-${wrong?.index === index ? wrong.nonce : 0}`}>
            <button
              type="button"
              className={wrong?.index === index ? 'w-wrong' : ''}
              onClick={() => choose(index)}
            >
              <span className="order-key">{i + 1}</span>
              {phrase(chunks[index])}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

const VANISH_ROUNDS = [0, 0.3, 0.55, 0.8, 1]

interface VanishStageProps {
  tokens: Token[]
  lines: Token[][]
  seed: string
  onDone: () => void
}

export const VanishStage = ({ tokens, lines, seed, onDone }: VanishStageProps) => {
  const [round, setRound] = useState(0)
  const [peeking, setPeeking] = useState(false)
  const order = useMemo(() => vanishOrder(tokens, seed), [tokens, seed])
  const finalRound = round === VANISH_ROUNDS.length - 1
  const hidden = useMemo(
    () => new Set(order.slice(0, Math.round(order.length * VANISH_ROUNDS[round]))),
    [order, round],
  )

  const next = () => (finalRound ? onDone() : setRound(round + 1))
  const nextRef = useRef(next)
  nextRef.current = next

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        if (!e.repeat) nextRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="vanish">
      <PassageText
        lines={lines}
        reveal="blank"
        stateOf={(t) => (hidden.has(t.id) && !peeking ? 'gone' : 'plain')}
      />
      <div className="stage-tools">
        <button type="button" className="primary" onClick={next}>
          {finalRound ? 'I said it' : round === 0 ? 'I said it. Let some go' : 'Again. Let more go'}
        </button>
        <button
          type="button"
          className="quiet"
          onPointerDown={() => setPeeking(true)}
          onPointerUp={() => setPeeking(false)}
          onPointerLeave={() => setPeeking(false)}
        >
          Hold to peek
        </button>
      </div>
    </div>
  )
}

interface SpeechResultLike {
  0: { transcript: string }
}

interface RecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: ArrayLike<SpeechResultLike> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type RecognitionConstructor = new () => RecognitionLike

const recognitionClass = () => {
  const w = window as unknown as Record<string, RecognitionConstructor | undefined>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canSpeak = () => !!recognitionClass()

interface ReciteStageProps {
  tokens: Token[]
  lines: Token[][]
  verseNumbers?: number[]
  onDone: (missed: Set<number>) => void
  onHeard?: (transcript: string, live: HeardLive) => void
  onCancel?: () => void
  // When given, whatever holds the stage shows the listening state, and the stage does not.
  onProblem?: (problem: string) => void
}

export const ReciteStage = ({ tokens, lines, verseNumbers, onDone, onHeard, onCancel, onProblem }: ReciteStageProps) => {
  const [progress, setProgress] = useState({ position: 0, skipped: new Set<number>() })
  const [problem, setProblem] = useState('')
  const latest = useRef({ tokens, onDone, onHeard, onProblem })
  latest.current = { tokens, onDone, onHeard, onProblem }

  useEffect(() => {
    const Recognition = recognitionClass()
    if (!Recognition) return
    const recognition = new Recognition()
    let active = true
    let heardBefore = ''
    let session = ''
    let sessionLength = 0
    const live = emptyHeard()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (e) => {
      // Some browsers (Safari especially) start the list of results afresh mid-recital without
      // ending the session. Keep what was heard before the list shrank.
      if (e.results.length < sessionLength) {
        heardBefore = `${heardBefore} ${session}`
        live.resets += 1
      }
      sessionLength = e.results.length
      session = Array.from(e.results, (r) => r[0].transcript).join(' ')
      const transcript = `${heardBefore} ${session}`
      const next = alignSpeech(latest.current.tokens, transcript)
      noteHeard(live, latest.current.tokens, next)
      setProgress(next)
      latest.current.onHeard?.(transcript, live)
      if (next.position === latest.current.tokens.length) {
        active = false
        recognition.stop()
        // The live follower only looks ahead a little; the final score lines up the whole recital.
        const score = scoreSpeech(latest.current.tokens, transcript, true, live)
        logRecital(latest.current.tokens, transcript, live, score)
        latest.current.onDone(score.missed)
      }
    }
    recognition.onerror = (e) => {
      live.errors.push(e.error)
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false
        setProblem('The microphone is blocked for this page.')
        latest.current.onProblem?.('Microphone blocked')
      }
    }
    // Browsers end recognition after a pause, so carry on from what was already heard.
    recognition.onend = () => {
      if (!active) return
      heardBefore = `${heardBefore} ${session}`
      session = ''
      sessionLength = 0
      live.restarts += 1
      try {
        recognition.start()
      } catch (error) {
        live.errors.push(`restart failed: ${String(error)}`)
      }
    }
    recognition.start()
    return () => {
      active = false
      recognition.stop()
    }
  }, [])

  const stateOf = (token: Token): WordState => {
    if (progress.skipped.has(token.id)) return 'helped'
    const at = tokens[progress.position]?.id
    if (token.id === at) return 'current'
    return token.id < (at ?? Infinity) ? 'done' : 'todo'
  }

  return (
    <div className="typed">
      <PassageText lines={lines} reveal="blank" stateOf={stateOf} verseNumbers={verseNumbers} />
      {!onProblem && (
        <div className="stage-tools">
          {problem ? (
            <span className="listening">{problem}</span>
          ) : (
            <span className="listening">
              <VoiceMeter /> Listening
            </span>
          )}
          {onCancel && (
            <button type="button" className="quiet" onClick={onCancel}>
              Back to typing
            </button>
          )}
        </div>
      )}
    </div>
  )
}
