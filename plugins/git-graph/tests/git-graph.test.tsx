import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'git-graph',
  component: 'Pane',
  requestId: 'git-graph',
  props: {
    title: 'Git graph',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const S = '\x1f'
const LOG = [
  `*   ${S}58eed58${S}HEAD -> main, tag: v0.1.0${S}Merge branch 'feature/greeting'${S}Linus${S}2 weeks ago`,
  '|\\  ',
  `| * ${S}9613884${S}feature/greeting${S}feat: add farewell${S}Ada${S}3 weeks ago`,
  `* | ${S}9fcfb55${S}${S}feat(lib): add div${S}Linus${S}3 weeks ago`,
  '|/  ',
  `* ${S}c4c65ec${S}${S}feat: initial app${S}Ada${S}5 weeks ago`,
].join('\n')

const SHOW = [
  'commit 9613884aaaa',
  'Author: Ada <ada@example.com>',
  '',
  'feat: add farewell',
  '\x1e',
  ' app.py | 4 ++++',
  ' 1 file changed, 4 insertions(+)',
  '',
  'diff --git a/app.py b/app.py',
  'index 1111111..2222222 100644',
  '--- a/app.py',
  '+++ b/app.py',
  '@@ -6,0 +7,4 @@ def add(a, b):',
  '+',
  '+',
  '+def farewell(name):',
  '+    return f"Bye, {name}"',
  '',
].join('\n')

const ok = (stdout: string) => ({
  value: {
    exitCode: 0,
    stdout,
    stderr: '',
    isStdoutTruncated: false,
    isStderrTruncated: false,
  },
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`graph lists commits and opens one (${surface})`, async ($, on) => {
    on('process.run', (_, e) =>
      ok(e.argv.includes('show') ? SHOW : e.argv.includes('log') ? LOG : ''),
    )

    const ui = await $.ui.mount({ ...PANE, surface })

    const merge = await ui.find({ type: 'Button', text: /Merge branch/ })
    expect(merge?.text).toContain('58eed58')
    expect(merge?.text).toContain('tag: v0.1.0')
    expect((await ui.find({ type: 'Text', text: /^\|\// }))?.text).toBe('|/  ')

    const farewell = await ui.find({ type: 'Button', text: /add farewell/ })
    await ui.press({ key: farewell?.key ?? '' })

    expect((await ui.find({ type: 'Text', text: /Author: Ada/ }))?.text).toContain(
      'feat: add farewell',
    )
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.format).toBe('diff')
    expect(code?.props.path).toBe('app.py')
    expect(String(code?.props.source)).toStartWith('@@ -6,0 +7,4 @@')

    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Button', text: /add farewell/ })).toBeDefined()
    await ui.unmount()
  })
}

test('a git failure is shown, not thrown', async ($, on) => {
  on('process.run', () => ({
    value: {
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: not a git repository',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('fatal: not a git repository')
  await ui.unmount()
})
