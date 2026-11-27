import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fetchChapter, getTranslation, partOf, refLabel, splitAtParts, type Book, type Verse } from '../lib/bible'
import {
  LADDER,
  STAGE_HINTS,
  WORD_HINTS,
  emptyRecord,
  gradeRecall,
  isDue,
  verseKey,
  type Progress,
  type Stage,
  type VerseRecord,
} from '../lib/memory'
import { askedLabel, emptyHeard, logRecital, recordTest, scoreSpeech, scoreVerses, testKey, type TestMode, type TestRecord, type VerseScore } from '../lib/score'
import { loadSettings, saveSettings, type Settings, type Typing } from '../lib/settings'
import { pickBlanks, senseLines, tokenize } from '../lib/text'
import { Back } from './Back'
import { Heart } from './Heart'
import { Footnotes } from './Footnotes'
import { PassageText, type Reveal } from './PassageText'
import { OrderStage, ReciteStage, TypedStage, VanishStage, canSpeak, type TypedProgress } from './stages'
import { Scorecard, TestBanner, TestReady } from './Test'
import { CreditLinks } from './Credits'

export interface SessionItem {
  kind: 'learn' | 'review' | 'run'
  chapter: number
  from: number
  to: number
}

interface SessionProps {
  items: SessionItem[]
  book: Book
  translation: string
  progress: Progress
  onRecord: (key: string, update: (record: VerseRecord) => VerseRecord) => void
  onExit: () => void
  section?: { name: string; onNext?: () => void }
}

const REVEALS: Partial<Record<Stage, Reveal>> = {
  trace: 'ghost',
  initials: 'initial',
  shapes: 'shape',
  bare: 'blank',
  thread: 'blank',
}


const RUN_STAGE = 7
const FLOURISH_MS = 1100

const emptyTyped = (): TypedProgress => ({ reached: 0, helped: new Set(), typos: new Set() })

const withoutText = (score: VerseScore): VerseScore => ({ ...score, tokens: undefined, missedIds: undefined, typoIds: undefined })

export const Session = ({ items: asked, book, translation, progress, onRecord, onExit, section }: SessionProps) => {
  // A run across an ESV chapter printed in parts recites one part at a time, as the page shows it.
  const items = useMemo(() => splitAtParts(translation, book, asked), [translation, book, asked])
  // A recital is a test: it waits for you to begin, can be stopped anywhere, and ends in a score.
  const isTest = asked.length > 0 && asked.every((i) => i.kind === 'run')
  const [index, setIndex] = useState(0)
  const [chapterText, setChapterText] = useState<{ chapter: number; part: number; verses: Verse[] }>()
  const [loadError, setLoadError] = useState('')
  const item = items[index] as SessionItem | undefined
  const firstKey = item ? verseKey(translation, book.code, item.chapter, item.from) : ''
  const startStage = (it: SessionItem | undefined, key: string): Stage =>
    it?.kind === 'learn' ? LADDER[Math.min(progress[key]?.stage ?? 0, 6)] : 'bare'
  const [stage, setStage] = useState<Stage>(startStage(item, firstKey))
  const [attempt, setAttempt] = useState(0)
  const [flourish, setFlourish] = useState<'pass' | 'again'>()
  const [speaking, setSpeaking] = useState(false)
  const [tally, setTally] = useState({ verses: 0, stumbles: 0 })
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [test, setTest] = useState<{ phase: 'ready' | 'running' | 'done'; startedAt: number; seconds: number }>({
    phase: isTest ? 'ready' : 'running',
    startedAt: 0,
    seconds: 0,
  })
  const [outcome, setOutcome] = useState<{ scores: VerseScore[]; previous?: TestRecord }>()
  const [micProblem, setMicProblem] = useState('')
  const scores = useRef<VerseScore[]>([])
  const typedSoFar = useRef<TypedProgress>(emptyTyped())
  const heardSoFar = useRef({ transcript: '', live: emptyHeard() })
  const flourishTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const speakable = canSpeak()
  const testMode: TestMode = settings.testBy === 'speaking' && speakable ? 'speaking' : settings.typing
  const credited = getTranslation(translation)
  // Keyed text is only ever held in memory, a chapter or two at a time, so the scorecard keeps
  // the wording of the passage last recited and lets go of the rest.
  const keepsText = !credited.keySource

  const changeSettings = (next: Partial<Settings>) => {
    const merged = { ...settings, ...next }
    setSettings(merged)
    saveSettings(merged)
  }
  const chooseMode = (mode: TestMode) =>
    changeSettings(mode === 'speaking' ? { testBy: 'speaking' } : { testBy: 'typing', typing: mode })

  const part = item ? partOf(translation, book, item.chapter, item.from) : 0
  const textReady = !!item && chapterText?.chapter === item.chapter && chapterText.part === part

  useEffect(() => {
    if (!item || textReady) return
    let current = true
    fetchChapter(translation, book, item.chapter, part)
      .then((verses) => current && setChapterText({ chapter: item.chapter, part, verses }))
      .catch((e: Error) => current && setLoadError(e.message || 'This translation needs a key. Add yours on the page.'))
    return () => {
      current = false
    }
  }, [item, textReady, part, translation, book])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [test.phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onExit()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  useEffect(() => () => clearTimeout(flourishTimer.current), [])

  const verses = useMemo(() => {
    if (!item || !textReady) return []
    return chapterText!.verses.filter((v) => v.verse >= item.from && v.verse <= item.to)
  }, [item, textReady, chapterText])

  const previousVerse = useMemo(() => {
    if (!item || !textReady || item.kind !== 'learn') return undefined
    const before = chapterText!.verses.find((v) => v.verse === item.from - 1)
    const known = before && (progress[verseKey(translation, book.code, before.chapter, before.verse)]?.box ?? 0) > 0
    return known ? before : undefined
  }, [item, textReady, chapterText, progress, translation, book])

  const practised = useMemo(
    () => (stage === 'thread' && previousVerse ? [previousVerse, ...verses] : verses),
    [stage, previousVerse, verses],
  )
  const tokens = useMemo(() => tokenize(practised.map((v) => v.text)), [practised])
  const lines = useMemo(() => senseLines(tokens), [tokens])
  const seed = `${firstKey}:${stage}`
  const targets = useMemo(() => {
    if (stage !== 'blanks') return tokens.map((t) => t.id)
    const blanks = pickBlanks(tokens, seed)
    return tokens.filter((t) => blanks.has(t.id)).map((t) => t.id)
  }, [tokens, stage, seed])

  const typing: Typing = settings.typing

  const record = (verse: number, update: (r: VerseRecord) => VerseRecord) =>
    onRecord(verseKey(translation, book.code, item!.chapter, verse), update)

  const finishTest = () => {
    const scored = scores.current
    const seconds = (Date.now() - test.startedAt) / 1000
    const words = scored.reduce((sum, s) => sum + s.words, 0)
    const recalled = words - scored.reduce((sum, s) => sum + s.missed, 0)
    const previous = scored.length
      ? recordTest(testKey(translation, book.code, scored, testMode), { recalled, words, seconds })
      : undefined
    setOutcome({ scores: scored, previous })
    setTest({ ...test, phase: 'done', seconds })
  }

  const nextItem = () => {
    const next = items[index + 1]
    setIndex(index + 1)
    setAttempt(0)
    setSpeaking(false)
    typedSoFar.current = emptyTyped()
    heardSoFar.current = { transcript: '', live: emptyHeard() }
    if (next) setStage(startStage(next, verseKey(translation, book.code, next.chapter, next.from)))
    else if (isTest) finishTest()
  }

  const afterFlourish = (action: () => void, kind: 'pass' | 'again' = 'pass') => {
    setFlourish(kind)
    flourishTimer.current = setTimeout(() => {
      setFlourish(undefined)
      action()
    }, FLOURISH_MS)
  }

  const finishLearnStage = (passed: boolean) => {
    if (!passed) return afterFlourish(() => setAttempt(attempt + 1), 'again')
    const position = LADDER.indexOf(stage)
    if (stage === 'bare') {
      record(item!.from, (r) => (r.box === 0 ? gradeRecall({ ...r, stage: RUN_STAGE }, true) : r))
      setTally((t) => ({ ...t, verses: t.verses + 1 }))
    } else if (stage !== 'thread') {
      record(item!.from, (r) => ({ ...r, stage: Math.max(r.stage, position + 1) }))
    }
    const threadNext = stage === 'bare' && previousVerse
    if (stage === 'bare' && !threadNext) return afterFlourish(nextItem)
    if (stage === 'thread') return afterFlourish(nextItem)
    afterFlourish(() => {
      setStage(LADDER[position + 1])
      setAttempt(0)
      setSpeaking(false)
    })
  }

  // A run grades every verse it reached, so it doubles as a placement test: verses
  // you already know skip the ladder entirely. Verses it never reached are left as they were.
  const gradeRun = (reached: number, missed: Set<number>, typos: Set<number>) => {
    const scored = scoreVerses(tokens, verses, reached, missed, typos)
    let stumbles = 0
    scored.forEach((s) => {
      const existing = progress[verseKey(translation, book.code, s.chapter, s.verse)] ?? emptyRecord()
      if (!s.clean && existing.box > 0) stumbles += 1
      if (s.clean && existing.box > 0 && !isDue(existing)) return
      if (!s.clean && existing.box === 0) return
      record(s.verse, (r) => gradeRecall({ ...r, stage: Math.max(r.stage, s.clean ? RUN_STAGE : r.stage) }, s.clean))
    })
    const kept = keepsText ? scores.current : scores.current.map(withoutText)
    scores.current = [...kept, ...scored]
    setTally((t) => ({ verses: t.verses + scored.filter((s) => s.clean).length, stumbles: t.stumbles + stumbles }))
  }

  const finishTyped = (helped: Set<number>, typos: Set<number> = new Set()) => {
    const share = helped.size / Math.max(1, targets.length)
    if (item!.kind === 'learn') return finishLearnStage(stage === 'trace' || share <= 0.2)

    if (item!.kind === 'review') {
      if (stage === 'shapes') return afterFlourish(nextItem)
      const clean = helped.size <= Math.floor(tokens.length / 20)
      record(item!.from, (r) => gradeRecall(r, clean))
      setTally((t) => ({ verses: t.verses + (clean ? 1 : 0), stumbles: t.stumbles + (clean ? 0 : 1) }))
      if (clean) return afterFlourish(nextItem)
      return afterFlourish(() => {
        setStage('shapes')
        setSpeaking(false)
      }, 'again')
    }

    gradeRun(tokens.length, helped, typos)
    afterFlourish(nextItem)
  }

  // Stopping scores the passage up to where you were. Between passages it is already scored.
  const stop = () => {
    if (flourish) {
      clearTimeout(flourishTimer.current)
      setFlourish(undefined)
    } else if (tokens.length) {
      if (testMode === 'speaking') {
        const { transcript, live } = heardSoFar.current
        const { reached, missed } = scoreSpeech(tokens, transcript, false, live)
        logRecital(tokens, transcript, live, { reached, missed })
        gradeRun(reached, missed, new Set())
      } else {
        const { reached, helped, typos } = typedSoFar.current
        gradeRun(reached, helped, typos)
      }
    }
    finishTest()
  }

  const backLabel = section ? 'Back to the structure' : 'Back to the page'

  if (loadError) {
    return (
      <main className="session">
        <p className="session-message">{loadError}</p>
        <button type="button" className="quiet" onClick={onExit}>
          {backLabel}
        </button>
      </main>
    )
  }

  const endActions = (
    <>
      {section?.onNext && (
        <button type="button" className="primary" onClick={section.onNext}>
          What comes next?
        </button>
      )}
      <button type="button" className={section?.onNext ? 'quiet' : 'primary'} onClick={onExit}>
        {backLabel}
      </button>
    </>
  )

  if (isTest && test.phase === 'done' && outcome) {
    return (
      <main className="session session-score">
        <header className="session-head">
          <Back to={section ? 'Structure' : book.name} onClick={onExit} />
          <span />
          <span className="session-count">{translation}</span>
        </header>
        <Scorecard
          book={book}
          translation={translation}
          scores={outcome.scores}
          seconds={test.seconds}
          mode={testMode}
          previous={outcome.previous}
        >
          {endActions}
        </Scorecard>
        <footer className="session-hint">
          {credited.creditOnRecitals ? (
            <p className="session-credit">{credited.credit}</p>
          ) : (
            credited.links && (
              <p className="session-credit">
                <CreditLinks translation={credited} />
              </p>
            )
          )}
        </footer>
      </main>
    )
  }

  if (!item) {
    return (
      <main className="session session-end">
        <Heart />
        <h1>It is written.</h1>
        <p className="session-message">
          {tally.verses === 1 ? 'One verse' : `${tally.verses} verses`} kept
          {tally.stumbles > 0 && `, ${tally.stumbles} to come back to tomorrow`}.
        </p>
        {endActions}
      </main>
    )
  }

  const verseNumbers = practised.length > 1 ? practised.map((v) => v.verse) : undefined
  const reveal = REVEALS[stage]
  const speakingNow = isTest ? testMode === 'speaking' : speaking

  const renderStage = () => {
    if (isTest && test.phase === 'ready') {
      return (
        <TestReady
          title={section?.name ?? askedLabel(book, asked)}
          subtitle={section ? askedLabel(book, asked) : undefined}
          mode={testMode}
          canSpeak={speakable}
          onMode={chooseMode}
          onBegin={() => setTest({ ...test, phase: 'running', startedAt: Date.now() })}
        />
      )
    }
    if (!tokens.length) {
      return <p className="session-message">{textReady ? 'This passage is not in this translation.' : 'Opening the book…'}</p>
    }
    if (flourish === 'pass') {
      return (
        <div className="flourish">
          <PassageText lines={lines} reveal="blank" stateOf={() => 'plain'} verseNumbers={verseNumbers} />
          <Heart />
        </div>
      )
    }
    if (flourish === 'again') {
      return (
        <div className="flourish flourish-again">
          <PassageText lines={lines} reveal="blank" stateOf={() => 'plain'} verseNumbers={verseNumbers} />
          <p className="again-note">Look it over once more.</p>
        </div>
      )
    }
    const stageKey = `${index}-${stage}-${attempt}`
    if (stage === 'order') {
      return <OrderStage key={stageKey} lines={lines} onDone={(misses) => finishLearnStage(misses <= lines.length)} />
    }
    if (stage === 'vanish') {
      return <VanishStage key={stageKey} tokens={tokens} lines={lines} seed={seed} onDone={() => finishLearnStage(true)} />
    }
    if (speakingNow) {
      return (
        <ReciteStage
          key={stageKey}
          tokens={tokens}
          lines={lines}
          verseNumbers={verseNumbers}
          onDone={(missed) => finishTyped(missed)}
          onHeard={(transcript, live) => (heardSoFar.current = { transcript, live })}
          onCancel={isTest ? undefined : () => setSpeaking(false)}
          onProblem={isTest ? setMicProblem : undefined}
        />
      )
    }
    return (
      <TypedStage
        key={stageKey}
        tokens={tokens}
        lines={lines}
        reveal={reveal ?? 'blank'}
        targets={targets}
        typing={typing}
        verseNumbers={verseNumbers}
        onDone={finishTyped}
        onProgress={isTest ? (p) => (typedSoFar.current = p) : undefined}
        onSpeak={!isTest && speakable && (stage === 'bare' || stage === 'thread') ? () => setSpeaking(true) : undefined}
        onTyping={isTest ? undefined : (t) => changeSettings({ typing: t })}
      />
    )
  }

  const reference = refLabel(book, verses.length ? verses : [{ chapter: item.chapter, verse: item.from, text: '' }])
  const ladder = LADDER.filter((s) => s !== 'thread' || previousVerse)
  const ready = isTest && test.phase === 'ready'

  const hint = () => {
    if (isTest) {
      if (ready) return ''
      if (testMode === 'speaking') return 'Say it from the heart. Stop when you have said all you mean to.'
      if (testMode === 'words') return 'Every word, in full. Two misses and the word is given to you.'
      return 'First letter of every word. Two misses and the word is given to you.'
    }
    if (typing === 'words' && !speakingNow) return WORD_HINTS[stage] ?? STAGE_HINTS[stage]
    return STAGE_HINTS[stage]
  }

  return (
    <main className={`session session-${ready ? 'ready' : stage}`}>
      <header className="session-head">
        <Back to={section ? 'Structure' : book.name} onClick={onExit} />
        <h1 className="session-ref">{ready ? '' : reference}</h1>
        <span className="session-count">
          {translation}
          {!ready && items.length > 1 && ` · ${index + 1} of ${items.length}`}
        </span>
      </header>
      {item.kind === 'learn' ? (
        <nav className="ladder" aria-label="Memorizing stages">
          {ladder.map((s) => (
            <button
              key={s}
              type="button"
              className={s === stage ? 'on' : ''}
              aria-current={s === stage ? 'step' : undefined}
              onClick={() => {
                if (flourish) return
                setStage(s)
                setSpeaking(false)
                setAttempt(attempt + 1)
              }}
            >
              {s}
            </button>
          ))}
        </nav>
      ) : isTest ? (
        !ready && (
          <TestBanner
            startedAt={test.startedAt}
            onStop={stop}
            listening={testMode === 'speaking' ? micProblem : undefined}
          />
        )
      ) : (
        <div className="ladder ladder-solo">{stage === 'shapes' ? 'shapes' : 'review'}</div>
      )}
      <section className="stage">{renderStage()}</section>
      <footer className="session-hint">
        {hint()}
        {credited.creditOnRecitals ? (
          <p className="session-credit">{credited.credit}</p>
        ) : (
          credited.links && (
            <p className="session-credit">
              <CreditLinks translation={credited} />
            </p>
          )
        )}
        {!ready && <Footnotes verses={verses} />}
      </footer>
      {isTest && !ready && <div className="test-banner-room" aria-hidden="true" />}
    </main>
  )
}
