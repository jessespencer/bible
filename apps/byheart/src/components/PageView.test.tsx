import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBook, type Verse } from '../lib/bible'
import { PageView } from './PageView'

const fetchChapter = vi.hoisted(() => vi.fn())

vi.mock('../lib/bible', async (original) => ({
  ...(await original<typeof import('../lib/bible')>()),
  fetchChapter,
}))

const onStart = vi.fn()

const chapterIn = (translation: string): Verse[] =>
  Array.from({ length: 3 }, (_, i) => ({ chapter: 1, verse: i + 1, text: `${translation} words of 1:${i + 1}.` }))

// A load that waits until the test lets it finish.
const held = () => {
  let finish: (verses: Verse[]) => void = () => {}
  const promise = new Promise<Verse[]>((resolve) => (finish = resolve))
  return { promise, finish }
}

const page = (translation: string, code = 'EPH') => (
  <PageView
    book={getBook(code)}
    chapter={1}
    translation={translation}
    progress={{}}
    theme="dark"
    onBook={() => {}}
    onChapter={() => {}}
    onTranslation={() => {}}
    onTheme={() => {}}
    onStart={onStart}
  />
)

const leaf = () => document.querySelector('.leaf')!

beforeEach(() => {
  onStart.mockClear()
  fetchChapter.mockReset()
  fetchChapter.mockImplementation(async (translation: string) => chapterIn(translation))
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'startViewTransition')
})

describe('PageView', () => {
  it('keeps the last translation printed while the next one loads', async () => {
    const { rerender } = render(page('BSB'))
    await screen.findByText(/BSB words of 1:1/)

    const next = held()
    fetchChapter.mockReturnValueOnce(next.promise)
    rerender(page('KJV'))

    expect(screen.getByText(/BSB words of 1:1/)).toBeInTheDocument()
    expect(leaf()).toHaveClass('leaf-waiting')

    await act(async () => next.finish(chapterIn('KJV')))
    expect(screen.getByText(/KJV words of 1:1/)).toBeInTheDocument()
    expect(screen.queryByText(/BSB words of 1:1/)).not.toBeInTheDocument()
    expect(leaf()).not.toHaveClass('leaf-waiting')
  })

  it('holds the page with a skeleton while another book loads, then lets its words rise in', async () => {
    const { rerender } = render(page('BSB'))
    await screen.findByText(/BSB words of 1:1/)

    const next = held()
    fetchChapter.mockReturnValueOnce(next.promise)
    rerender(page('BSB', 'PHP'))

    expect(screen.queryByText(/BSB words of 1:1/)).not.toBeInTheDocument()
    expect(leaf()).toHaveClass('leaf-skeleton')
    expect(leaf()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Opening the book…' })).toBeDisabled()

    await act(async () => next.finish(chapterIn('BSB')))
    expect(leaf()).not.toHaveClass('leaf-skeleton')
    expect(leaf()).toHaveClass('leaf-arrive')
  })

  it('does not start a session from a page that is still giving way', async () => {
    const { rerender } = render(page('BSB'))
    await screen.findByText(/BSB words of 1:1/)
    fetchChapter.mockReturnValueOnce(held().promise)
    rerender(page('KJV'))

    await userEvent.setup().click(screen.getByRole('button', { name: 'Learn verse 1' }))
    expect(onStart).not.toHaveBeenCalled()
  })

  it('turns to the next page with a view transition, but prints the first one plainly', async () => {
    const startViewTransition = vi.fn((update: () => void) => {
      update()
      return { ready: Promise.resolve(), finished: Promise.resolve() }
    })
    Object.assign(document, { startViewTransition })

    const { rerender } = render(page('BSB'))
    await screen.findByText(/BSB words of 1:1/)
    expect(startViewTransition).not.toHaveBeenCalled()
    expect(leaf()).toHaveClass('leaf-arrive')

    rerender(page('KJV'))
    await screen.findByText(/KJV words of 1:1/)
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(leaf()).not.toHaveClass('leaf-arrive')
  })
})

// What a part of Jude would hold: Crossway lets a page show no more than half the book.
const judeParts: [number, number][] = [
  [1, 9],
  [10, 17],
  [18, 25],
]
const judePart = (part: number): Verse[] => {
  const [from, to] = judeParts[part]
  return Array.from({ length: to - from + 1 }, (_, i) => ({ chapter: 1, verse: from + i, text: `Jude words ${from + i}.` }))
}

describe('PageView in the ESV', () => {
  beforeEach(() => {
    fetchChapter.mockImplementation(async (_: string, __: unknown, ___: number, part = 0) => judePart(part))
  })

  it('prints a book of one short chapter in parts, never more than half of it at once', async () => {
    render(page('ESV', 'JUD'))
    await screen.findByText(/Jude words 1\./)
    expect(fetchChapter).toHaveBeenLastCalledWith('ESV', expect.anything(), 1, 0)
    expect(document.querySelectorAll('.leaf .verse')).toHaveLength(9)
    expect(screen.queryByText(/Jude words 10\./)).not.toBeInTheDocument()

    const parts = screen.getByRole('navigation', { name: 'Parts of Jude' })
    expect(within(parts).getAllByRole('button').map((b) => b.textContent)).toEqual(['1–9', '10–17', '18–25'])
    expect(within(parts).getByRole('button', { name: 'Verses 1 to 9' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(/no more than half of Jude, 12 verses/)).toBeInTheDocument()
  })

  it('turns to the next part from the end of the page or from the parts', async () => {
    const user = userEvent.setup()
    render(page('ESV', 'JUD'))
    await screen.findByText(/Jude words 1\./)

    await user.click(screen.getByRole('button', { name: 'Read on: verses 10–17' }))
    await screen.findByText(/Jude words 10\./)
    expect(screen.queryByText(/Jude words 1\./)).not.toBeInTheDocument()
    expect(fetchChapter).toHaveBeenLastCalledWith('ESV', expect.anything(), 1, 1)

    await user.click(screen.getByRole('button', { name: 'Verses 18 to 25' }))
    await screen.findByText(/Jude words 25\./)
    expect(screen.queryByRole('button', { name: /Read on/ })).not.toBeInTheDocument()
  })

  it('recites the whole chapter, which the recital splits at the same breaks', async () => {
    const user = userEvent.setup()
    render(page('ESV', 'JUD'))
    await screen.findByText(/Jude words 1\./)
    await user.click(screen.getByRole('button', { name: 'Recite chapter 1' }))
    expect(onStart).toHaveBeenCalledWith([{ kind: 'run', chapter: 1, from: 1, to: 25 }])
  })

  it('prints a chapter within the limit whole', async () => {
    fetchChapter.mockImplementation(async (translation: string) => chapterIn(translation))
    render(page('ESV'))
    await screen.findByText(/ESV words of 1:1/)
    expect(screen.queryByRole('navigation', { name: /Parts of/ })).not.toBeInTheDocument()
  })

  it('marks the text as the ESV, links www.esv.org and keeps Crossway’s full notice behind Credits', async () => {
    render(page('ESV', 'JUD'))
    await screen.findByText(/Jude words 1\./)
    const mark = document.querySelector('.leaf .esv-mark')!
    expect(mark).toHaveTextContent('(ESV)')
    expect(mark.previousElementSibling).toHaveTextContent('Jude words 9.')
    const colophon = document.querySelector('.colophon') as HTMLElement
    expect(colophon).toHaveTextContent(/ESV® Bible © Crossway/)
    expect(colophon).not.toHaveTextContent(/Scripture quotations/)
    expect(within(colophon).getByRole('link', { name: 'esv.org' })).toHaveAttribute('href', 'https://www.esv.org')
    expect(within(colophon).getByRole('button', { name: 'Credits' })).toBeInTheDocument()
    // The full notice waits in the Credits dialog, the app's copyright page.
    const credits = document.querySelector('dialog.credits') as HTMLElement
    expect(credits).toHaveTextContent(/Scripture quotations are from the ESV® Bible/)
    expect(credits).toHaveTextContent(/more than one half of any book of the ESV Bible/)
  })
})
