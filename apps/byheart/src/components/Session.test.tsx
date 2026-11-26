import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBook, type Verse } from '../lib/bible'
import { Session } from './Session'

const fetchChapter = vi.hoisted(() => vi.fn())

vi.mock('../lib/bible', async (original) => ({
  ...(await original<typeof import('../lib/bible')>()),
  fetchChapter,
}))

const verses = (from: number, to: number): Verse[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ chapter: 1, verse: from + i, text: `Words of ${from + i}.` }))

const recite = (translation: string) =>
  render(
    <Session
      items={[{ kind: 'run', chapter: 1, from: 1, to: 25 }]}
      book={getBook('JUD')}
      translation={translation}
      progress={{}}
      onRecord={() => {}}
      onExit={() => {}}
    />,
  )

beforeEach(() => {
  fetchChapter.mockReset()
  fetchChapter.mockImplementation(async (_: string, __: unknown, ___: number, part = 0) =>
    [verses(1, 9), verses(10, 17), verses(18, 25)][part],
  )
})

describe('Session in the ESV', () => {
  it('recites a chapter over half its book one part at a time', async () => {
    recite('ESV')
    expect(await screen.findByRole('heading', { name: 'Jude 1:1–9' })).toBeInTheDocument()
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument()
    expect(fetchChapter).toHaveBeenCalledWith('ESV', expect.anything(), 1, 0)
    expect(fetchChapter).toHaveBeenCalledTimes(1)
  })

  it('carries Crossway’s notice and a link to www.esv.org beside the text', async () => {
    recite('ESV')
    await screen.findByRole('heading', { name: 'Jude 1:1–9' })
    const hint = document.querySelector('.session-hint') as HTMLElement
    expect(hint).toHaveTextContent(/Scripture quotations are from the ESV® Bible/)
    expect(screen.getByRole('link', { name: 'www.esv.org' })).toHaveAttribute('href', 'https://www.esv.org')
    expect(screen.getByText('ESV', { exact: false, selector: '.session-count' })).toBeInTheDocument()
  })

  it('recites a public-domain chapter whole', async () => {
    fetchChapter.mockImplementation(async () => verses(1, 25))
    recite('BSB')
    expect(await screen.findByRole('heading', { name: 'Jude 1:1–25' })).toBeInTheDocument()
    expect(screen.queryByText(/of 3/)).not.toBeInTheDocument()
  })
})
