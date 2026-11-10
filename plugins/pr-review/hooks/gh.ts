// Pure helpers: build gh argv lists and parse their output. No `$` here, so
// the tests can feed them canned output. Every command is read-only.

export const listArgv = (): string[] => [
  'gh',
  'pr',
  'list',
  '--state',
  'open',
  '--limit',
  '30',
  '--json',
  'number,title,author,headRefName,isDraft,updatedAt',
]

export const viewArgv = (n: number): string[] => [
  'gh',
  'pr',
  'view',
  String(n),
  '--json',
  'number,title,state,isDraft,author,baseRefName,headRefName,body,additions,deletions,changedFiles,reviewDecision,url,files,reviews,comments',
]

export const diffArgv = (n: number): string[] => [
  'gh',
  'pr',
  'diff',
  String(n),
  '--color',
  'never',
]

// gh fills {owner} and {repo} from the current folder. The jq filter makes the
// paginated output one JSON object per line, which is safe to split.
export const inlineArgv = (n: number): string[] => [
  'gh',
  'api',
  `repos/{owner}/{repo}/pulls/${n}/comments`,
  '--paginate',
  '--jq',
  '.[] | {path, line: (.line // .original_line), author: .user.login, body}',
]

// Cheapest call that fails when gh is missing, not logged in or not in a repo.
export const probeArgv = (): string[] => ['gh', 'repo', 'view', '--json', 'name']

export type PrRow = {
  number: number
  title: string
  author: string
  branch: string
  isDraft: boolean
}

export function parseList(stdout: string): PrRow[] {
  const rows = JSON.parse(stdout) as Array<{
    number: number
    title: string
    author?: { login?: string } | null
    headRefName: string
    isDraft: boolean
  }>
  return rows.map(r => ({
    number: r.number,
    title: r.title,
    author: r.author?.login ?? 'unknown',
    branch: r.headRefName,
    isDraft: r.isDraft,
  }))
}

export type PrView = {
  number: number
  title: string
  state: string
  isDraft: boolean
  author: string
  base: string
  head: string
  body: string
  additions: number
  deletions: number
  changedFiles: number
  reviewDecision: string
  url: string
  files: Array<{ path: string; additions: number; deletions: number }>
  reviews: Array<{ author: string; state: string; body: string }>
  comments: Array<{ author: string; body: string }>
}

type Login = { author?: { login?: string } | null }

export function parseView(stdout: string): PrView {
  const v = JSON.parse(stdout)
  const who = (x: Login) => x.author?.login ?? 'unknown'
  return {
    number: v.number,
    title: v.title,
    state: v.state,
    isDraft: v.isDraft,
    author: who(v),
    base: v.baseRefName,
    head: v.headRefName,
    body: v.body ?? '',
    additions: v.additions,
    deletions: v.deletions,
    changedFiles: v.changedFiles,
    reviewDecision: v.reviewDecision ?? '',
    url: v.url,
    files: v.files ?? [],
    reviews: (v.reviews ?? []).map((r: Login & { state: string; body: string }) => ({
      author: who(r),
      state: r.state,
      body: r.body ?? '',
    })),
    comments: (v.comments ?? []).map((c: Login & { body: string }) => ({
      author: who(c),
      body: c.body ?? '',
    })),
  }
}

export type InlineComment = {
  path: string
  line: number | null
  author: string
  body: string
}

export function parseInline(stdout: string): InlineComment[] {
  return stdout
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => JSON.parse(l) as InlineComment)
}

export const truncate = (s: string, max: number): { text: string; cut: boolean } =>
  s.length > max ? { text: s.slice(0, max), cut: true } : { text: s, cut: false }

export type FileDiff = { path: string; hunks: string }

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
