import { atom, memberOf, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Outcome } from '../types'
import { basename, candidates, firstLine, formatArgv } from './format'

const enabled = atom({ plugin: 'format-on-edit', key: 'enabled' } as const, true)
const count = atom({ plugin: 'format-on-edit', key: 'count' } as const, 0)
const outcomes = atom({ plugin: 'format-on-edit', key: 'outcomes' } as const, { status: 'none' } as Outcome)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'format-on-edit',
      description: 'Turn formatting of edited files on or off for this session',
      argumentHint: '[on|off]',
    })
    return next(e)
  })

  on('command.run', { command: 'format-on-edit' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') {
      await update($, enabled, () => arg === 'on')
      return { text: `Formatting ${arg}` }
    }
    if (arg) return { text: 'Usage: /format-on-edit [on|off]' }
    const formatted = await read($, count)
    return {
      text: `Formatting ${(await read($, enabled)) ? 'on' : 'off'}, ${formatted} file${formatted === 1 ? '' : 's'} formatted this session`,
    }
  })

  // The hook never gates: any failure of its own leaves the tool's result as it was.
  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran
    try {
      if (!(await read($, enabled))) return ran
      let prettier
      for (const candidate of candidates(e.file_path)) {
        if (await $.fs.exists(candidate.bin)) {
          prettier = candidate
          break
        }
      }
      if (!prettier) return ran

      const before = await $.fs.read(e.file_path)
      const run = await $.process.run(formatArgv(prettier.bin, e.file_path), { cwd: prettier.dir })
      const outcome: Outcome =
        run.exitCode !== 0
          ? { status: 'failed', error: firstLine(run.stderr) }
          : { status: (await $.fs.read(e.file_path)) === before ? 'unchanged' : 'formatted' }
      await update($, memberOf(outcomes, { requestId: e.tool_use_id }), () => outcome)
      if (outcome.status !== 'formatted') return ran

      await update($, count, n => n + 1)
      // The model's next Edit would otherwise match against the text it wrote.
      return {
        ...ran,
        context: [
          ...(ran.context ?? []),
          `format-on-edit: prettier reformatted ${basename(e.file_path)}; re-read it before the next edit.`,
        ],
      }
    } catch {
      // Unreadable file, prettier that cannot start: nothing to report.
      return ran
    }
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Edit' && e.props.tool !== 'Write') return next(e)
    const outcome = await read($, memberOf(outcomes, e))
    const note =
      outcome.status === 'formatted'
        ? '✓ formatted with prettier'
        : outcome.status === 'failed'
          ? `prettier failed: ${outcome.error}`
          : undefined
    if (!note) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {await next(e)}
        <Text dimColor color={outcome.status === 'failed' ? 'warning' : 'success'} wrap="truncate-end">
          {'  '}
          {note}
        </Text>
      </Box>
    )
  })
}
