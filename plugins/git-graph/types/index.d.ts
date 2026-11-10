declare module 'claude-code' {
  interface PluginState {
    'git-graph': { selected: string | null; limit: number }
  }
}
