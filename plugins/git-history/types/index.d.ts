declare module 'claude-code' {
  interface PluginState {
    'git-history': {
      path: string | null
      selected: string | null
      selectedPaths: string[]
    }
  }
}
