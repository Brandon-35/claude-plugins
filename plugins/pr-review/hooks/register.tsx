import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import {
  diffArgv,
  inlineArgv,
  listArgv,
  parseInline,
  parseList,
  parseView,
  probeArgv,
  splitPatch,
  truncate,
  viewArgv,
} from './gh'

const PANE = 'pr-review'
const LIST_TITLE = 'Pull requests'
const BODY_MAX = 4_000
const COMMENT_MAX = 1_000
// A tree draws at most 100k characters; leave room for the rest of the view.
const DIFF_BUDGET = 80_000

const pr = atom({ plugin: 'pr-review', key: 'pr' } as const, null)
const file = atom({ plugin: 'pr-review', key: 'file' } as const, null)

const STATE_COLOR = { OPEN: 'success', MERGED: 'merged', CLOSED: 'error' } as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pr',
      description: 'Browse pull requests of this repository in a pane',
      argumentHint: '[number]',
    })
    return next(e)
  })

  on('command.run', { command: 'pr' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg !== '' && !/^\d+$/.test(arg)) return { text: 'Usage: /pr [number]' }
    const n = arg === '' ? null : Number.parseInt(arg, 10)
    const probe = await $.process.run(probeArgv()).catch(err => ({
      exitCode: 1,
      stderr: String(err),
    }))
    if (probe.exitCode !== 0) {
      return { text: probe.stderr.trim().split('\n')[0] || 'gh failed' }
    }
    await update($, pr, () => n)
    await update($, file, () => null)
    await $.ui.open({
      id: PANE,
      title: n === null ? LIST_TITLE : `PR #${n}`,
      focus: true,
    })
    return { text: n === null ? 'Pull requests opened.' : `PR #${n} opened.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code, Markdown } = $.ui.resolve(e)
    const n = await read($, pr)
    const path = await read($, file)
    const go = async (next: number | null, title: string) => {
      await update($, pr, () => next)
      await update($, file, () => null)
      await $.ui.open({ id: PANE, title, focus: true })
    }

    if (n === null) {
      const run = await $.process.run(listArgv())
      if (run.exitCode !== 0) {
        return <Text color="error">{run.stderr.trim() || 'gh pr list failed'}</Text>
      }
      const rows = parseList(run.stdout)
      if (rows.length === 0) return <Text dimColor>No open pull requests.</Text>
      return (
        <Box flexDirection="column">
          {rows.map(row => (
            <Button
              key={`pr${row.number}`}
              plain
              onPress={() => go(row.number, `PR #${row.number}`)}
            >
              <Text color="warning">#{row.number}</Text>
              {` ${row.title} `}
              <Text dimColor>
                {row.author} · {row.branch}
              </Text>
              {row.isDraft ? <Text dimColor> draft</Text> : ''}
            </Button>
          ))}
        </Box>
      )
    }

    const [view, diff, inline] = await Promise.all([
      $.process.run(viewArgv(n)),
      $.process.run(diffArgv(n)),
      $.process.run(inlineArgv(n)),
    ])
    const toList = (
      <Button
        key="back"
        label="Back to list"
        hotkey="b"
        autoFocus
        onPress={() => go(null, LIST_TITLE)}
      />
    )
    if (view.exitCode !== 0) {
      return (
        <Box flexDirection="column">
          {toList}
          <Text color="error">{view.stderr.trim() || `gh pr view ${n} failed`}</Text>
        </Box>
      )
    }
    const p = parseView(view.stdout)

    if (path !== null) {
      const hunks = splitPatch(diff.stdout).find(f => f.path === path)?.hunks ?? ''
      return (
        <Box flexDirection="column">
          <Button
            key="back"
            label="Back to PR"
            hotkey="b"
            autoFocus
            onPress={() => update($, file, () => null)}
          />
          <Text bold color="suggestion">
            {path}
          </Text>
          {diff.exitCode !== 0 ? (
            <Text color="error">{diff.stderr.trim() || 'gh pr diff failed'}</Text>
          ) : hunks === '' ? (
            <Text dimColor>(binary or mode-only change)</Text>
          ) : hunks.length > DIFF_BUDGET ? (
            <Text dimColor>(diff too large to draw here)</Text>
          ) : (
            <Code source={hunks} format="diff" path={path} />
          )}
        </Box>
      )
    }

    const body = truncate(p.body.trim(), BODY_MAX)
    return (
      <Box flexDirection="column">
        {toList}
        <Text bold>
          #{p.number} {p.title}
        </Text>
        <Text>
          <Text color={STATE_COLOR[p.state as keyof typeof STATE_COLOR] ?? 'subtle'}>
            {p.state}
          </Text>
          {p.isDraft ? ' draft' : ''}
          {`  ${p.head} → ${p.base}  by ${p.author}`}
        </Text>
        <Text>
          <Text color="diffAdded">+{p.additions}</Text>{' '}
          <Text color="diffRemoved">−{p.deletions}</Text>
          {`, ${p.changedFiles} files`}
          {p.reviewDecision ? `  ${p.reviewDecision}` : ''}
        </Text>
        <Text dimColor>{p.url}</Text>

        <Box flexDirection="column" marginTop={1}>
          {body.text === '' ? (
            <Text dimColor>No description.</Text>
          ) : (
            <Markdown text={body.text} />
          )}
          {body.cut ? (
            <Text dimColor>(description cut at {BODY_MAX} characters)</Text>
          ) : null}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>Files</Text>
          {p.files.map(f => (
            <Button
              key={`f-${f.path}`}
              plain
              onPress={() => update($, file, () => f.path)}
            >
              {`${f.path}  `}
              <Text color="diffAdded">+{f.additions}</Text>{' '}
              <Text color="diffRemoved">−{f.deletions}</Text>
            </Button>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>Reviews and comments</Text>
          {p.reviews.length + p.comments.length === 0 ? (
            <Text dimColor>No reviews or comments.</Text>
          ) : null}
          {p.reviews.map((r, i) => (
            <Box key={`r${i}`} flexDirection="column">
              <Text>
                <Text color="suggestion">{r.author}</Text> {r.state}
              </Text>
              {r.body.trim() === '' ? null : (
                <Text>{truncate(r.body.trim(), COMMENT_MAX).text}</Text>
              )}
            </Box>
          ))}
          {p.comments.map((c, i) => (
            <Box key={`c${i}`} flexDirection="column">
              <Text color="suggestion">{c.author}</Text>
              <Text>{truncate(c.body.trim(), COMMENT_MAX).text}</Text>
            </Box>
          ))}
        </Box>

        {inline.exitCode !== 0 ? (
          <Text dimColor>inline comments unavailable</Text>
        ) : (
          parseInline(inline.stdout).map(c => (
            <Text>
              {`${c.path}${c.line === null ? '' : `:${c.line}`}  `}
              <Text color="suggestion">{c.author}</Text>
              {`: ${truncate(c.body.trim(), COMMENT_MAX).text}`}
            </Text>
          ))
        )}
      </Box>
    )
  })
}
