import { atom, memberOf, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Report } from '../types'
import { basename, candidates, counts, eslintArgv, isLintable, modelBlock, parseEslint, problemsText, rowLine } from './lint'

const MAX_ROW_LINES = 5

const rows = atom({ plugin: 'error-lens', key: 'rows' } as const, null)
const files = atom({ plugin: 'error-lens', key: 'files' } as const, {})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'problems',
      description: 'List the ESLint problems of the files edited this session',
    })
    return next(e)
  })

  on('command.run', { command: 'problems' }, async $ => ({ text: problemsText(await read($, files)) }))

  // Lints after the tool wrote the file. The hook never gates: no eslint, a
  // failed call or any error here leaves the tool's result as it came.
  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError || !isLintable(e.file_path)) return ran
    let report: Report | undefined
    try {
      for (const { root, bin } of candidates(e.file_path)) {
        if (!(await $.fs.exists(bin))) continue
        report = parseEslint(await $.process.run(eslintArgv(bin, e.file_path), { cwd: root, timeoutMs: 30_000 }))
        break
      }
      if (!report) return ran
      const found = report
      if (e.tool_use_id) await update($, memberOf(rows, { requestId: e.tool_use_id }), () => found)
      if (!found.failure) {
        await update($, files, all => ({ ...all, [e.file_path]: found }))
        $.ui.status(found.items.length > 0 ? `eslint: ${counts(found)} in ${basename(e.file_path)}` : undefined)
      }
    } catch {
      return ran
    }
    if (report.items.length === 0) return ran
    return { ...ran, context: [...(ran.context ?? []), modelBlock(e.file_path, report)] }
  })

  on('prompt.submit', ($, e, next) => {
    $.ui.status(undefined)
    return next(e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Edit' && e.props.tool !== 'Write') return next(e)
    const report = await read($, memberOf(rows, e))
    if (!report || (report.items.length === 0 && !report.failure)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const more = report.items.length - MAX_ROW_LINES
    return (
      <Box flexDirection="column">
        {await next(e)}
        {report.failure ? (
          <Text color="warning" wrap="truncate-end">
            {'  '}eslint: {report.failure}
          </Text>
        ) : (
          <Text color={report.errors > 0 ? 'error' : 'warning'}>
            {'  '}✘ {counts(report)} (eslint)
          </Text>
        )}
        {report.items.slice(0, MAX_ROW_LINES).map(p => (
          <Text color={p.severity} wrap="truncate-end">
            {'  '}
            {rowLine(p)}
          </Text>
        ))}
        {more > 0 ? <Text dimColor>{'  '}… {more} more</Text> : null}
      </Box>
    )
  })
}
