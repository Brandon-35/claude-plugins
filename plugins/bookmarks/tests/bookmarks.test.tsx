import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import {
  addBookmark,
  contextText,
  parseArgs,
  sortBookmarks,
} from '../hooks/bookmarks'

const ROOT = '/work/demo'
const KEY = `bookmarks:${ROOT}`

const PANE = {
  plugin: 'bookmarks',
  component: 'Pane',
  requestId: 'bookmarks',
  props: {
    title: 'Bookmarks',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const APP = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n') + '\n'

const SEED = [
  { file: 'lib.py', line: 3, note: 'gone file', addedAt: '2026-01-02T00:00:00.000Z' },
  { file: 'app.py', line: 12, note: 'retry loop', addedAt: '2026-01-01T00:00:00.000Z' },
]


/** Stands for the engine: a git root, a store, one readable file, a clock. */
function engine(on: On, seed: unknown = undefined, gitExit = 0) {
  const store = new Map<string, unknown>(seed === undefined ? [] : [[KEY, seed]])
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: `${ROOT}/src` }))
  on('clock.now', () => ({ value: Date.UTC(2026, 0, 3) }))
  on('process.run', () => ({
    value: {
      exitCode: gitExit,
      stdout: gitExit === 0 ? `${ROOT}\n` : '',
      stderr: gitExit === 0 ? '' : 'fatal: not a git repository',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('fs.read', (_, e) => {
    if (e.path !== `${ROOT}/app.py`) throw new Error(`ENOENT: ${e.path}`)
    return { value: APP }
  })
  return store
}

const start = ($: Engine) =>
  $.session.start({ cwd: `${ROOT}/src`, surface: 'terminal', isInteractive: true })

const run = ($: Engine, command: string, args = '') =>
  $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

test('parseArgs reads file, line and note', () => {
  expect(parseArgs('src/app.py')).toEqual({ file: 'src/app.py', line: 1, note: '' })
  expect(parseArgs('  app.py:12 note with  spaces ')).toEqual({
    file: 'app.py',
    line: 12,
    note: 'note with  spaces',
  })
  expect(parseArgs('app.py:abc x')).toEqual({ error: 'Bad line number in app.py:abc' })
  expect(parseArgs('app.py:0')).toEqual({ error: 'Bad line number in app.py:0' })
  expect(parseArgs('   ')).toEqual({ error: 'Usage: /bookmark <file>[:line] [note]' })
})

test('add replaces the same file:line, sort is by file then line', () => {
  const at = '2026-01-01T00:00:00.000Z'
  let list = addBookmark([], { file: 'b.ts', line: 9, note: 'one', addedAt: at })
  list = addBookmark(list, { file: 'b.ts', line: 2, note: '', addedAt: at })
  list = addBookmark(list, { file: 'a.ts', line: 5, note: '', addedAt: at })
  list = addBookmark(list, { file: 'b.ts', line: 9, note: 'two', addedAt: at })
  expect(sortBookmarks(list).map(b => `${b.file}:${b.line} ${b.note}`)).toEqual([
    'a.ts:5 ',
    'b.ts:2 ',
    'b.ts:9 two',
  ])
})

test('contextText stays under 2,000 characters and counts the rest', () => {
  const many = Array.from({ length: 200 }, (_, i) => ({
    file: `src/module-${String(i).padStart(3, '0')}.ts`,
    line: i + 1,
    note: 'a note of some length',
    addedAt: '',
  }))
  const text = contextText(many)
  expect(text.length).toBeLessThan(2000)
  const shown = text.split('\n').length - 2
  expect(text.split('\n').at(-1)).toBe(`… ${200 - shown} more`)
  expect(contextText(SEED)).toBe(
    'Bookmarks in this project (file:line  note):\napp.py:12  retry loop\nlib.py:3  gone file',
  )
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a stored list shows after session.start; context, delete (${surface})`, async ($, on) => {
    const store = engine(on, SEED)
    await start($)

    const ui = await $.ui.mount({ ...PANE, surface })
    const rows = await ui.findAll({ type: 'Button' })
    expect(rows.map(r => r.text)).toEqual(['app.py:12  retry loop', 'lib.py:3  gone file'])

    await ui.press({ key: 'open-app.py:12' })
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.path).toBe('app.py')
    expect(code?.props.startLine).toBe(7)
    expect(String(code?.props.source).split('\n')).toEqual(
      Array.from({ length: 16 }, (_, i) => `line ${i + 7}`),
    )
    expect((await ui.find({ type: 'Text', text: /retry loop/ }))?.text).toBe('retry loop')

    await ui.press({ key: 'back' })
    await ui.press({ key: 'open-lib.py:3' })
    expect((await ui.find({ type: 'Text', text: /File not found/ }))?.text).toBe(
      'File not found',
    )
    await ui.press({ key: 'delete' })

    expect((await ui.findAll({ type: 'Button' })).map(r => r.text)).toEqual([
      'app.py:12  retry loop',
    ])
    expect(store.get(KEY)).toEqual([SEED[1]])
    await ui.unmount()
  })
}

test('/bookmark adds, replaces the note, and rejects what it cannot mark', async ($, on) => {
  const store = engine(on)
  await start($)

  expect((await run($, 'bookmark', 'app.py:12 first')).text).toBe(
    'Bookmarked app.py:12  first',
  )
  expect(
    (await run($, 'bookmark', `${ROOT}/app.py:12 second`)).text,
  ).toBe('Bookmarked app.py:12  second')
  expect(store.get(KEY)).toEqual([
    { file: 'app.py', line: 12, note: 'second', addedAt: '2026-01-03T00:00:00.000Z' },
  ])

  expect((await run($, 'bookmark', 'missing.py:2')).text).toBe(
    'Cannot read missing.py',
  )
  expect((await run($, 'bookmark', 'app.py:31')).text).toBe(
    'app.py has only 30 lines',
  )
  expect((await run($, 'bookmark', 'app.py:x')).text).toBe(
    'Bad line number in app.py:x',
  )
  expect(store.get(KEY)).toHaveLength(1)
})

test('/bookmarks hands the list to the model; /bookmark-clear empties it', async ($, on) => {
  const store = engine(on, SEED)
  await start($)

  const opened = await run($, 'bookmarks')
  expect(opened.context).toEqual([contextText(SEED)])

  expect((await run($, 'bookmark-clear')).text).toBe(
    'Removed 2 bookmarks.',
  )
  expect(store.get(KEY)).toEqual([])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe(
    'No bookmarks. Add one with /bookmark <file>[:line] [note].',
  )
  await ui.unmount()
  expect((await run($, 'bookmarks')).context).toBeUndefined()
})

test('outside a git repository the session cwd is the project root', async ($, on) => {
  const store = engine(on, undefined, 128)
  store.set(`bookmarks:${ROOT}/src`, [SEED[1]])
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button' }))?.text).toBe('app.py:12  retry loop')
  await ui.unmount()
})
