import { atom, memberOf, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { blameArgv, lineRange, parseBlame, parseTarget, summarize, table } from './blame'

const MAX_LINES = 200

const notes = atom({ plugin: 'blame-lens', key: 'notes' } as const, [])

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'blame',
      description: 'Show git blame for a file, a line or a line range',
      argumentHint: '<file>[:line[-line]]',
    })
    return next(e)
  })

  on('command.run', { command: 'blame' }, async ($, e) => {
    const target = parseTarget(e.args)
    if (!target) return { text: 'Usage: /blame <file>[:line[-line]]' }
    const run = await $.process.run(blameArgv(target.file, target.range))
    if (run.exitCode !== 0) {
      return { text: `blame: ${run.stderr.trim().split('\n')[0] ?? 'git blame failed'}` }
    }
    const lines = parseBlame(run.stdout)
    const now = (await $.clock.now()) / 1000
    const more = lines.length - MAX_LINES
    return {
      // The file name leads, so the table's rows line up under the output row.
      text:
        `${e.args.trim()}\n` +
        table(lines.slice(0, MAX_LINES), now) +
        (more > 0 ? `\n… ${more} more lines; narrow with /blame ${target.file}:<start>-<end>` : ''),
    }
  })

  // Blame is taken before the edit runs: afterwards the lines are uncommitted.
  // The hook never gates: any failure leaves the edit to run unannotated.
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    try {
      const range = lineRange(await $.fs.read(e.file_path), e.old_string)
      if (range) {
        const run = await $.process.run(blameArgv(e.file_path, range))
        if (run.exitCode === 0) {
          const found = summarize(parseBlame(run.stdout), (await $.clock.now()) / 1000)
          await update($, memberOf(notes, { requestId: e.tool_use_id }), () => found)
          if (found[0]) $.ui.status(found[0])
        }
      }
    } catch {
      // Unreadable file, no git: nothing to show.
    }
    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    $.ui.status(undefined)
    return next(e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Edit') return next(e)
    const found = await read($, memberOf(notes, e))
    if (found.length === 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {await next(e)}
        {found.map(note => (
          <Text dimColor wrap="truncate-end">
            {'  '}blame {note}
          </Text>
        ))}
      </Box>
    )
  })
}
