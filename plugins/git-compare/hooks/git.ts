// Pure helpers: parse command arguments, build git argv lists and parse the
// patch. No `$` here, so the tests can feed them canned output.

export type Operands = { a: string; b: string }

// Splits an argument string on spaces; "double quotes" keep spaces in one word.
export const splitArgs = (args: string): string[] =>
  [...args.matchAll(/"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2] ?? '')

const DASH = 'Arguments starting with "-" are not accepted.'

// `/compare-dirs`: exactly two operands.
export function parseDirs(args: string): Operands | { error: string } {
  const words = splitArgs(args)
  if (words.length !== 2) return { error: 'Usage: /compare-dirs <dir-a> <dir-b>' }
  if (words.some(w => w.startsWith('-'))) return { error: DASH }
  return { a: words[0] ?? '', b: words[1] ?? '' }
}

// `/compare`: `a` alone (against the working tree) or a range, or `a` and `b`
// (merge-base form). `refs` are the names to verify with rev-parse.
export function parseRefs(
  args: string,
): (Operands & { refs: string[] }) | { error: string } {
  const words = splitArgs(args)
  if (words.length < 1 || words.length > 2) {
    return { error: 'Usage: /compare <ref-a> [ref-b]' }
  }
  if (words.some(w => w.startsWith('-'))) return { error: DASH }
  const [a = '', b = ''] = words
  // A lone `x..y` / `x...y` is passed to git as it is.
  const refs = words.length === 1 ? a.split(/\.{2,3}/) : words
  return { a, b, refs: refs.filter(r => r.length > 0) }
}

export const verifyArgv = (ref: string): string[] => [
  'git',
  '--no-pager',
  'rev-parse',
  '--verify',
  '--quiet',
  `${ref}^{commit}`,
]

const DIFF = ['git', '--no-pager', '-c', 'core.quotePath=false', 'diff']
const FLAGS = ['--color=never', '--no-ext-diff', '-M']

export const refsArgv = (a: string, b: string): string[] => [
  ...DIFF,
  ...FLAGS,
  b === '' ? a : `${a}...${b}`,
  '--',
]

// `git diff --no-index` exits 1 when the sides differ: that is success.
export const dirsArgv = (a: string, b: string): string[] => [
  ...DIFF,
  '--no-index',
  ...FLAGS,
  '--',
  a,
  b,
]

export type Status = 'A' | 'M' | 'D' | 'R'

export type FileChange = {
  status: Status
  from: string
  to: string
  added: number
  removed: number
  binary: boolean
  hunks: string
}

// The path a file is listed and selected by.
export const pathOf = (f: FileChange): string => f.to || f.from

// What a row shows: `old → new` when the two sides differ.
export const labelOf = (f: FileChange): string =>
  f.from && f.to && f.from !== f.to ? `${f.from} → ${f.to}` : pathOf(f)

const strip = (s: string): string => s.replace(/\t.*$/, '').replace(/^[ab]\//, '')

// One entry per `diff --git` block; `hunks` starts at the first `@@`, which is
// what a `Code format="diff"` element parses.
export function parsePatch(patch: string): FileChange[] {
  return patch
    .split(/^diff --git /m)
    .slice(1)
    .map((block): FileChange => {
      const lines = block.split('\n')
      const start = lines.findIndex(l => l.startsWith('@@'))
      const head = start === -1 ? lines : lines.slice(0, start)
      const find = (p: string) =>
        head.find(l => l.startsWith(p))?.slice(p.length)
      const first = lines[0] ?? ''
      const same = /^a\/(.*) b\/\1$/.exec(first)
      const fallback = same?.[1] ?? first.split(' b/')[1] ?? first
      const renameFrom = find('rename from ')
      const status: Status =
        renameFrom !== undefined
          ? 'R'
          : find('new file mode ') !== undefined
            ? 'A'
            : find('deleted file mode ') !== undefined
              ? 'D'
              : 'M'
      const minus = find('--- ')
      const plus = find('+++ ')
      const from =
        status === 'A'
          ? ''
          : renameFrom ??
            (minus && minus !== '/dev/null' ? strip(minus) : fallback)
      const to =
        status === 'D'
          ? ''
          : find('rename to ') ??
            (plus && plus !== '/dev/null' ? strip(plus) : fallback)
      const body = start === -1 ? [] : lines.slice(start)
      return {
        status,
        from,
        to,
        added: body.filter(l => l.startsWith('+')).length,
        removed: body.filter(l => l.startsWith('-')).length,
        binary: head.some(l => l.startsWith('Binary files') || l === 'GIT binary patch'),
        hunks: body.join('\n').trimEnd(),
      }
    })
}

// `git diff --no-index` names each side by its full path (an absolute one
// without its leading slash): drop the two folders, so a row reads `x.txt`.
export function relativize(files: FileChange[], a: string, b: string): FileChange[] {
  const cut = (path: string, dir: string): string => {
    const root = `${dir.replace(/^\/+|\/+$/g, '')}/`
    return path.startsWith(root) ? path.slice(root.length) : path
  }
  return files.map(f => ({ ...f, from: cut(f.from, a), to: cut(f.to, b) }))
}
