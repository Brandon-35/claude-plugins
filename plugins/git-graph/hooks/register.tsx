import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { graphArgv, parseGraph, parseShow, showArgv } from './git'

const PANE = 'git-graph'
const DEFAULT_LIMIT = 300
// A tree draws at most 100k characters; leave room for the header and stat.
const DIFF_BUDGET = 80_000

const selected = atom({ plugin: 'git-graph', key: 'selected' } as const, null)
const limit = atom(
  { plugin: 'git-graph', key: 'limit' } as const,
  DEFAULT_LIMIT,
)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'git-graph',
      description: 'Show the commit graph of all branches in a pane',
      argumentHint: '[max-commits]',
    })
    return next(e)
  })

  on('command.run', { command: 'git-graph' }, async ($, e) => {
    const asked = Number.parseInt(e.args.trim(), 10)
    const n = Number.isFinite(asked) && asked > 0 ? asked : DEFAULT_LIMIT
    await update($, limit, () => n)
    await update($, selected, () => null)
    const probe = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    if (probe.exitCode !== 0) {
      return { text: 'git-graph: not inside a git repository.' }
    }
    await $.ui.open({ id: PANE, title: 'Git graph', focus: true })
    return { text: `Git graph opened (up to ${n} commits).` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const sha = await read($, selected)

    if (sha === null) {
      const run = await $.process.run(graphArgv(await read($, limit)))
      if (run.exitCode !== 0) {
        return <Text color="error">{run.stderr.trim() || 'git log failed'}</Text>
      }
      const rows = parseGraph(run.stdout)
      if (rows.length === 0) return <Text dimColor>No commits yet.</Text>
      return (
        <Box flexDirection="column">
          {rows.map((row, i) =>
            row.kind === 'edge' ? (
              <Text color="subtle" wrap="truncate-end">
                {row.graph}
              </Text>
            ) : (
              <Button
                key={`c${i}-${row.sha}`}
                plain
                onPress={() => update($, selected, () => row.sha)}
              >
                <Text color="subtle">{row.graph}</Text>
                <Text color="warning">{row.sha}</Text>
                {row.refs ? <Text color="success"> ({row.refs})</Text> : ''}
                {` ${row.subject} `}
                <Text dimColor>
                  {row.author}, {row.age}
                </Text>
              </Button>
            ),
          )}
        </Box>
      )
    }

    const run = await $.process.run(showArgv(sha))
    const back = (
      <Button
        key="back"
        label="Back to graph"
        hotkey="b"
        autoFocus
        onPress={() => update($, selected, () => null)}
      />
    )
    if (run.exitCode !== 0) {
      return (
        <Box flexDirection="column">
          {back}
          <Text color="error">{run.stderr.trim() || `git show ${sha} failed`}</Text>
        </Box>
      )
    }
    const detail = parseShow(run.stdout)
    let budget = DIFF_BUDGET
    return (
      <Box flexDirection="column">
        {back}
        <Text bold>{detail.header}</Text>
        <Text dimColor>{detail.stat}</Text>
        {detail.files.map(file => {
          const fits = file.hunks.length <= budget
          budget -= fits ? file.hunks.length : 0
          return (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color="suggestion">
                {file.path}
              </Text>
              {file.hunks === '' ? (
                <Text dimColor>(binary or mode-only change)</Text>
              ) : fits ? (
                <Code source={file.hunks} format="diff" path={file.path} />
              ) : (
                <Text dimColor>(diff too large to draw here)</Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
