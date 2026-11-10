// Pure helpers: blame argv, porcelain parser, line-range and text formatting.

export type BlameLine = {
  line: number
  sha: string
  author: string
  time: number
  summary: string
  text: string
}

const UNCOMMITTED = /^0+$/

// Runs in the file's own folder, so a file outside the session's repository
// is blamed in the repository it belongs to.
export const blameArgv = (
  file: string,
  range?: { start: number; end: number },
): string[] => [
  'git',
  '-C',
  file.includes('/') ? file.slice(0, file.lastIndexOf('/')) || '/' : '.',
  '--no-pager',
  'blame',
  '--porcelain',
  ...(range ? ['-L', `${range.start},${range.end}`] : []),
  '--',
  file.slice(file.lastIndexOf('/') + 1),
]

// `git blame --porcelain`: a `<sha> <orig> <final> [<count>]` line, that
// commit's headers the first time it appears, then a tab and the line's text.
export function parseBlame(stdout: string): BlameLine[] {
  const commits = new Map<string, { author: string; time: number; summary: string }>()
  const lines: BlameLine[] = []
  let sha = ''
  let line = 0
  for (const raw of stdout.split('\n')) {
    const head = /^([0-9a-f]{40}) \d+ (\d+)/.exec(raw)
    if (head) {
      sha = head[1] ?? ''
      line = Number(head[2])
      if (!commits.has(sha)) commits.set(sha, { author: '', time: 0, summary: '' })
      continue
    }
    const commit = commits.get(sha)
    if (!commit) continue
    if (raw.startsWith('author ')) commit.author = raw.slice(7)
    else if (raw.startsWith('author-time ')) commit.time = Number(raw.slice(12))
    else if (raw.startsWith('summary ')) commit.summary = raw.slice(8)
    else if (raw.startsWith('\t')) lines.push({ line, sha, ...commit, text: raw.slice(1) })
  }
  // Headers follow the first line of a commit, so fill them in afterwards.
  return lines.map(l => ({ ...l, ...commits.get(l.sha) }))
}

// The 1-based lines `needle` covers in `content`, or undefined when absent.
export function lineRange(
  content: string,
  needle: string,
): { start: number; end: number } | undefined {
  const at = needle === '' ? -1 : content.indexOf(needle)
  if (at === -1) return undefined
  const start = content.slice(0, at).split('\n').length
  const span = needle.replace(/\n$/, '').split('\n').length
  return { start, end: start + span - 1 }
}

export function ago(seconds: number, now: number): string {
  const d = Math.max(0, now - seconds)
  const units: [number, string][] = [
    [31_536_000, 'year'],
    [2_592_000, 'month'],
    [604_800, 'week'],
    [86_400, 'day'],
    [3_600, 'hour'],
    [60, 'minute'],
  ]
  for (const [size, name] of units) {
    const n = Math.floor(d / size)
    if (n >= 1) return `${n} ${name}${n === 1 ? '' : 's'} ago`
  }
  return 'just now'
}

// One note per run of consecutive lines from the same commit.
export function summarize(lines: BlameLine[], now: number, max = 3): string[] {
  const notes: string[] = []
  let i = 0
  while (i < lines.length) {
    const first = lines[i]
    if (!first) break
    let j = i
    while (lines[j + 1]?.sha === first.sha) j++
    const last = lines[j] ?? first
    const span = first.line === last.line ? `L${first.line}` : `L${first.line}-${last.line}`
    notes.push(
      UNCOMMITTED.test(first.sha)
        ? `${span} not committed yet`
        : `${span} ${first.author}, ${ago(first.time, now)} · ${first.sha.slice(0, 7)} ${first.summary}`,
    )
    i = j + 1
  }
  return notes.length > max
    ? [...notes.slice(0, max), `+${notes.length - max} more`]
    : notes
}

export function table(lines: BlameLine[], now: number): string {
  const rows = lines.map(l =>
    UNCOMMITTED.test(l.sha)
      ? { ...l, sha: '0000000', author: '(uncommitted)', when: '' }
      : { ...l, sha: l.sha.slice(0, 7), when: ago(l.time, now) },
  )
  const width = Math.max(0, ...rows.map(r => r.author.length))
  return rows
    .map(
      r =>
        `${r.sha} ${r.author.padEnd(width)} ${r.when.padEnd(13)} ${String(r.line).padStart(4)}│ ${r.text}`,
    )
    .join('\n')
}

// `<file>`, `<file>:<line>` or `<file>:<start>-<end>`.
export function parseTarget(
  args: string,
): { file: string; range?: { start: number; end: number } } | undefined {
  const m = /^(.+?)(?::(\d+)(?:-(\d+))?)?$/.exec(args.trim())
  if (!m || !m[1] || m[1].startsWith('-')) return undefined
  if (!m[2]) return { file: m[1] }
  const start = Number(m[2])
  const end = m[3] ? Number(m[3]) : start
  return start >= 1 && end >= start ? { file: m[1], range: { start, end } } : undefined
}
