import { writeStore } from './memory'

export type Typing = 'initials' | 'words'
export type TestBy = 'typing' | 'speaking'

export interface Settings {
  typing: Typing
  testBy: TestBy
}

const settingsStore = 'byheart.settings'
const defaults: Settings = { typing: 'initials', testBy: 'typing' }

export const loadSettings = (): Settings => {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsStore) ?? '{}') as Partial<Settings>
    return {
      typing: saved.typing === 'words' ? 'words' : defaults.typing,
      testBy: saved.testBy === 'speaking' ? 'speaking' : defaults.testBy,
    }
  } catch {
    return defaults
  }
}

export const saveSettings = (settings: Settings) => writeStore(settingsStore, JSON.stringify(settings))
