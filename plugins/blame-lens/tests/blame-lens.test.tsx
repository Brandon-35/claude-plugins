import { expect, test } from 'claude-code/testing'

import { ago, blameArgv, lineRange, parseBlame, parseTarget, summarize, table } from '../hooks/blame'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const Z = '0'.repeat(40)
const NOW = 1_800_000_000

// Real `git blame --porcelain` shape: headers only on a commit's first line.
const PORCELAIN = [
  `${A} 3 3 2`,
  'author Linus',
  'author-mail <linus@example.com>',
  `author-time ${NOW - 14 * 86_400}`,
  'summary fix(lib): guard division by zero',
  'filename lib/arith.py',
  '\tdef div(a, b):',
  `${A} 4 4`,
  '\t    return a / b if b else 0',
  `${B} 1 5 1`,
  'author Grace',
  `author-time ${NOW - 3600}`,
  'summary feat(lib): add math helpers',
  'filename lib/math.py',
  '\tdef mul(a, b):',
  `${Z} 6 6 1`,
  'author Not Committed Yet',
  `author-time ${NOW}`,
  'summary Version of app.py from app.py',
  '\tprint(1)',
  '',
].join('\n')

const ok = (stdout: string) => ({
  value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

test('parseBlame reads lines and fills commit headers', () => {
  const lines = parseBlame(PORCELAIN)
  expect(lines.map(l => l.line)).toEqual([3, 4, 5, 6])
  expect(lines[1]).toMatchObject({ author: 'Linus', summary: 'fix(lib): guard division by zero' })
  expect(lines[2]?.text).toBe('def mul(a, b):')
})

test('summarize groups runs of one commit and marks uncommitted lines', () => {
  expect(summarize(parseBlame(PORCELAIN), NOW)).toEqual([
    'L3-4 Linus, 2 weeks ago · aaaaaaa fix(lib): guard division by zero',
    'L5 Grace, 1 hour ago · bbbbbbb feat(lib): add math helpers',
    'L6 not committed yet',
  ])
  expect(summarize(parseBlame(PORCELAIN), NOW, 1)).toEqual([
    'L3-4 Linus, 2 weeks ago · aaaaaaa fix(lib): guard division by zero',
    '+2 more',
  ])
})

test('lineRange, ago, parseTarget, blameArgv, table', () => {
  expect(lineRange('a\nb\nc\nd\n', 'b\nc\n')).toEqual({ start: 2, end: 3 })
  expect(lineRange('a\nb', 'zzz')).toBeUndefined()
  expect(lineRange('a', '')).toBeUndefined()
  expect(ago(NOW - 30, NOW)).toBe('just now')
  expect(ago(NOW - 400 * 86_400, NOW)).toBe('1 year ago')
  expect(parseTarget('lib/arith.py:3-4')).toEqual({ file: 'lib/arith.py', range: { start: 3, end: 4 } })
  expect(parseTarget('app.py:7')).toEqual({ file: 'app.py', range: { start: 7, end: 7 } })
  expect(parseTarget('app.py')).toEqual({ file: 'app.py' })
  expect(parseTarget('--help')).toBeUndefined()
  expect(parseTarget('')).toBeUndefined()
  expect(blameArgv('/repo/lib/arith.py', { start: 3, end: 4 })).toEqual([
    'git', '-C', '/repo/lib', '--no-pager', 'blame', '--porcelain', '-L', '3,4', '--', 'arith.py',
  ])
  expect(blameArgv('app.py').slice(1, 3)).toEqual(['-C', '.'])
  expect(table(parseBlame(PORCELAIN), NOW).split('\n')[0]).toBe(
    `aaaaaaa ${'Linus'.padEnd(13)} ${'2 weeks ago'.padEnd(13)}    3│ def div(a, b):`,
  )
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`an Edit is annotated with the blame taken before it ran (${surface})`, async ($, on) => {
    on('command.register', () => ({ value: { command: 'blame' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('clock.now', () => ({ value: NOW * 1000 }))
    on('fs.read', () => ({ value: 'def mul(a, b):\n    return a * b\ndef div(a, b):\n    return a / b if b else 0\n' }))
    on('process.run', () => ok(PORCELAIN))
    on('tool.call', () => ({ result: {} }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })

    await $.session.start({ cwd: '/', surface, isInteractive: true })
    await $.tool.call({
      tool: 'Edit',
      tool_use_id: 'toolu_1',
      file_path: '/repo/lib/arith.py',
      old_string: 'def div(a, b):\n    return a / b if b else 0\n',
      new_string: 'def div(a, b):\n    return a / b\n',
    })

    const ROW = {
      plugin: 'blame-lens',
      component: 'ToolUse',
      surface,
      props: { tool_use_id: 'toolu_1', tool: 'Edit', input: {}, isRunning: false, isErrored: false, isInterrupted: false },
    } as const
    const ui = await $.ui.mount({ ...ROW, requestId: 'toolu_1' })
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /L3-4/ }))?.text).toBe(
      '  blame L3-4 Linus, 2 weeks ago · aaaaaaa fix(lib): guard division by zero',
    )
    await ui.unmount()

    const other = await $.ui.mount({ ...ROW, requestId: 'toolu_2', props: { ...ROW.props, tool_use_id: 'toolu_2' } })
    expect(await other.find({ type: 'Text', text: /blame/ })).toBeUndefined()
    await other.unmount()
  })
}

test('a failing blame never blocks the edit', async ($, on) => {
  let ran = 0
  on('fs.read', () => ({ deny: 'no such file' }))
  on('tool.call', () => {
    ran += 1
    return { result: {} }
  })
  await $.tool.call({ tool: 'Edit', tool_use_id: 't', file_path: '/x', old_string: 'a', new_string: 'b' })
  expect(ran).toBe(1)
})

test('/blame prints a table, and usage without a file', async ($, on) => {
  on('clock.now', () => ({ value: NOW * 1000 }))
  on('process.run', () => ok(PORCELAIN))
  const run = (args: string) =>
    $.command.run({
      command: 'blame',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
  const out = await run('lib/arith.py:3-6')
  expect(out.text).toStartWith('lib/arith.py:3-6\naaaaaaa Linus')
  expect(out.text).toContain('bbbbbbb Grace')
  expect(out.text).toContain('(uncommitted)')
  expect((await run('')).text).toBe('Usage: /blame <file>[:line[-line]]')
})
