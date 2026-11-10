import { expect, test } from 'claude-code/testing'

import { grepArgv, parseGrep, parseTag, summary } from '../hooks/todo'

const PANE = {
  plugin: 'todo-tree',
  component: 'Pane',
  requestId: 'todo-tree',
  props: {
    title: 'Todo tree',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const GREP = [
  'app.py:3:    # TODO: read the url from config: http://localhost:8080',
  'app.py:12:  x = 1  # HACK until the parser lands, FIXME after',
  'lib/arith.py:7:# FIXME(ada): division by zero',
  'lib/arith.py:20:    // XXX',
  'notes.md:1:BUG 42 is still open',
  '',
].join('\n')

const FILE = Array.from({ length: 30 }, (_, i) =>
  i === 6 ? '# FIXME(ada): division by zero' : `line ${i + 1}`,
).join('\n')

const run = (args: string) => ({
  command: 'todos',
  args,
  origin: { kind: 'plugin', name: 'todo-tree' } as const,
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

test('parseGrep splits on the first two colons and takes the first tag', () => {
  const todos = parseGrep(GREP)
  expect(todos.map(t => t.tag)).toEqual(['TODO', 'HACK', 'FIXME', 'XXX', 'BUG'])
  expect(todos[0]).toEqual({
    file: 'app.py',
    line: 3,
    tag: 'TODO',
    text: '# TODO: read the url from config: http://localhost:8080',
  })
  expect(todos[2]).toMatchObject({ file: 'lib/arith.py', line: 7 })
  expect(summary(todos)).toBe('5 tags  TODO 1  FIXME 1  HACK 1  BUG 1  XXX 1')
})

test('parseGrep cuts the text to 120 characters and tags by the filter', () => {
  expect(parseGrep(`a.ts:1:// TODO ${'x'.repeat(200)}`)[0]?.text.length).toBe(120)
  expect(parseGrep(GREP.split('\n')[1] ?? '', 'FIXME')[0]?.tag).toBe('FIXME')
  expect(parseGrep('Binary file a.bin matches\n')).toEqual([])
})

test('the tag argument is matched case-insensitively', () => {
  expect(parseTag('')).toBe(null)
  expect(parseTag(' fixme ')).toBe('FIXME')
  expect(parseTag('nope')).toBeUndefined()
  expect(grepArgv(null)).toEqual([
    'git', '--no-pager', 'grep', '-n', '-I', '--color=never', '--untracked',
    '-w', '-E', '(TODO|FIXME|HACK|BUG|XXX)', '--',
  ])
  expect(grepArgv('FIXME')).toContain('(FIXME)')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the list groups tags by file and opens the context (${surface})`, async ($, on) => {
    const reads: string[] = []
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('process.run', () => result(0, GREP))
    on('fs.read', (_, e) => {
      reads.push(e.path)
      return { value: FILE }
    })
    expect((await $.command.run(run(''))).text).toContain('opened')

    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /5 tags/ }))?.text).toContain('FIXME 1')
    expect(await ui.find({ type: 'Text', text: /^lib\/arith\.py$/ })).toBeDefined()
    const row = await ui.find({ type: 'Button', text: /division by zero/ })
    expect(row?.text).toContain('7  FIXME  # FIXME(ada)')

    await ui.press({ key: row?.key ?? '' })
    const code = await ui.find({ type: 'Code' })
    // The engine resolves the path against the working directory.
    expect(reads).toHaveLength(1)
    expect(reads[0]).toEndWith('lib/arith.py')
    expect(code?.props.path).toBe('lib/arith.py')
    expect(code?.props.startLine).toBe(2)
    expect(String(code?.props.source).split('\n')).toHaveLength(11)
    expect(String(code?.props.source)).toStartWith('line 2\n')
    expect(String(code?.props.source)).toEndWith('line 12')

    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Button', text: /division by zero/ })).toBeDefined()
    await ui.unmount()
  })
}

test('a tag argument searches that tag only, an unknown one opens nothing', async ($, on) => {
  let opened = 0
  const argvs: string[][] = []
  on('ui.open', () => {
    opened++
    return { value: { isPlaced: true } }
  })
  on('process.run', (_, e) => {
    argvs.push([...e.argv])
    return result(0, GREP.split('\n')[1] ?? '')
  })

  expect((await $.command.run(run('nope'))).text).toBe(
    'todos: unknown tag. Valid tags: TODO, FIXME, HACK, BUG, XXX.',
  )
  expect(opened).toBe(0)

  await $.command.run(run('fixme'))
  expect(opened).toBe(1)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(argvs[0]).toContain('(FIXME)')
  expect((await ui.find({ type: 'Text', text: /1 tag/ }))?.text).toBe('1 tag  FIXME 1')
  await ui.unmount()
})

test('more than 200 rows are cut with a note', async ($, on) => {
  on('process.run', () =>
    result(0, Array.from({ length: 205 }, (_, i) => `a.ts:${i + 1}:// TODO ${i}`).join('\n')),
  )
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /more not shown/ }))?.text).toBe('… 5 more not shown')
  expect(await ui.find({ type: 'Button', text: /TODO 199$/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /TODO 200$/ })).toBeUndefined()
  await ui.unmount()
})

test('exit code 1 means no matches', async ($, on) => {
  on('process.run', () => result(1, ''))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('No TODO tags found.')
  await ui.unmount()
})

test('a git failure is shown, not thrown', async ($, on) => {
  on('process.run', () => result(128, '', 'fatal: not a git repository'))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('fatal: not a git repository')
  await ui.unmount()
})

test('an unreadable file is shown with the back button', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', () => result(0, GREP))
  on('fs.read', () => {
    throw new Error('ENOENT')
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = await ui.find({ type: 'Button', text: /division by zero/ })
  await ui.press({ key: row?.key ?? '' })
  expect((await ui.find({ type: 'Text', text: /Cannot read/ }))?.text).toContain('lib/arith.py')
  expect(await ui.find({ type: 'Button', text: /Back/ })).toBeDefined()
  await ui.unmount()
})
