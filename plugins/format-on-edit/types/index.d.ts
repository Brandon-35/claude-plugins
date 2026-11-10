declare module 'claude-code' {
  interface PluginState {
    'format-on-edit': {
      enabled: boolean
      count: number
      outcomes: StateFamily<Outcome>
    }
  }
}

export type Outcome = { status: 'none' | 'formatted' | 'unchanged' } | { status: 'failed'; error: string }
