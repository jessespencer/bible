import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const recite = async (translation: string) => {
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
  await userEvent.click(screen.getByRole('button', { name: 'Begin' }))
}

beforeEach(() => {
  fetchChapter.mockReset()
  fetchChapter.mockImplementation(async (_: string, __: unknown, ___: number, part = 0) =>
    [verses(1, 9), verses(10, 17), verses(18, 25)][part],
  )
})

describe('Session in the ESV', () => {
  it('recites a chapter over half its book one part at a time', async () => {
    await recite('ESV')
    expect(await screen.findByRole('heading', { name: 'Jude 1:1–9' })).toBeInTheDocument()
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument()
    expect(fetchChapter).toHaveBeenCalledWith('ESV', expect.anything(), 1, 0)
    expect(fetchChapter).toHaveBeenCalledTimes(1)
  })

  it('carries Crossway’s notice and a link to www.esv.org beside the text', async () => {
    await recite('ESV')
    await screen.findByRole('heading', { name: 'Jude 1:1–9' })
    const hint = document.querySelector('.session-hint') as HTMLElement
    expect(hint).toHaveTextContent(/Scripture quotations are from the ESV® Bible/)
    expect(screen.getByRole('link', { name: 'www.esv.org' })).toHaveAttribute('href', 'https://www.esv.org')
    expect(screen.getByText('ESV', { exact: false, selector: '.session-count' })).toBeInTheDocument()
  })

  it('recites a public-domain chapter whole', async () => {
    fetchChapter.mockImplementation(async () => verses(1, 25))
    await recite('BSB')
    expect(await screen.findByRole('heading', { name: 'Jude 1:1–25' })).toBeInTheDocument()
    expect(screen.queryByText(/of 3/)).not.toBeInTheDocument()
  })
})

describe('A recital as a test', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchChapter.mockImplementation(async () => verses(1, 25))
  })

  const begin = async (onRecord = vi.fn()) => {
    const user = userEvent.setup()
    render(
      <Session
        items={[{ kind: 'run', chapter: 1, from: 1, to: 25 }]}
        book={getBook('JUD')}
        translation="BSB"
        progress={{}}
        onRecord={onRecord}
        onExit={() => {}}
      />,
    )
    expect(await screen.findByRole('heading', { name: 'Jude 1:1–25' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Type every word' }))
    await user.click(screen.getByRole('button', { name: 'Begin' }))
    return user
  }

  it('waits for you to begin before showing the passage', async () => {
    await begin()
    expect(screen.getByText('Testing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByLabelText('Type each word')).toBeInTheDocument()
  })

  it('scores only what was reached when stopped, and grades only those verses', async () => {
    const onRecord = vi.fn()
    const user = await begin(onRecord)
    await user.type(screen.getByLabelText('Type each word'), 'words of 1 words of 2 ')
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('heading', { name: '100%' })).toBeInTheDocument()
    expect(screen.getByText('6 of 6 words by heart')).toBeInTheDocument()
    expect(screen.getByText(/Jude 1:1–2 · BSB · typed in full/)).toBeInTheDocument()
    expect(onRecord.mock.calls.map(([key]) => key)).toEqual(['BSB:JUD:1:1', 'BSB:JUD:1:2'])
  })

  it('marks the words given to you and remembers the score', async () => {
    const user = await begin()
    await user.type(screen.getByLabelText('Type each word'), 'words xx yy 1 ')
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('heading', { name: '67%' })).toBeInTheDocument()
    expect(screen.getByText('1 missed')).toBeInTheDocument()
    expect(document.querySelector('.score-slip .w-helped')).toHaveTextContent('of')
    expect(JSON.parse(localStorage.getItem('byheart.tests')!)).toHaveProperty(['BSB:JUD:1:1-1:1:words'])
  })
})
