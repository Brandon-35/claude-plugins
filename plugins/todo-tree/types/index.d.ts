declare module 'claude-code' {
  interface PluginState {
    'todo-tree': {
      tag: string | null
      selected: { file: string; line: number } | null
    }
  }
}
