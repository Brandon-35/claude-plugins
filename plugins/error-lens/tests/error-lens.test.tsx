import { expect, test } from 'claude-code/testing'

import { candidates, eslintArgv, modelBlock, parseEslint } from '../hooks/lint'

const FILE = '/repo/src/app.ts'
const BIN = '/repo/node_modules/.bin/eslint'

const message = (ruleId: string | null, severity: number, text: string, line: number, column: number) => ({
  ruleId,
  severity,
  message: text,
  line,
  column,
  nodeType: 'Identifier',
  endLine: line,
  endColumn: column + 3,
})

// Real `eslint --format json` shape.
const eslintJson = (messages: object[]) =>
  JSON.stringify([
    {
      filePath: FILE,
      messages,
      suppressedMessages: [],
      errorCount: 2,
      warningCount: 1,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      usedDeprecatedRules: [],
    },
  ])

const DIRTY = eslintJson([
  message('no-console', 1, 'Unexpected console statement.', 3, 1),
  message('no-undef', 2, "'foo' is not defined.", 12, 5),
  message('no-unused-vars', 2, "'bar' is assigned a value but never used.", 7, 7),
])
const CLEAN = eslintJson([])

const ran = (exitCode: number, stdout: string, stderr = '') => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

const edit = (tool_use_id: string, file_path = FILE) =>
  ({ tool: 'Edit', tool_use_id, file_path, old_string: 'a', new_string: 'b' }) as const

test('parseEslint sorts errors first, then by line', () => {
  const report = parseEslint({ exitCode: 1, stdout: DIRTY, stderr: '' })
  expect(report).toMatchObject({ errors: 2, warnings: 1 })
  expect(report.items).toEqual([
    { line: 7, column: 7, severity: 'error', rule: 'no-unused-vars', message: "'bar' is assigned a value but never used." },
    { line: 12, column: 5, severity: 'error', rule: 'no-undef', message: "'foo' is not defined." },
    { line: 3, column: 1, severity: 'warning', rule: 'no-console', message: 'Unexpected console statement.' },
  ])
  expect(modelBlock(FILE, report)).toBe(
    [
      'error-lens: eslint found 2 errors, 1 warning in app.ts:',
      "L7:7 error 'bar' is assigned a value but never used. (no-unused-vars)",
      "L12:5 error 'foo' is not defined. (no-undef)",
      'L3:1 warning Unexpected console statement. (no-console)',
    ].join('\n'),
  )
})

test('parseEslint: clean file, exit 2 and non-JSON stdout', () => {
  expect(parseEslint({ exitCode: 0, stdout: CLEAN, stderr: '' })).toEqual({ errors: 0, warnings: 0, items: [] })
  expect(
    parseEslint({ exitCode: 2, stdout: '', stderr: "\nOops! Something went wrong! :(\n\nESLint couldn't find a config" }).failure,
  ).toBe('Oops! Something went wrong! :(')
  expect(parseEslint({ exitCode: 0, stdout: 'Debugger attached.', stderr: '' }).failure).toBe('eslint did not print JSON')
})

test('candidates walk up to the root, eslintArgv never fixes', () => {
  expect(candidates(FILE)).toEqual([
    { root: '/repo/src', bin: '/repo/src/node_modules/.bin/eslint' },
    { root: '/repo', bin: BIN },
    { root: '/', bin: '/node_modules/.bin/eslint' },
  ])
  expect(candidates('src/app.ts')).toEqual([])
  expect(eslintArgv(BIN, FILE)).toEqual([BIN, '--format', 'json', '--no-color', FILE])
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`an Edit is annotated with its eslint problems (${surface})`, async ($, on) => {
    const runs: unknown[] = []
    const status: (string | undefined)[] = []
    let stdout = eslintJson([
      ...JSON.parse(DIRTY)[0].messages,
      ...[20, 21, 22, 23].map(line => message('semi', 1, 'Missing semicolon.', line, 9)),
    ])
    on('command.register', () => ({ value: { command: 'problems' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('fs.exists', (_, e) => ({ value: e.path === BIN }))
    on('process.run', (_, e) => {
      runs.push(e)
      return ran(stdout === CLEAN ? 0 : 1, stdout)
    })
    on('ui.status', (_, e) => {
      status.push(e.text)
      return { value: undefined }
    })
    on('tool.call', () => ({ result: {} }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })

    await $.session.start({ cwd: '/', surface, isInteractive: true })
    const result = await $.tool.call(edit('toolu_1'))

    expect(runs).toMatchObject([{ argv: [BIN, '--format', 'json', '--no-color', FILE], init: { cwd: '/repo', timeoutMs: 30_000 } }])
    expect(result.context?.[0]).toStartWith('error-lens: eslint found 2 errors, 5 warnings in app.ts:\nL7:7 error')
    expect(status).toEqual(['eslint: 2 errors, 5 warnings in app.ts'])

    const ROW = {
      plugin: 'error-lens',
      component: 'ToolUse',
      surface,
      props: { tool_use_id: 'toolu_1', tool: 'Edit', input: {}, isRunning: false, isErrored: false, isInterrupted: false },
    } as const
    const ui = await $.ui.mount({ ...ROW, requestId: 'toolu_1' })
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /✘/ }))?.text).toBe('  ✘ 2 errors, 5 warnings (eslint)')
    expect((await ui.find({ type: 'Text', text: /L7:7/ }))?.text).toBe(
      "  L7:7  'bar' is assigned a value but never used.  no-unused-vars",
    )
    expect(await ui.find({ type: 'Text', text: /L21:9/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /L22:9/ })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /more/ }))?.text).toBe('  … 2 more')
    await ui.unmount()

    const problems = () =>
      $.command.run({
        command: 'problems',
        args: '',
        origin: { kind: 'composer' },
        presentation: { isFullscreen: true, columns: 120 },
      })
    expect((await problems()).text).toStartWith(
      `${FILE} (2 errors, 5 warnings)\n  L7:7 error 'bar' is assigned a value but never used. (no-unused-vars)\n`,
    )

    // A clean re-lint clears the status line, the row and the /problems entry.
    stdout = CLEAN
    const clean = await $.tool.call(edit('toolu_2'))
    expect(clean.context).toBeUndefined()
    expect(status).toEqual(['eslint: 2 errors, 5 warnings in app.ts', undefined])
    const other = await $.ui.mount({ ...ROW, requestId: 'toolu_2', props: { ...ROW.props, tool_use_id: 'toolu_2' } })
    expect(await other.find({ type: 'Text', text: /eslint/ })).toBeUndefined()
    await other.unmount()
    expect((await problems()).text).toBe('No problems in files edited this session.')
  })
}

test('no process runs for a non-lintable file, a missing eslint or a failed edit', async ($, on) => {
  let runs = 0
  let hasEslint = false
  let toolResult: { result: object } | { deny: string } = { result: {} }
  on('fs.exists', () => ({ value: hasEslint }))
  on('process.run', () => {
    runs += 1
    return ran(0, CLEAN)
  })
  on('tool.call', () => toolResult)

  expect(await $.tool.call(edit('t1'))).toEqual({ result: {} })
  hasEslint = true
  expect(await $.tool.call(edit('t2', '/repo/README.md'))).toEqual({ result: {} })
  toolResult = { deny: 'no' }
  expect(await $.tool.call(edit('t3'))).toEqual({ deny: 'no' })
  expect(runs).toBe(0)
})

test('eslint exit 2 shows its first stderr line under the row and tells the model nothing', async ($, on) => {
  on('fs.exists', () => ({ value: true }))
  on('process.run', () => ran(2, '', "ESLint couldn't find an eslint.config.js file.\nmore"))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const result = await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: FILE, content: 'x' })
  expect(result.context).toBeUndefined()
  const ui = await $.ui.mount({
    plugin: 'error-lens',
    component: 'ToolUse',
    surface: 'terminal',
    requestId: 'w1',
    props: { tool_use_id: 'w1', tool: 'Write', input: {}, isRunning: false, isErrored: false, isInterrupted: false },
  })
  expect((await ui.find({ type: 'Text', text: /eslint:/ }))?.text).toBe(
    "  eslint: ESLint couldn't find an eslint.config.js file.",
  )
  await ui.unmount()
})
