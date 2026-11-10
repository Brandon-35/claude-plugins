import { expect, test } from 'claude-code/testing'

import { basename, candidates, firstLine, formatArgv } from '../hooks/format'

const FILE = '/repo/packages/app/src/index.ts'
const BIN = '/repo/node_modules/.bin/prettier'
const NOTE = 'format-on-edit: prettier reformatted index.ts; re-read it before the next edit.'

const exit = (exitCode: number, stderr = '') => ({
  value: { exitCode, stdout: '', stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

const write = { tool: 'Write', tool_use_id: 'toolu_1', file_path: FILE, content: 'const a=1' } as const

test('candidates, formatArgv, basename, firstLine', () => {
  expect(candidates('/repo/src/a.ts')).toEqual([
    { dir: '/repo/src', bin: '/repo/src/node_modules/.bin/prettier' },
    { dir: '/repo', bin: '/repo/node_modules/.bin/prettier' },
    { dir: '/', bin: '/node_modules/.bin/prettier' },
  ])
  expect(candidates('a.ts')).toEqual([])
  expect(formatArgv(BIN, FILE)).toEqual([BIN, '--write', '--ignore-unknown', '--log-level', 'warn', FILE])
  expect(basename(FILE)).toBe('index.ts')
  expect(firstLine('\n[error] src/index.ts: SyntaxError: Unexpected token (1:7)\n[error] > 1 | const = 1\n')).toBe(
    '[error] src/index.ts: SyntaxError: Unexpected token (1:7)',
  )
  expect(firstLine('')).toBe('no error output')
})

const row = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: 'format-on-edit',
    component: 'ToolUse',
    surface,
    requestId: 'toolu_1',
    props: { tool_use_id: 'toolu_1', tool: 'Write', input: {}, isRunning: false, isErrored: false, isInterrupted: false },
  }) as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a reformatted file is found two directories up, noted to the model and marked (${surface})`, async ($, on) => {
    const probed: string[] = []
    const runs: { argv: readonly string[]; cwd?: string }[] = []
    let content = 'const a=1'
    on('command.register', () => ({ value: { command: 'format-on-edit' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('fs.exists', (_, e) => {
      probed.push(e.path)
      return { value: e.path === BIN }
    })
    on('fs.read', () => ({ value: content }))
    on('process.run', (_, e) => {
      runs.push({ argv: e.argv, cwd: e.init?.cwd })
      content = 'const a = 1\n'
      return exit(0)
    })
    on('tool.call', () => ({ result: {}, context: ['earlier note'] }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })

    await $.session.start({ cwd: '/', surface, isInteractive: true })
    const ran = await $.tool.call(write)

    expect(probed).toEqual([
      '/repo/packages/app/src/node_modules/.bin/prettier',
      '/repo/packages/app/node_modules/.bin/prettier',
      '/repo/packages/node_modules/.bin/prettier',
      BIN,
    ])
    expect(runs).toEqual([{ argv: formatArgv(BIN, FILE), cwd: '/repo' }])
    expect(ran.context).toEqual(['earlier note', NOTE])

    const ui = await $.ui.mount(row(surface))
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /formatted/ }))?.text).toBe('  ✓ formatted with prettier')
    await ui.unmount()

    const status = await $.command.run({
      command: 'format-on-edit',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
    expect(status.text).toBe('Formatting on, 1 file formatted this session')
  })

  test(`a prettier failure is marked with its first stderr line (${surface})`, async ($, on) => {
    on('fs.exists', (_, e) => ({ value: e.path === BIN }))
    on('fs.read', () => ({ value: 'const = 1' }))
    on('process.run', () => exit(2, '[error] src/index.ts: SyntaxError: Unexpected token (1:7)\n[error] > 1 | const = 1\n'))
    on('tool.call', () => ({ result: {} }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })

    const ran = await $.tool.call(write)
    expect(ran.context).toBeUndefined()

    const ui = await $.ui.mount(row(surface))
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /prettier failed/ }))?.text).toBe(
      '  prettier failed: [error] src/index.ts: SyntaxError: Unexpected token (1:7)',
    )
    await ui.unmount()
  })
}

// Mounts the row after a call and answers what the plugin added under it.
const cases: { name: string; hasPrettier: boolean; turnOff: boolean; result: object; runs: number }[] = [
  { name: 'an already formatted file is left unmarked', hasPrettier: true, turnOff: false, result: { result: {} }, runs: 1 },
  { name: 'no local prettier: no process call, no mark', hasPrettier: false, turnOff: false, result: { result: {} }, runs: 0 },
  { name: 'toggled off: no process call, no mark', hasPrettier: true, turnOff: true, result: { result: {} }, runs: 0 },
  { name: 'a denied call is not formatted', hasPrettier: true, turnOff: false, result: { deny: 'no' }, runs: 0 },
]

for (const c of cases) {
  test(c.name, async ($, on) => {
    let runs = 0
    on('fs.exists', () => ({ value: c.hasPrettier }))
    on('fs.read', () => ({ value: 'const a = 1\n' }))
    on('process.run', () => {
      runs += 1
      return exit(0)
    })
    on('tool.call', () => c.result as { result: {} })
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })

    const command = (args: string) =>
      $.command.run({
        command: 'format-on-edit',
        args,
        origin: { kind: 'composer' },
        presentation: { isFullscreen: true, columns: 120 },
      })
    if (c.turnOff) expect((await command('off')).text).toBe('Formatting off')

    const ran = await $.tool.call({ tool: 'Edit', tool_use_id: 'toolu_1', file_path: FILE, old_string: 'a', new_string: 'b' })
    expect(runs).toBe(c.runs)
    expect(ran.context).toBeUndefined()

    const ui = await $.ui.mount({ ...row('terminal'), props: { ...row('terminal').props, tool: 'Edit' } })
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /prettier/ })).toBeUndefined()
    await ui.unmount()

    expect((await command('')).text).toBe(`Formatting ${c.turnOff ? 'off' : 'on'}, 0 files formatted this session`)
    expect((await command('maybe')).text).toBe('Usage: /format-on-edit [on|off]')
  })
}
