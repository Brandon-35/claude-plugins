// Pure helpers: build git argv lists and parse their output. No `$` here, so
// the tests can feed them canned output.

const SEP = '\x1f'
const REC = '\x1e'

export type HistoryEntry = {
  sha: string
  date: string
  author: string
  subject: string
  // The file's path at this commit, and its previous path when renamed here.
  path: string
  oldPath: string | null
}

export const logArgv = (path: string): string[] => [
  'git',
  '--no-pager',
  'log',
  '--follow',
  '--color=never',
  '--date=short',
  '-n200',
  '--name-status',
  `--format=${REC}%h${SEP}%ad${SEP}%an${SEP}%s`,
  '--',
  path,
]

// Each record is one format line followed by the `--name-status` line(s):
// `M\tpath` or `R100\told\tnew`.
export function parseLog(stdout: string): HistoryEntry[] {
  const entries: HistoryEntry[] = []
  for (const record of stdout.split(REC)) {
    const [head = '', ...rest] = record.split('\n')
    const [sha = '', date = '', author = '', subject = ''] = head.split(SEP)
    const status = rest.find(l => /^[A-Z]\d*\t/.test(l))
    if (!sha || !status) continue
    const [code = '', a = '', b] = status.split('\t')
    const renamed = code.startsWith('R') && b !== undefined
    entries.push({
      sha,
      date,
      author,
      subject,
      path: renamed ? b : a,
      oldPath: renamed ? a : null,
    })
  }
  return entries
}

// `:(top)` makes the paths repo-root relative, as `--name-status` prints them.
export const showArgv = (sha: string, paths: string[]): string[] => [
  'git',
  '--no-pager',
  'show',
  '--color=never',
  '--date=short',
  `--format=commit %H%nAuthor: %an <%ae>%nDate:   %ad%n%n%B${REC}`,
  sha,
  '--',
  ...paths.map(p => `:(top)${p}`),
]

// Splits `git show` output into the header text and the hunks (from the first
// `@@`, which is what a `Code format="diff"` element parses).
export function parseShow(stdout: string): { header: string; hunks: string } {
  const [header = '', rest = ''] = stdout.split(REC)
  const start = rest.search(/^@@/m)
  return {
    header: header.trim(),
    hunks: start === -1 ? '' : rest.slice(start).trimEnd(),
  }
}
