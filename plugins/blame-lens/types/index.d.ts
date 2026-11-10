declare module 'claude-code' {
  interface PluginState {
    'blame-lens': { notes: StateFamily<string[]> }
  }
}
