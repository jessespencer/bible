import type { Book } from './bible'
import { today, writeStore } from './memory'
import { cleanWord, type Token } from './text'

// Optimal string alignment distance, which counts a swapped pair of letters as one slip.
export const editDistance = (a: string, b: string) => {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
      }
    }
  }
  return rows[a.length][b.length]
}

export const TYPO_MIN_LENGTH = 5

// Case, accents and punctuation never count. A word of five letters or more may carry one slip.
export const judgeWord = (expected: string, typed: string): 'right' | 'typo' | 'wrong' => {
  const want = cleanWord(expected)
  const got = cleanWord(typed)
  if (!got) return 'wrong'
  if (want === got) return 'right'
  if (want.length >= TYPO_MIN_LENGTH && editDistance(want, got) <= 1) return 'typo'
  return 'wrong'
}

// Forgiving match: speech engines hear "unto" as "onto", so a close spelling counts.
export const sounds = (expected: string, heard: string) => {
  if (expected === heard) return true
  if (expected.length < 4 || heard.length < 4) return false
  return expected.slice(0, 3) === heard.slice(0, 3)
}

const heardWords = (transcript: string) => transcript.split(/\s+/).map(cleanWord).filter(Boolean)

const LOOKAHEAD = 4
const RESYNC_REACH = 80

// Follows a recital live. It keeps close to the last word it matched, but when three words
// in a row are heard further on, the reciter has skipped ahead and it jumps to them.
export const alignSpeech = (tokens: Token[], transcript: string) => {
  const words = tokens.map((t) => cleanWord(t.word))
  const heard = heardWords(transcript)
  const skipped = new Set<number>()
  let position = 0
  const moveTo = (index: number) => {
    for (let s = position; s < index; s++) skipped.add(tokens[s].id)
  }
  heard.forEach((word, h) => {
    for (let i = position; i < Math.min(position + LOOKAHEAD, tokens.length); i++) {
      if (sounds(words[i], word)) {
        moveTo(i)
        position = i + 1
        return
      }
    }
    if (h < 2) return
    const run = heard.slice(h - 2, h + 1)
    for (let i = position; i + run.length <= Math.min(tokens.length, position + RESYNC_REACH); i++) {
      if (run.every((w, k) => sounds(words[i + k], w))) {
        moveTo(i)
        position = i + run.length
        return
      }
    }
  })
  return { position, skipped }
}

/**
 * Scores a whole recital once it is over. Unlike the live follower it sees everything at
 * once, so it lines the transcript up with the text the way a diff does and a skipped phrase
 * costs only its own words. A stray word matched far ahead, alone, does not count as reaching
 * that far: only matches with a neighbour close by do.
 */
export const scoreSpeech = (tokens: Token[], transcript: string, finished = false) => {
  const words = tokens.map((t) => cleanWord(t.word))
  const heard = heardWords(transcript)
  const n = heard.length
  const m = words.length
  const width = m + 1
  const table = new Uint32Array((n + 1) * width)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      table[i * width + j] = sounds(words[j - 1], heard[i - 1])
        ? table[(i - 1) * width + j - 1] + 1
        : Math.max(table[(i - 1) * width + j], table[i * width + j - 1])
    }
  }
  const matched: number[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    const here = table[i * width + j]
    if (sounds(words[j - 1], heard[i - 1]) && here === table[(i - 1) * width + j - 1] + 1) {
      matched.push(j - 1)
      i -= 1
      j -= 1
    } else if (table[(i - 1) * width + j] >= table[i * width + j - 1]) i -= 1
    else j -= 1
  }
  matched.reverse()

  let reached = 0
  if (finished) reached = m
  else if (matched.length === 1) reached = matched[0] + 1
  else {
    matched.forEach((index, k) => {
      const near = (other: number | undefined) => other !== undefined && Math.abs(other - index) <= 3
      if (near(matched[k - 1]) || near(matched[k + 1])) reached = index + 1
    })
  }
  const hit = new Set(matched)
  const missed = new Set<number>()
  for (let t = 0; t < reached; t++) if (!hit.has(t)) missed.add(tokens[t].id)
  return { reached, missed }
}

export interface VerseScore {
  chapter: number
  verse: number
  words: number
  missed: number
  typos: number
  clean: boolean
  // Only verses with a miss or a slip keep their text, for the scorecard to mark where.
  tokens?: Token[]
  missedIds?: number[]
  typoIds?: number[]
}

// A verse counts once three quarters of it is reached. Stopping earlier leaves it out
// altogether, so a test can end wherever you choose without failing what comes after.
export const VERSE_REACHED = 0.75

export const isClean = (words: number, missed: number) => missed <= Math.floor(words / 20)

export const scoreVerses = (
  tokens: Token[],
  verses: { chapter: number; verse: number }[],
  reached: number,
  missed: Set<number>,
  typos: Set<number> = new Set(),
): VerseScore[] =>
  verses.flatMap((verse, verseIndex) => {
    const own = tokens.filter((t) => t.verseIndex === verseIndex)
    if (!own.length) return []
    const reachedHere = own.filter((t) => t.id < reached).length
    if (reachedHere / own.length < VERSE_REACHED) return []
    const missedIds = own.filter((t) => t.id >= reached || missed.has(t.id)).map((t) => t.id)
    const typoIds = own.filter((t) => typos.has(t.id) && !missedIds.includes(t.id)).map((t) => t.id)
    const clean = isClean(own.length, missedIds.length)
    return [
      {
        chapter: verse.chapter,
        verse: verse.verse,
        words: own.length,
        missed: missedIds.length,
        typos: typoIds.length,
        clean,
        ...(missedIds.length || typoIds.length ? { tokens: own, missedIds, typoIds } : {}),
      },
    ]
  })

export type TestMode = 'speaking' | 'words' | 'initials'

export interface TestScore {
  recalled: number
  words: number
  seconds: number
  date: string
}

export interface TestRecord {
  last: TestScore
  best: TestScore
}

const testsStore = 'byheart.tests'

export const loadTests = (): Record<string, TestRecord> => {
  try {
    return (JSON.parse(localStorage.getItem(testsStore) ?? '{}') ?? {}) as Record<string, TestRecord>
  } catch {
    return {}
  }
}

// Scores only compare within one passage recited one way, so the key holds both.
export const testKey = (translation: string, book: string, scored: VerseScore[], mode: TestMode) => {
  const first = scored[0]
  const last = scored[scored.length - 1]
  return `${translation}:${book}:${first.chapter}:${first.verse}-${last.chapter}:${last.verse}:${mode}`
}

export const share = (s: Pick<TestScore, 'recalled' | 'words'>) => (s.words ? s.recalled / s.words : 0)

export const recordTest = (key: string, score: Omit<TestScore, 'date'>) => {
  const tests = loadTests()
  const previous = tests[key]
  const dated = { ...score, date: today() }
  const best = !previous || share(dated) >= share(previous.best) ? dated : previous.best
  writeStore(testsStore, JSON.stringify({ ...tests, [key]: { last: dated, best } }))
  return previous
}

interface Place {
  chapter: number
  verse: number
}

export const rangeLabel = (book: Book, from: Place, to: Place) => {
  if (from.chapter !== to.chapter) return `${book.name} ${from.chapter}:${from.verse}–${to.chapter}:${to.verse}`
  if (from.verse === to.verse) return `${book.name} ${from.chapter}:${from.verse}`
  return `${book.name} ${from.chapter}:${from.verse}–${to.verse}`
}

// Whole chapters are asked for with an open end, so they are named as chapters.
export const askedLabel = (book: Book, items: { chapter: number; from: number; to: number }[]) => {
  const first = items[0]
  const last = items[items.length - 1]
  if (items.every((i) => i.from === 1 && i.to === 999)) {
    if (items.length === book.chapters) return book.name
    return first.chapter === last.chapter ? `${book.name} ${first.chapter}` : `${book.name} ${first.chapter}–${last.chapter}`
  }
  return rangeLabel(book, { chapter: first.chapter, verse: first.from }, { chapter: last.chapter, verse: last.to })
}
