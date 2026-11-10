import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { logArgv, parseLog, parseShow, showArgv } from './git'

const PANE = 'git-history'
// A tree draws at most 100k characters; leave room for the header.
const DIFF_BUDGET = 80_000

const path = atom({ plugin: 'git-history', key: 'path' } as const, null)
const selected = atom({ plugin: 'git-history', key: 'selected' } as const, null)
const selectedPaths = atom(
  { plugin: 'git-history', key: 'selectedPaths' } as const,
  [] as string[],
)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'file-history',
      description: 'Show the history of one file in a pane',
      argumentHint: '<path>',
    })
    return next(e)
  })

  on('command.run', { command: 'file-history' }, async ($, e) => {
    const file = e.args.trim()
    if (file === '') return { text: 'Usage: /file-history <path>' }
    const probe = await $.process.run(logArgv(file))
    if (probe.exitCode !== 0) {
      return {
        text: `${probe.stderr.trim().split('\n')[0] || 'git log failed'}`,
      }
    }
    if (parseLog(probe.stdout).length === 0) {
      return { text: `No history for ${file}.` }
    }
    await update($, path, () => file)
    await update($, selected, () => null)
    await $.ui.open({ id: PANE, title: `History: ${file}`, focus: true })
    return { text: `History of ${file} opened.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const file = await read($, path)
    const sha = await read($, selected)
    if (file === null) return <Text dimColor>Run /file-history &lt;path&gt;.</Text>

    if (sha === null) {
      const run = await $.process.run(logArgv(file))
      if (run.exitCode !== 0) {
        return <Text color="error">{run.stderr.trim() || 'git log failed'}</Text>
      }
      const entries = parseLog(run.stdout)
      if (entries.length === 0) return <Text dimColor>No history for {file}.</Text>
      return (
        <Box flexDirection="column">
          <Text bold>
            {file} ({entries.length} commits)
          </Text>
          {entries.map((c, i) => (
            <Button
              key={`c${i}-${c.sha}`}
              plain
              onPress={async () => {
                await update($, selectedPaths, () =>
                  c.oldPath ? [c.oldPath, c.path] : [c.path],
                )
                await update($, selected, () => c.sha)
              }}
            >
              <Text color="warning">{c.sha}</Text>
              {` ${c.date} ${c.subject} `}
              <Text dimColor>{c.author}</Text>
              {c.oldPath ? <Text dimColor>{` ${c.oldPath} → ${c.path}`}</Text> : ''}
            </Button>
          ))}
        </Box>
      )
    }

    const back = (
      <Button
        key="back"
        label="Back to history"
        hotkey="b"
        autoFocus
        onPress={() => update($, selected, () => null)}
      />
    )
    const run = await $.process.run(showArgv(sha, await read($, selectedPaths)))
    if (run.exitCode !== 0) {
      return (
        <Box flexDirection="column">
          {back}
          <Text color="error">{run.stderr.trim() || `git show ${sha} failed`}</Text>
        </Box>
      )
    }
    const detail = parseShow(run.stdout)
    return (
      <Box flexDirection="column">
        {back}
        <Text bold>{detail.header}</Text>
        {detail.hunks === '' ? (
          <Text dimColor>(no content change, e.g. a pure rename)</Text>
        ) : detail.hunks.length > DIFF_BUDGET ? (
          <Text dimColor>(diff too large to draw here)</Text>
        ) : (
          <Code source={detail.hunks} format="diff" path={file} />
        )}
      </Box>
    )
  })
}
