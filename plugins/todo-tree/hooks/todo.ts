// Pure helpers: build the git grep argv and parse its output. No `$` here, so
// the tests can feed them canned output.

export const TAGS = ['TODO', 'FIXME', 'HACK', 'BUG', 'XXX'] as const
export type Tag = (typeof TAGS)[number]

export type Todo = { file: string; line: number; tag: Tag; text: string }

const TEXT_MAX = 120

// The tag a `/todos` argument names, null for no argument, undefined if unknown.
export function parseTag(args: string): Tag | null | undefined {
  const asked = args.trim().toUpperCase()
  if (asked === '') return null
  return TAGS.find(tag => tag === asked)
}

const alternatives = (tag: Tag | null): string =>
  `(${tag ?? TAGS.join('|')})`

export const grepArgv = (tag: Tag | null): string[] => [
  'git',
  '--no-pager',
  'grep',
  '-n',
  '-I',
  '--color=never',
  '--untracked',
  // -w, not \b: the POSIX ERE of macOS git has no \b and would match nothing.
  '-w',
  '-E',
  alternatives(tag),
  '--',
]

// Each line is `path:line:text`, split on the first two colons.
export function parseGrep(stdout: string, tag: Tag | null = null): Todo[] {
  const tagRe = new RegExp(`\\b${alternatives(tag)}\\b`)
  const todos: Todo[] = []
  for (const row of stdout.split('\n')) {
    const m = /^(.*?):(\d+):(.*)$/.exec(row)
    const found = m && tagRe.exec(m[3] ?? '')
    if (!m || !found) continue
    todos.push({
      file: m[1] ?? '',
      line: Number(m[2]),
      tag: found[1] as Tag,
      text: (m[3] ?? '').trim().slice(0, TEXT_MAX),
    })
  }
  return todos
}

// `12 tags  TODO 7  FIXME 3`: the total, then each tag that occurs.
export function summary(todos: Todo[]): string {
  const counts = TAGS.map(tag => ({
    tag,
    n: todos.filter(t => t.tag === tag).length,
  })).filter(c => c.n > 0)
  return [
    `${todos.length} ${todos.length === 1 ? 'tag' : 'tags'}`,
    ...counts.map(c => `${c.tag} ${c.n}`),
  ].join('  ')
}
