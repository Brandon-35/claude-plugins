// Pure helpers: build git argv lists and parse their output. No `$` here, so
// the tests can feed them canned output.

const SEP = '\x1f'

export type GraphRow =
  | { kind: 'edge'; graph: string }
  | {
      kind: 'commit'
      graph: string
      sha: string
      refs: string
      subject: string
      author: string
      age: string
    }

export const graphArgv = (limit: number): string[] => [
  'git',
  '--no-pager',
  'log',
  '--graph',
  '--all',
  '--date-order',
  '--color=never',
  `-n${limit}`,
  `--format=${SEP}%h${SEP}%D${SEP}%s${SEP}%an${SEP}%ar`,
]

export function parseGraph(stdout: string): GraphRow[] {
  return stdout
    .split('\n')
    .filter(line => line.length > 0)
    .map((line): GraphRow => {
      const parts = line.split(SEP)
      if (parts.length < 6) return { kind: 'edge', graph: line }
      const [graph = '', sha = '', refs = '', subject = '', author = '', age = ''] =
        parts
      return { kind: 'commit', graph, sha, refs, subject, author, age }
    })
}

export const showArgv = (sha: string): string[] => [
  'git',
  '--no-pager',
  'show',
  '--color=never',
  '--stat',
  '--patch',
  '--format=commit %H%nAuthor: %an <%ae>%nDate:   %ad%nRefs:   %D%n%n%B%x1e',
  sha,
]

export type FileDiff = { path: string; hunks: string }

export type CommitDetail = { header: string; stat: string; files: FileDiff[] }

// Splits `git show --stat --patch` output (header, \x1e, stat, patch) into the
// header text, the stat block and one unified diff per file.
export function parseShow(stdout: string): CommitDetail {
  const [header = '', rest = ''] = stdout.split('\x1e')
  const firstDiff = rest.indexOf('\ndiff --git ')
  const stat = (firstDiff === -1 ? rest : rest.slice(0, firstDiff)).trim()
  const patch = firstDiff === -1 ? '' : rest.slice(firstDiff + 1)
  return { header: header.trim(), stat, files: splitPatch(patch) }
}

// One entry per `diff --git` block, keeping only the `@@` hunks, which is
// what a `Code format="diff"` element parses.
export function splitPatch(patch: string): FileDiff[] {
  const files: FileDiff[] = []
  for (const block of patch.split(/^diff --git /m).slice(1)) {
    const lines = block.split('\n')
    const plus = lines.find(l => l.startsWith('+++ '))
    const minus = lines.find(l => l.startsWith('--- '))
    const named = plus && plus !== '+++ /dev/null' ? plus : minus
    const first = lines[0] ?? ''
    const path = named
      ? named.slice(4).replace(/^[ab]\//, '')
      : first.split(' b/')[1] ?? first
    const start = lines.findIndex(l => l.startsWith('@@'))
    const hunks = start === -1 ? '' : lines.slice(start).join('\n').trimEnd()
    files.push({ path, hunks })
  }
  return files
}
