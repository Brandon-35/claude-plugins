declare module 'claude-code' {
  interface PluginState {
    'error-lens': {
      rows: StateFamily<Report | null>
      files: Record<string, Report>
    }
  }
}

export type Problem = {
  line: number
  column: number
  severity: 'error' | 'warning'
  rule: string
  message: string
}

export type Report = {
  errors: number
  warnings: number
  items: Problem[]
  // Set when eslint itself failed (exit 2, non-JSON output): one line.
  failure?: string
}
