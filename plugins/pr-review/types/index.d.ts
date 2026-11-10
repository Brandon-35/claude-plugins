declare module 'claude-code' {
  interface PluginState {
    'pr-review': { pr: number | null; file: string | null }
  }
}
