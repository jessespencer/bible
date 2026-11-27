import { writeStore } from './memory'

export type Typing = 'initials' | 'words'
export type TestBy = 'typing' | 'speaking'

export interface Settings {
  typing: Typing
  testBy: TestBy
}

const settingsStore = 'byheart.settings'
const defaults: Settings = { typing: 'words', testBy: 'typing' }
// Typing once defaulted to first letters and was saved along with any other change. Settings
// saved before whole words became the default keep their test choice but start on whole words.
const VERSION = 2

export const loadSettings = (): Settings => {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsStore) ?? '{}') as Partial<Settings> & { version?: number }
    return {
      typing: saved.version === VERSION && saved.typing === 'initials' ? 'initials' : defaults.typing,
      testBy: saved.testBy === 'speaking' ? 'speaking' : defaults.testBy,
    }
  } catch {
    return defaults
  }
}

export const saveSettings = (settings: Settings) => writeStore(settingsStore, JSON.stringify({ ...settings, version: VERSION }))
