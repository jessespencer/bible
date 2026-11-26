import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { senseLines, tokenize } from '../lib/text'
import { ReciteStage, TypedStage } from './stages'

const tokens = tokenize(['Grace to you and peace from God our Father.'])

const trace = (onDone = vi.fn()) => {
  render(
    <TypedStage
      tokens={tokens}
      lines={senseLines(tokens)}
      reveal="ghost"
      targets={tokens.map((t) => t.id)}
      typing="words"
      onDone={onDone}
    />,
  )
  return screen.getByLabelText('Type each word')
}

describe('TypedStage with whole words', () => {
  it('checks a word when it is finished with a space', async () => {
    const input = trace()
    await userEvent.type(input, 'Grace')
    expect(document.querySelector('.w-done')).toBeNull()
    await userEvent.type(input, ' ')
    expect(document.querySelector('.w-done')).toHaveTextContent('Grace')
    expect(input).toHaveValue('')
  })

  it('shows what is typed over the current word', async () => {
    const input = trace()
    await userEvent.type(input, 'Gra')
    expect(document.querySelector('.w-current .draft')).toHaveTextContent('Gra')
  })

  it('accepts one slip in a long word, marked as a typo', async () => {
    const input = trace()
    await userEvent.type(input, 'Grcae ')
    expect(document.querySelector('.w-typo')).toHaveTextContent('Grace')
  })

  it('does not take a word out of the start of a longer one', async () => {
    const input = trace()
    await userEvent.type(input, 'grace tooth ')
    expect(document.querySelector('.w-done')).toHaveTextContent('Grace')
    expect(document.querySelector('.w-current')).toHaveTextContent('to')
  })

  it('gives the word after two misses', async () => {
    const onDone = vi.fn()
    const input = trace(onDone)
    await userEvent.type(input, 'grace tu too ')
    expect(document.querySelector('.w-helped')).toHaveTextContent('to')
    await userEvent.type(input, 'you and peace from God our Father')
    expect(onDone).toHaveBeenCalledWith(new Set([1]), new Set())
  })
})

describe('ReciteStage', () => {
  // A stand-in for the browser's recogniser that lets a test say what it heard.
  class FakeRecognition {
    static last: FakeRecognition
    continuous = false
    interimResults = false
    lang = ''
    onresult: ((e: { results: { 0: { transcript: string }; isFinal: boolean }[] }) => void) | null = null
    onerror = null
    onend = null
    constructor() {
      FakeRecognition.last = this
    }
    start() {}
    stop() {}
    hear(...results: string[]) {
      this.send(results.map((transcript) => ({ transcript, isFinal: true })))
    }
    send(results: { transcript: string; isFinal: boolean }[]) {
      act(() => this.onresult?.({ results: results.map(({ transcript, isFinal }) => ({ 0: { transcript }, isFinal })) }))
    }
  }

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition
  })

  it('keeps what was heard when the browser starts its results afresh mid-recital', () => {
    ;(window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition
    const onHeard = vi.fn()
    render(<ReciteStage tokens={tokens} lines={senseLines(tokens)} onDone={vi.fn()} onHeard={onHeard} onProblem={vi.fn()} />)
    FakeRecognition.last.hear('grace to you', 'and peace')
    // Safari can drop the earlier results without ending the session.
    FakeRecognition.last.hear('from god')
    const [transcript, live] = onHeard.mock.lastCall!
    expect(transcript).toMatch(/grace to you and peace\s+from god/)
    expect(live.position).toBe(7)
    expect(live.matched.size).toBe(7)
  })

  it('does not hear a phrase twice when Chrome settles several interim results into one', () => {
    ;(window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition
    const onHeard = vi.fn()
    render(<ReciteStage tokens={tokens} lines={senseLines(tokens)} onDone={vi.fn()} onHeard={onHeard} onProblem={vi.fn()} />)
    FakeRecognition.last.send([
      { transcript: 'grace to', isFinal: false },
      { transcript: ' you', isFinal: false },
    ])
    // The list shrinks as the two interim results settle into one final result.
    FakeRecognition.last.send([{ transcript: 'grace to you', isFinal: true }])
    const [transcript, live] = onHeard.mock.lastCall!
    expect(transcript.trim()).toBe('grace to you')
    expect(live.resets).toBe(0)
    expect(live.position).toBe(3)
    expect(live.matched.size).toBe(3)
  })
})
