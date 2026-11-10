import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import {
  dirsArgv,
  labelOf,
  parseDirs,
  parsePatch,
  relativize,
  parseRefs,
  pathOf,
  refsArgv,
  verifyArgv,
} from './git'
import type { Status } from './git'

const PANE = 'git-compare'
// A tree draws at most 100k characters; leave room for the header.
const DIFF_BUDGET = 80_000
const COLORS: Record<Status, string> = {
  A: 'success',
  M: 'warning',
  D: 'error',
  R: 'suggestion',
}

const mode = atom({ plugin: 'git-compare', key: 'mode' } as const, null)
const a = atom({ plugin: 'git-compare', key: 'a' } as const, '')
const b = atom({ plugin: 'git-compare', key: 'b' } as const, '')
const selected = atom({ plugin: 'git-compare', key: 'selected' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'compare',
      description: 'Compare two refs (branches, tags, commits) in a pane',
      argumentHint: '<ref-a> [ref-b]',
    })
    await $.command.register({
      name: 'compare-dirs',
      description: 'Compare two folders or files in a pane',
      argumentHint: '<dir-a> <dir-b>',
    })
    return next(e)
  })

  on('command.run', { command: 'compare' }, async ($, e) => {
    const parsed = parseRefs(e.args)
    if ('error' in parsed) return { text: parsed.error }
    for (const ref of parsed.refs) {
      const known = await $.process.run(verifyArgv(ref))
      if (known.exitCode !== 0) return { text: `Unknown ref: ${ref}` }
    }
    await update($, mode, () => 'refs' as const)
    await update($, a, () => parsed.a)
    await update($, b, () => parsed.b)
    await update($, selected, () => null)
    const [left = parsed.a, right = parsed.b || 'working tree'] =
      parsed.b === '' && parsed.refs.length === 2 ? parsed.refs : []
    await $.ui.open({
      id: PANE,
      title: `Compare: ${left} ↔ ${right}`,
      focus: true,
    })
    return { text: `Comparing ${left} and ${right}.` }
  })

  on('command.run', { command: 'compare-dirs' }, async ($, e) => {
    const parsed = parseDirs(e.args)
    if ('error' in parsed) return { text: parsed.error }
    await update($, mode, () => 'dirs' as const)
    await update($, a, () => parsed.a)
    await update($, b, () => parsed.b)
    await update($, selected, () => null)
    await $.ui.open({
      id: PANE,
      title: `Compare: ${parsed.a} ↔ ${parsed.b}`,
      focus: true,
    })
    return { text: `Comparing ${parsed.a} and ${parsed.b}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const how = await read($, mode)
    if (how === null) {
      return <Text dimColor>Run /compare or /compare-dirs.</Text>
    }
    const left = await read($, a)
    const right = await read($, b)
    const path = await read($, selected)

    const run = await $.process.run(
      how === 'refs' ? refsArgv(left, right) : dirsArgv(left, right),
    )
    const back = (
      <Button
        key="back"
        label="Back to files"
        hotkey="b"
        autoFocus
        onPress={() => update($, selected, () => null)}
      />
    )
    // `--no-index` exits 1 when the sides differ (and when a path is missing,
    // with nothing on stdout): only 2 and up, or an empty diff with stderr, fails.
    if (
      run.exitCode > (how === 'dirs' ? 1 : 0) ||
      (run.stdout === '' && run.stderr.trim() !== '')
    ) {
      return (
        <Box flexDirection="column">
          {path === null ? '' : back}
          <Text color="error">{run.stderr.trim() || 'git diff failed'}</Text>
        </Box>
      )
    }
    const files =
      how === 'dirs'
        ? relativize(parsePatch(run.stdout), left, right)
        : parsePatch(run.stdout)
    const cut = run.isStdoutTruncated ? (
      <Text color="warning">Output was truncated: the list may be incomplete.</Text>
    ) : (
      ''
    )

    if (path === null) {
      if (files.length === 0) return <Text dimColor>No differences.</Text>
      const added = files.reduce((n, f) => n + f.added, 0)
      const removed = files.reduce((n, f) => n + f.removed, 0)
      return (
        <Box flexDirection="column">
          <Text bold>
            {files.length} {files.length === 1 ? 'file' : 'files'} changed, +{added} −
            {removed}
          </Text>
          {cut}
          {files.map((f, i) => (
            <Button
              key={`f${i}-${pathOf(f)}`}
              plain
              onPress={() => update($, selected, () => pathOf(f))}
            >
              <Text color={COLORS[f.status]} bold>
                {f.status}
              </Text>
              {` ${labelOf(f)} `}
              {f.binary ? (
                <Text dimColor>binary</Text>
              ) : (
                <Text color="diffAdded">+{f.added}</Text>
              )}
              {f.binary ? '' : <Text color="diffRemoved"> −{f.removed}</Text>}
            </Button>
          ))}
        </Box>
      )
    }

    const file = files.find(f => pathOf(f) === path)
    return (
      <Box flexDirection="column">
        {back}
        <Text bold color="suggestion">
          {file ? labelOf(file) : path}
        </Text>
        {cut}
        {!file ? (
          <Text dimColor>This file no longer differs.</Text>
        ) : file.hunks === '' ? (
          <Text dimColor>
            {file.binary ? 'Binary file differs.' : 'No content change (rename or mode only).'}
          </Text>
        ) : file.hunks.length > DIFF_BUDGET ? (
          <Text dimColor>(diff too large to draw here)</Text>
        ) : (
          <Code source={file.hunks} format="diff" path={pathOf(file)} />
        )}
      </Box>
    )
  })
}
