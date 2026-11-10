// Pure helpers: eslint discovery paths, argv, JSON parser and text formatting.

import type { Problem, Report } from '../types'

const LINTABLE = /\.(js|jsx|ts|tsx|mjs|cjs|vue)$/

export const isLintable = (file: string): boolean => LINTABLE.test(file)

export const basename = (file: string): string => file.slice(file.lastIndexOf('/') + 1)

// Every place a local eslint may sit, nearest first: the file's directory, then
// each parent up to the root. `root` is the directory holding `node_modules`.
// shortcut: POSIX absolute paths only, add `\` handling if Windows is needed.
export function candidates(file: string): { root: string; bin: string }[] {
  if (!file.startsWith('/')) return []
  const found = []
  let dir = file
  while (dir !== '') {
    dir = dir.slice(0, dir.lastIndexOf('/'))
    found.push({ root: dir || '/', bin: `${dir}/node_modules/.bin/eslint` })
  }
  return found
}

export const eslintArgv = (bin: string, file: string): string[] => [bin, '--format', 'json', '--no-color', file]

const failed = (failure: string): Report => ({ errors: 0, warnings: 0, items: [], failure })

// Exit 0 is clean and 1 is "problems found": both print JSON. 2 is a config
// error or a crash, explained on stderr.
export function parseEslint(run: { exitCode: number | null; stdout: string; stderr: string }): Report {
  if (run.exitCode !== 0 && run.exitCode !== 1) {
    return failed(run.stderr.trim().split('\n')[0] || `eslint exited with ${run.exitCode}`)
  }
  let files: unknown
  try {
    files = JSON.parse(run.stdout)
  } catch {
    return failed('eslint did not print JSON')
  }
  if (!Array.isArray(files)) return failed('eslint did not print JSON')
  const items: Problem[] = files
    .flatMap(f => (Array.isArray(f?.messages) ? f.messages : []))
    .map(m => ({
      line: Number(m.line) || 0,
      column: Number(m.column) || 0,
      severity: m.severity === 2 ? ('error' as const) : ('warning' as const),
      // A parse error has no rule.
      rule: typeof m.ruleId === 'string' ? m.ruleId : '',
      message: String(m.message).split('\n')[0] ?? '',
    }))
    .sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error') || a.line - b.line)
  const errors = items.filter(i => i.severity === 'error').length
  return { errors, warnings: items.length - errors, items }
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

// "2 errors, 1 warning"; empty for a clean report.
export const counts = (r: Report): string =>
  [r.errors && plural(r.errors, 'error'), r.warnings && plural(r.warnings, 'warning')].filter(Boolean).join(', ')

export const rowLine = (p: Problem): string => `L${p.line}:${p.column}  ${p.message}${p.rule ? `  ${p.rule}` : ''}`

const plainLine = (p: Problem): string =>
  `L${p.line}:${p.column} ${p.severity} ${p.message}${p.rule ? ` (${p.rule})` : ''}`

// The block the model reads after the tool's result.
export function modelBlock(file: string, r: Report, max = 10): string {
  const more = r.items.length - max
  return [
    `error-lens: eslint found ${counts(r)} in ${basename(file)}:`,
    ...r.items.slice(0, max).map(plainLine),
    ...(more > 0 ? [`… ${more} more`] : []),
  ].join('\n')
}

// /problems: the latest report of every file that still has problems.
export function problemsText(files: Record<string, Report>): string {
  const blocks = Object.entries(files)
    .filter(([, r]) => r.items.length > 0)
    .map(([file, r]) => [`${file} (${counts(r)})`, ...r.items.map(p => `  ${plainLine(p)}`)].join('\n'))
  return blocks.length > 0 ? blocks.join('\n\n') : 'No problems in files edited this session.'
}
