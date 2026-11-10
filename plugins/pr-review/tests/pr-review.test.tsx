import { expect, test } from 'claude-code/testing'

import { parseInline, parseList, parseView, splitPatch } from '../hooks/gh'

const PANE = {
  plugin: 'pr-review',
  component: 'Pane',
  requestId: 'pr-review',
  props: {
    title: 'Pull requests',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const LIST = JSON.stringify([
  {
    number: 3,
    title: 'feat: commit graph pane',
    author: { login: 'ada' },
    headRefName: 'git-graph',
    isDraft: false,
    updatedAt: '2026-11-10T09:03:47Z',
  },
  {
    number: 4,
    title: 'wip: pr pane',
    author: { login: 'linus' },
    headRefName: 'pr-review',
    isDraft: true,
    updatedAt: '2026-11-10T10:00:00Z',
  },
])

const VIEW = JSON.stringify({
  number: 3,
  title: 'feat: commit graph pane',
  state: 'OPEN',
  isDraft: false,
  author: { login: 'ada' },
  baseRefName: 'main',
  headRefName: 'git-graph',
  body: '## Summary\n\nAdds a pane.',
  additions: 427,
  deletions: 3,
  changedFiles: 2,
  reviewDecision: 'APPROVED',
  url: 'https://github.com/acme/app/pull/3',
  files: [
    { path: 'README.md', additions: 3, deletions: 1, changeType: 'MODIFIED' },
    { path: 'src/app.ts', additions: 424, deletions: 2, changeType: 'ADDED' },
  ],
  reviews: [{ author: { login: 'linus' }, state: 'APPROVED', body: 'Looks good.' }],
  comments: [{ author: { login: 'ada' }, body: 'Thanks!' }],
})

const DIFF = [
  'diff --git a/README.md b/README.md',
  'index 111..222 100644',
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -1,2 +1,4 @@',
  ' # App',
  '+one',
  'diff --git a/src/app.ts b/src/app.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/src/app.ts',
  '@@ -0,0 +1,2 @@',
  '+export const a = 1',
  '+export const b = 2',
  '',
].join('\n')

const INLINE = [
  '{"path":"src/app.ts","line":2,"author":"linus","body":"Rename b?"}',
  '{"path":"src/app.ts","line":null,"author":"ada","body":"Outdated"}',
].join('\n')

const reply = (exitCode: number, stdout: string, stderr = '') => ({
  value: {
    exitCode,
    stdout,
    stderr,
    isStdoutTruncated: false,
    isStderrTruncated: false,
  },
})

const RUN = {
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
} as const

const gh = (argv: readonly string[]) => {
  const has = (...w: string[]) => w.every(x => argv.includes(x))
  if (has('pr', 'list')) return reply(0, LIST)
  if (has('pr', 'view')) return reply(0, VIEW)
  if (has('pr', 'diff')) return reply(0, DIFF)
  if (has('api')) return reply(0, INLINE)
  return reply(0, '{}')
}

test('parsers read realistic gh output', () => {
  expect(parseList(LIST)[1]).toMatchObject({ author: 'linus', isDraft: true })
  expect(parseView(VIEW)).toMatchObject({ author: 'ada', head: 'git-graph' })
  expect(parseInline(INLINE)).toHaveLength(2)
  expect(splitPatch(DIFF).map(f => f.path)).toEqual(['README.md', 'src/app.ts'])
  expect(splitPatch(DIFF)[1]?.hunks).toStartWith('@@ -0,0 +1,2 @@')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`list, PR view and file diff (${surface})`, async ($, on) => {
    on('process.run', (_, e) => gh(e.argv))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('command.register', () => ({ value: { command: 'pr' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface, isInteractive: true })
    await $.command.run({ ...RUN, command: 'pr', args: '' })

    const ui = await $.ui.mount({ ...PANE, surface })
    const row = await ui.find({ type: 'Button', text: /feat: commit graph pane/ })
    expect(row?.text).toContain('#3')
    expect(row?.text).toContain('ada · git-graph')
    expect((await ui.find({ type: 'Button', text: /wip/ }))?.text).toContain('draft')
    await ui.press({ key: row?.key ?? '' })

    expect((await ui.find({ type: 'Text', text: /#3 feat/ }))?.text).toContain('commit graph')
    expect((await ui.find({ type: 'Text', text: /git-graph → main/ }))?.text).toContain('ada')
    expect((await ui.find({ type: 'Markdown' }))?.text).toContain('Adds a pane.')
    expect(await ui.find({ type: 'Text', text: /APPROVED/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Thanks!/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /Rename b\?/ }))?.text).toContain('src/app.ts:2')

    const file = await ui.find({ type: 'Button', text: /src\/app\.ts/ })
    await ui.press({ key: file?.key ?? '' })
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.path).toBe('src/app.ts')
    expect(String(code?.props.source)).toStartWith('@@ -0,0 +1,2 @@')

    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Button', text: /README\.md/ })).toBeDefined()
    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Button', text: /wip/ })).toBeDefined()
    await ui.unmount()
  })
}

test('/pr rejects a non-numeric argument', async ($, on) => {
  on('command.register', () => ({ value: { command: 'pr' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const out = await $.command.run({ ...RUN, command: 'pr', args: 'abc' })
  expect(JSON.stringify(out)).toContain('Usage: /pr [number]')
})

test('a gh failure is answered as text, not thrown', async ($, on) => {
  on('process.run', () =>
    reply(1, '', 'To get started with GitHub CLI, please run:  gh auth login\nmore'),
  )
  on('command.register', () => ({ value: { command: 'pr' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const out = await $.command.run({ ...RUN, command: 'pr', args: '' })
  expect(JSON.stringify(out)).toContain('gh auth login')
  expect(JSON.stringify(out)).not.toContain('more')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toContain('gh auth login')
  await ui.unmount()
})
