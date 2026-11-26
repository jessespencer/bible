import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { senseLines, tokenize } from '../lib/text'
import { TypedStage } from './stages'

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
