export type Bookmark = {
  file: string
  line: number
  note: string
  addedAt: string
}

export const ROOT_ARGV = ['git', '--no-pager', 'rev-parse', '--show-toplevel']

const CONTEXT_BUDGET = 2000

export const storeKey = (root: string) => `bookmarks:${root}`

export const idOf = (b: Pick<Bookmark, 'file' | 'line'>) => `${b.file}:${b.line}`

/** Parses `file[:line] note…`; the line defaults to 1. */
export function parseArgs(
  args: string,
): { file: string; line: number; note: string } | { error: string } {
  const match = /^(\S+)\s*([\s\S]*)$/.exec(args.trim())
  if (!match) return { error: 'Usage: /bookmark <file>[:line] [note]' }
  const target = match[1] ?? ''
  const note = (match[2] ?? '').trim()
  const colon = target.lastIndexOf(':')
  if (colon === -1) return { file: target, line: 1, note }
  const file = target.slice(0, colon)
  const rawLine = target.slice(colon + 1)
  if (file === '' || !/^[1-9]\d*$/.test(rawLine)) {
    return { error: `Bad line number in ${target}` }
  }
  return { file, line: Number(rawLine), note }
}

/** Makes `file` relative to the project root when it was given absolute or with `./`. */
export function relativeTo(root: string, file: string): string {
  if (file.startsWith(`${root}/`)) return file.slice(root.length + 1)
  return file.startsWith('./') ? file.slice(2) : file
}

/** Keeps only well-formed entries of whatever the store holds. */
export function asBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (b): b is Bookmark =>
      typeof b === 'object' &&
      b !== null &&
      typeof b.file === 'string' &&
      Number.isInteger(b.line) &&
      typeof b.note === 'string' &&
      typeof b.addedAt === 'string',
  )
}

/** Adds `bookmark`, replacing one already at the same file and line. */
export function addBookmark(list: readonly Bookmark[], bookmark: Bookmark): Bookmark[] {
  return [...list.filter(b => idOf(b) !== idOf(bookmark)), bookmark]
}

export function sortBookmarks(list: readonly Bookmark[]): Bookmark[] {
  return [...list].sort(
    (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line,
  )
}

export function lineCount(text: string): number {
  const lines = text.split('\n').length
  return Math.max(1, text.endsWith('\n') ? lines - 1 : lines)
}

/** The lines `line-5 .. line+10` of `text` and the number of the first one. */
export function excerpt(text: string, line: number): { source: string; first: number } {
  const first = Math.max(1, line - 5)
  return {
    source: text
      .split('\n')
      .slice(first - 1, line + 10)
      .join('\n'),
    first,
  }
}

/** The hidden note for the model: one `file:line  note` per bookmark, under 2,000 characters. */
export function contextText(list: readonly Bookmark[]): string {
  const rows = sortBookmarks(list).map(b => `${idOf(b)}  ${b.note}`.trimEnd())
  let text = 'Bookmarks in this project (file:line  note):'
  for (const [i, row] of rows.entries()) {
    const more = `\n… ${rows.length - i} more`
    // Reserve room for the cut line unless this is the last row.
    const reserve = i === rows.length - 1 ? 0 : more.length + 1
    if (text.length + 1 + row.length + reserve > CONTEXT_BUDGET) return text + more
    text += `\n${row}`
  }
  return text
}
