import type { CommandRunInput } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import {
  dirsArgv,
  labelOf,
  parseDirs,
  parsePatch,
  parseRefs,
  refsArgv,
  relativize,
  splitArgs,
} from '../hooks/git'

const PANE = {
  plugin: 'git-compare',
  component: 'Pane',
  requestId: 'git-compare',
  props: {
    title: 'Compare',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// Real output of `git diff -M v0.1.0...main` and of `git diff --no-index`.
const REFS = [
  'diff --git a/lib/math.py b/lib/arith.py',
  'similarity index 61%',
  'rename from lib/math.py',
  'rename to lib/arith.py',
  'index 1111111..2222222 100644',
  '--- a/lib/math.py',
  '+++ b/lib/arith.py',
  '@@ -1,2 +1,3 @@',
  ' def add(a, b):',
  '-    return a + b',
  '+    return a + b',
  '+# note',
  'diff --git a/logo.png b/logo.png',
  'new file mode 100644',
  'index 0000000..3333333',
  'Binary files /dev/null and b/logo.png differ',
  '',
].join('\n')

const DIRS = [
  'diff --git a/dirs-a/changed.txt b/dirs-b/changed.txt',
  'index 4cb29ea..ea14db2 100644',
  '--- a/dirs-a/changed.txt',
  '+++ b/dirs-b/changed.txt',
  '@@ -1,3 +1,4 @@',
  ' one',
  '-two',
  '+2',
  ' three',
  '+four',
  'diff --git a/dirs-a/only_a.txt b/dirs-a/only_a.txt',
  'deleted file mode 100644',
  'index 1f2615f..0000000',
  '--- a/dirs-a/only_a.txt',
  '+++ /dev/null',
  '@@ -1 +0,0 @@',
  '-only-a',
  'diff --git a/dirs-b/only_b.txt b/dirs-b/only_b.txt',
  'new file mode 100644',
  'index 0000000..778bc50',
  '--- /dev/null',
  '+++ b/dirs-b/only_b.txt',
  '@@ -0,0 +1 @@',
  '+only-b',
  '',
].join('\n')

const cmd = (
  $: { command: { run: (i: CommandRunInput) => Promise<{ text?: string }> } },
  command: string,
  args: string,
) =>
  $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

const run = (stdout: string, exitCode = 0, stderr = '') => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

test('argument parsing and argv builders', () => {
  expect(splitArgs('"my dir" other')).toEqual(['my dir', 'other'])
  expect(parseDirs('"a b" c')).toEqual({ a: 'a b', b: 'c' })
  expect(parseDirs('-x y')).toHaveProperty('error')
  expect(parseDirs('only-one')).toHaveProperty('error')
  expect(parseRefs('')).toHaveProperty('error')
  expect(parseRefs('--output=x main')).toHaveProperty('error')
  expect(parseRefs('main..feature/sub')).toEqual({
    a: 'main..feature/sub',
    b: '',
    refs: ['main', 'feature/sub'],
  })
  expect(parseRefs('v0.1.0 main')).toMatchObject({ refs: ['v0.1.0', 'main'] })
  expect(refsArgv('v0.1.0', 'main').slice(-2)).toEqual(['v0.1.0...main', '--'])
  expect(refsArgv('main..feature/sub', '').slice(-2)).toEqual(['main..feature/sub', '--'])
  expect(refsArgv('main', '').slice(-2)).toEqual(['main', '--'])
  expect(dirsArgv('x', 'y').slice(-3)).toEqual(['--', 'x', 'y'])
})

test('parsePatch reads renames, binaries, adds and deletes', () => {
  const [rename, bin] = parsePatch(REFS)
  expect(rename).toMatchObject({ status: 'R', added: 2, removed: 1, binary: false })
  expect(labelOf(rename!)).toBe('lib/math.py → lib/arith.py')
  expect(bin).toMatchObject({ status: 'A', binary: true, to: 'logo.png', hunks: '' })

  const [changed, gone, fresh] = parsePatch(DIRS)
  expect(changed).toMatchObject({ status: 'M', added: 2, removed: 1 })
  expect(labelOf(changed!)).toBe('dirs-a/changed.txt → dirs-b/changed.txt')
  expect(gone).toMatchObject({ status: 'D', from: 'dirs-a/only_a.txt', to: '' })
  expect(fresh).toMatchObject({ status: 'A', from: '' })

  // Both sides lose their folder; an absolute folder is named without its slash.
  const rel = relativize(parsePatch(DIRS), 'dirs-a/', 'dirs-b')
  expect(rel.map(labelOf)).toEqual(['changed.txt', 'only_a.txt', 'only_b.txt'])
  const abs = relativize(
    [{ ...changed!, from: 'tmp/x/a/f.txt', to: 'tmp/x/b/f.txt' }],
    '/tmp/x/a',
    '/tmp/x/b',
  )
  expect(labelOf(abs[0]!)).toBe('f.txt')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`/compare lists files and shows one diff (${surface})`, async ($, on) => {
    const opened: unknown[] = []
    on('command.register', () => ({ value: { command: 'compare' } }))
    on('ui.open', (_, e) => {
      opened.push(e)
      return { value: { isPlaced: true } }
    })
    on('process.run', (_, e) =>
      e.argv.includes('rev-parse') ? run('abc\n') : run(REFS),
    )

    const answer = await cmd($, 'compare', 'v0.1.0 main')
    expect(answer.text).toContain('v0.1.0')
    expect(JSON.stringify(opened[0])).toContain('Compare: v0.1.0 ↔ main')

    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /changed/ }))?.text).toBe(
      '2 files changed, +2 −1',
    )
    const rename = await ui.find({ type: 'Button', text: /arith/ })
    expect(rename?.text).toContain('R lib/math.py → lib/arith.py +2 −1')
    expect((await ui.find({ type: 'Button', text: /logo/ }))?.text).toContain('binary')

    await ui.press({ key: rename?.key ?? '' })
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.format).toBe('diff')
    expect(String(code?.props.source)).toStartWith('@@ -1,2 +1,3 @@')

    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Button', text: /logo/ })).toBeDefined()
    await ui.unmount()
  })

  test(`/compare-dirs treats exit 1 as success (${surface})`, async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('process.run', () => run(DIRS, 1))

    await cmd($, 'compare-dirs', 'dirs-a dirs-b')
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /changed/ }))?.text).toBe(
      '3 files changed, +3 −2',
    )
    const gone = await ui.find({ type: 'Button', text: /only_a/ })
    expect(gone?.text).toContain('D only_a.txt')
    await ui.press({ key: gone?.key ?? '' })
    expect(String((await ui.find({ type: 'Code' }))?.props.source)).toStartWith('@@ -1 +0,0 @@')
    await ui.unmount()
  })
}

test('no differences is said, not drawn as an empty list', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', () => run(''))
  await cmd($, 'compare-dirs', 'x y')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('No differences.')
  await ui.unmount()
})

test('an unknown ref answers a line and opens no pane', async ($, on) => {
  let opened = false
  on('ui.open', () => {
    opened = true
    return { value: { isPlaced: true } }
  })
  on('process.run', () => run('', 1))
  const answer = await cmd($, 'compare', 'nope')
  expect(answer.text).toBe('Unknown ref: nope')
  expect(opened).toBe(false)
  expect((await cmd($, 'compare', '-p main')).text).toContain('"-"')
  expect((await cmd($, 'compare', '')).text).toBe(
    'Usage: /compare <ref-a> [ref-b]',
  )
})

test('a git failure is shown, not thrown', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', () => run('', 128, 'fatal: Not a valid object name'))
  await cmd($, 'compare-dirs', 'x y')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('fatal: Not a valid object name')
  await ui.unmount()
})

test('a missing folder (exit 1, empty stdout, stderr) is an error', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', () => run('', 1, "error: Could not access 'nodir'"))
  await cmd($, 'compare-dirs', 'nodir y')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text' }))?.text).toContain('Could not access')
  await ui.unmount()
})
