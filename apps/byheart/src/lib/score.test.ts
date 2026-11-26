import { beforeEach, describe, expect, it } from 'vitest'
import { getBook } from './bible'
import { alignSpeech, askedLabel, judgeWord, loadTests, recordTest, scoreSpeech, scoreVerses } from './score'
import { tokenize } from './text'

const passage = tokenize([
  'In him we have redemption through his blood,',
  'the forgiveness of our trespasses, according to the riches of his grace.',
])

describe('judgeWord', () => {
  it('ignores case and punctuation', () => {
    expect(judgeWord('blood,', 'Blood')).toBe('right')
    expect(judgeWord('Lord’s', 'lords')).toBe('right')
  })

  it('forgives one slip in a word of five letters or more', () => {
    expect(judgeWord('redemption', 'redemtion')).toBe('typo')
    expect(judgeWord('grace', 'garce')).toBe('typo')
    expect(judgeWord('redemption', 'redmtion')).toBe('wrong')
  })

  it('forgives nothing in a short word', () => {
    expect(judgeWord('him', 'hum')).toBe('wrong')
  })
})

describe('alignSpeech', () => {
  it('jumps ahead when three words in a row are heard further on', () => {
    const { position, skipped } = alignSpeech(passage, 'in him we the forgiveness of our')
    expect(position).toBe(12)
    expect([...skipped].map((id) => passage[id].word)).toEqual(['have', 'redemption', 'through', 'his', 'blood'])
  })
})

describe('scoreSpeech', () => {
  it('costs a skipped phrase only its own words', () => {
    const { reached, missed } = scoreSpeech(passage, 'in him we have the forgiveness of our trespasses', false)
    expect(reached).toBe(13)
    expect([...missed].map((id) => passage[id].word)).toEqual(['redemption', 'through', 'his', 'blood'])
  })

  it('does not count a stray word far ahead as reaching it', () => {
    const { reached } = scoreSpeech(passage, 'in him we have redemption okay grace')
    expect(reached).toBe(5)
  })

  it('scores to the end once the recital is finished', () => {
    const { reached, missed } = scoreSpeech(passage, 'in him we have redemption through his blood', true)
    expect(reached).toBe(passage.length)
    expect(missed.size).toBe(passage.length - 8)
  })
})

describe('scoreVerses', () => {
  const verses = [
    { chapter: 1, verse: 7 },
    { chapter: 1, verse: 8 },
  ]

  it('leaves out a verse reached less than three quarters of the way', () => {
    const scored = scoreVerses(passage, verses, 10, new Set())
    expect(scored.map((s) => s.verse)).toEqual([7])
    expect(scored[0]).toMatchObject({ words: 8, missed: 0, clean: true })
    expect(scored[0].tokens).toBeUndefined()
  })

  it('counts the unreached end of a verse it includes as missed', () => {
    const scored = scoreVerses(passage, verses, passage.length - 1, new Set())
    expect(scored[1]).toMatchObject({ words: 12, missed: 1, clean: false, missedIds: [19] })
  })

  it('keeps the wording of a verse that stumbled', () => {
    const scored = scoreVerses(passage, verses, passage.length, new Set([0, 1]), new Set([4]))
    expect(scored[0]).toMatchObject({ missed: 2, typos: 1, clean: false, missedIds: [0, 1], typoIds: [4] })
    expect(scored[0].tokens).toHaveLength(8)
  })
})

describe('recordTest', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the last and the best score, and returns what came before', () => {
    expect(recordTest('k', { recalled: 9, words: 10, seconds: 30 })).toBeUndefined()
    const before = recordTest('k', { recalled: 7, words: 10, seconds: 20 })
    expect(before?.best.recalled).toBe(9)
    expect(loadTests().k.best.recalled).toBe(9)
    expect(loadTests().k.last.recalled).toBe(7)
  })
})

describe('askedLabel', () => {
  const eph = getBook('EPH')

  it('names whole chapters and books', () => {
    expect(askedLabel(eph, [{ chapter: 2, from: 1, to: 999 }])).toBe('Ephesians 2')
    expect(askedLabel(eph, Array.from({ length: 6 }, (_, i) => ({ chapter: i + 1, from: 1, to: 999 })))).toBe('Ephesians')
  })

  it('names a span of verses', () => {
    expect(askedLabel(eph, [{ chapter: 1, from: 3, to: 14 }])).toBe('Ephesians 1:3–14')
    expect(askedLabel(eph, [{ chapter: 1, from: 15, to: 23 }, { chapter: 2, from: 1, to: 10 }])).toBe('Ephesians 1:15–2:10')
  })
})
