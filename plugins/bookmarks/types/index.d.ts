declare module 'claude-code' {
  interface PluginState {
    bookmarks: {
      root: string
      list: { file: string; line: number; note: string; addedAt: string }[]
      selected: string | null
    }
  }
}
