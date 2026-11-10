declare module 'claude-code' {
  interface PluginState {
    'git-compare': {
      mode: 'refs' | 'dirs' | null
      a: string
      b: string
      selected: string | null
    }
  }
}
