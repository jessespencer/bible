import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BOOKS,
  chapterParts,
  esvLimit,
  esvVersesHeld,
  fetchChapter,
  getBook,
  parseVerses,
  splitAtParts,
} from './bible'

// A stand-in for api.esv.org that answers any "Book c:a-b" or "Book c" with numbered verses.
const passage = (q: string) => {
  const [, name, chapter, from, to] = q.match(/^(.*?) (\d+)(?::(\d+)-(\d+))?$/) ?? [, q, '1']
  const book = BOOKS.find((b) => b.name === name)!
  const last = to ? Number(to) : ({ JON: [17, 10, 10, 11], JUD: [25] } as Record<string, number[]>)[book.code][Number(chapter) - 1]
  const first = from ? Number(from) : 1
  return Array.from({ length: last - first + 1 }, (_, i) => `[${first + i}] Words of ${chapter}:${first + i}.`).join(' ')
}

const requests: string[] = []

beforeEach(() => {
  localStorage.setItem('byheart.esvKey', 'test-key')
  requests.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const q = new URL(url).searchParams.get('q')!
      requests.push(q)
      return new Response(JSON.stringify({ passages: [`${passage(q)} (ESV)`] }))
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

describe('the ESV limit', () => {
  it('is half the book, or 500 verses, whichever is less', () => {
    expect(esvLimit(getBook('JUD'))).toBe(12)
    expect(esvLimit(getBook('JON'))).toBe(24)
    expect(esvLimit(getBook('3JN'))).toBe(7)
    expect(esvLimit(getBook('PSA'))).toBe(500)
  })

  it('prints a chapter over half its book in even parts', () => {
    expect(chapterParts('ESV', getBook('JUD'), 1)).toEqual([
      [1, 9],
      [10, 17],
      [18, 25],
    ])
    expect(chapterParts('ESV', getBook('HAG'), 2)).toEqual([
      [1, 12],
      [13, 23],
    ])
    expect(chapterParts('ESV', getBook('3JN'), 1).at(-1)![1]).toBe(15)
  })

  it('leaves every other chapter whole, and every other translation', () => {
    expect(chapterParts('ESV', getBook('HAG'), 1)).toHaveLength(1)
    expect(chapterParts('ESV', getBook('EPH'), 1)).toHaveLength(1)
    expect(chapterParts('BSB', getBook('JUD'), 1)).toHaveLength(1)
    expect(chapterParts('NIV', getBook('JUD'), 1)).toHaveLength(1)
  })

  it('never makes a part longer than the limit, in any book', () => {
    for (const book of BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        for (const [from, to] of chapterParts('ESV', book, chapter)) {
          if (to !== 999) expect(to - from + 1).toBeLessThanOrEqual(esvLimit(book))
        }
      }
    }
  })

  it('cuts a run at the part breaks', () => {
    expect(splitAtParts('ESV', getBook('JUD'), [{ chapter: 1, from: 5, to: 999 }])).toEqual([
      { chapter: 1, from: 5, to: 9 },
      { chapter: 1, from: 10, to: 17 },
      { chapter: 1, from: 18, to: 25 },
    ])
    expect(splitAtParts('BSB', getBook('JUD'), [{ chapter: 1, from: 1, to: 999 }])).toHaveLength(1)
  })
})

describe('reading the ESV', () => {
  it('asks Crossway for one part at a time and keeps only that part', async () => {
    const verses = await fetchChapter('ESV', getBook('JUD'), 1, 1)
    expect(requests).toEqual(['Jude 1:10-17'])
    expect(verses.map((v) => v.verse)).toEqual([10, 11, 12, 13, 14, 15, 16, 17])
    expect(verses.at(-1)!.text).toBe('Words of 1:17.')
  })

  it('never holds more than half of a book, even across its parts', async () => {
    const jude = getBook('JUD')
    await fetchChapter('ESV', jude, 1, 0)
    await fetchChapter('ESV', jude, 1, 1)
    await fetchChapter('ESV', jude, 1, 2)
    expect(esvVersesHeld(jude)).toBeLessThanOrEqual(12)
  })

  it('lets go of the older chapter when two would pass half the book', async () => {
    const jonah = getBook('JON')
    await fetchChapter('ESV', jonah, 1)
    expect(esvVersesHeld(jonah)).toBe(17)
    await fetchChapter('ESV', jonah, 2)
    expect(esvVersesHeld(jonah)).toBe(10)
    await fetchChapter('ESV', jonah, 3)
    expect(esvVersesHeld(jonah)).toBe(20)
  })

  it('reads a held part again without asking Crossway', async () => {
    const jonah = getBook('JON')
    await fetchChapter('ESV', jonah, 4)
    await fetchChapter('ESV', jonah, 4)
    expect(requests).toEqual(['Jonah 4'])
  })
})

describe('parseVerses', () => {
  it('numbers unmarked opening text from where the part begins', () => {
    expect(parseVerses('Opening words. [11] Next words. (ESV)', 1, 10)).toEqual([
      { chapter: 1, verse: 10, text: 'Opening words.' },
      { chapter: 1, verse: 11, text: 'Next words.' },
    ])
  })
})
