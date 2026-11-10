import { expect, test } from 'claude-code/testing'

import { parseLog, parseShow } from '../hooks/git'

const PANE = {
  plugin: 'git-history',
  component: 'Pane',
  requestId: 'git-history',
  props: {
    title: 'History: lib/arith.py',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const S = '\x1f'
const R = '\x1e'
const LOG = [
  `${R}72fbb07${S}2026-10-25${S}Linus${S}fix(lib): guard division by zero`,
  '',
  'M\tlib/arith.py',
  `${R}fb67d67${S}2026-10-20${S}Grace${S}refactor(lib): rename math to arith`,
  '',
  'R100\tlib/math.py\tlib/arith.py',
  `${R}9fcfb55${S}2026-10-10${S}Linus${S}feat(lib): add div`,
  '',
  'M\tlib/math.py',
  `${R}fbe8c03${S}2026-10-05${S}Grace${S}feat(lib): add math helpers`,
  '',
  'A\tlib/math.py',
  '',
].join('\n')

const SHOW = [
  'commit 72fbb07aaaa',
  'Author: Linus <linus@example.com>',
  'Date:   2026-10-25',
  '',
  'fix(lib): guard division by zero',
  R,
  '',
  'diff --git a/lib/arith.py b/lib/arith.py',
  'index 1111111..2222222 100644',
  '--- a/lib/arith.py',
  '+++ b/lib/arith.py',
  '@@ -3 +3,3 @@ def add(a, b):',
  '-    return a / b',
  '+    if b == 0:',
  '+        raise ZeroDivisionError',
  '+    return a / b',
  '',
].join('\n')

const RENAME_SHOW = [
  'commit fb67d67bbbb',
  '',
  'refactor(lib): rename math to arith',
  R,
  '',
  'diff --git a/lib/math.py b/lib/arith.py',
  'similarity index 100%',
  'rename from lib/math.py',
  'rename to lib/arith.py',
  '',
].join('\n')

const run = (args: string) => ({
  command: 'file-history',
  args,
  origin: { kind: 'plugin', name: 'git-history' } as const,
  presentation: { isFullscreen: true, columns: 80 },
})

const result = (exitCode: number, stdout: string, stderr = '') => ({
  value: {
    exitCode,
    stdout,
    stderr,
    isStdoutTruncated: false,
    isStderrTruncated: false,
  },
})

test('parseLog follows the rename', () => {
  const entries = parseLog(LOG)
  expect(entries.map(c => c.sha)).toEqual(['72fbb07', 'fb67d67', '9fcfb55', 'fbe8c03'])
  expect(entries[1]).toMatchObject({ path: 'lib/arith.py', oldPath: 'lib/math.py' })
  expect(entries[3]).toMatchObject({ path: 'lib/math.py', oldPath: null })
})

test('parseShow keeps header and hunks, empty hunks for a pure rename', () => {
  expect(parseShow(SHOW).hunks).toStartWith('@@ -3 +3,3 @@')
  expect(parseShow(SHOW).header).toContain('guard division by zero')
  expect(parseShow(RENAME_SHOW).hunks).toBe('')
})

// Runs /file-history so the pane's state is set the way a session sets it.
async function start($: any, on: any, show = SHOW) {
  const shows: string[][] = []
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', (_: unknown, e: { argv: string[] }) => {
    if (!e.argv.includes('show')) return result(0, LOG)
    shows.push(e.argv)
    return result(0, show)
  })
  const out = await $.command.run(run('lib/arith.py'))
  return { shows, out }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`history lists commits and opens one (${surface})`, async ($, on) => {
    const { shows, out } = await start($, on)
    expect(out.text).toContain('opened')

    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /4 commits/ }))?.text).toContain('lib/arith.py')
    const rename = await ui.find({ type: 'Button', text: /rename math/ })
    expect(rename?.text).toContain('lib/math.py → lib/arith.py')

    const guard = await ui.find({ type: 'Button', text: /guard division/ })
    expect(guard?.text).toContain('72fbb07')
    await ui.press({ key: guard?.key ?? '' })

    expect((await ui.find({ type: 'Text', text: /Author: Linus/ }))?.text).toContain(
      'guard division by zero',
    )
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.format).toBe('diff')
    expect(String(code?.props.source)).toStartWith('@@ -3 +3,3 @@')
    expect(shows[0]).toContain(':(top)lib/arith.py')

    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Button', text: /guard division/ })).toBeDefined()
    await ui.unmount()
  })
}

test('a rename commit shows a note and asks git for both paths', async ($, on) => {
  const { shows } = await start($, on, RENAME_SHOW)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const rename = await ui.find({ type: 'Button', text: /rename math/ })
  await ui.press({ key: rename?.key ?? '' })
  expect(await ui.find({ type: 'Text', text: /no content change/ })).toBeDefined()
  expect(shows[0]).toContain(':(top)lib/math.py')
  expect(shows[0]).toContain(':(top)lib/arith.py')
  await ui.unmount()
})

test('the command answers usage, and a missing history opens nothing', async ($, on) => {
  let opened = false
  on('ui.open', () => {
    opened = true
    return { value: { isPlaced: true } }
  })
  on('process.run', () => result(0, ''))
  expect((await $.command.run(run(''))).text).toBe(
    'Usage: /file-history <path>',
  )
  expect((await $.command.run(run('nope.py'))).text).toContain(
    'no history',
  )
  expect(opened).toBe(false)
})

test('a git failure is shown, not thrown', async ($, on) => {
  let calls = 0
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', () =>
    calls++ === 0 ? result(0, LOG) : result(128, '', 'fatal: not a git repository'),
  )
  await $.command.run(run('lib/arith.py'))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('fatal: not a git repository')
  await ui.unmount()
})
