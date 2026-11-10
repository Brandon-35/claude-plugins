import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { grepArgv, parseGrep, parseTag, summary, TAGS } from './todo'
import type { Tag } from './todo'

const PANE = 'todo-tree'
const MAX_ROWS = 200
const CONTEXT = 5

const COLOR = {
  TODO: 'suggestion',
  FIXME: 'error',
  BUG: 'error',
  HACK: 'warning',
  XXX: 'warning',
} as const

const tag = atom({ plugin: 'todo-tree', key: 'tag' } as const, null)
const selected = atom({ plugin: 'todo-tree', key: 'selected' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'todos',
      description: 'List the TODO, FIXME, HACK, BUG and XXX tags of the repository in a pane',
      argumentHint: '[tag]',
    })
    return next(e)
  })

  on('command.run', { command: 'todos' }, async ($, e) => {
    const asked = parseTag(e.args)
    if (asked === undefined) {
      return { text: `todos: unknown tag. Valid tags: ${TAGS.join(', ')}.` }
    }
    await update($, tag, () => asked)
    await update($, selected, () => null)
    await $.ui.open({ id: PANE, title: 'Todo tree', focus: true })
    return { text: `Todo tree opened (${asked ?? 'all tags'}).` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const at = await read($, selected)

    if (at === null) {
      // The stored tag is one parseTag accepted.
      const only = (await read($, tag)) as Tag | null
      const run = await $.process.run(grepArgv(only))
      // git grep exits 1 when nothing matches.
      if (run.exitCode === 1) return <Text dimColor>No TODO tags found.</Text>
      if (run.exitCode !== 0) {
        return <Text color="error">{run.stderr.trim() || 'git grep failed'}</Text>
      }
      const todos = parseGrep(run.stdout, only)
      if (todos.length === 0) return <Text dimColor>No TODO tags found.</Text>
      const shown = todos.slice(0, MAX_ROWS)
      return (
        <Box flexDirection="column">
          <Text dimColor>{summary(todos)}</Text>
          {shown.map((todo, i) => [
            todo.file === shown[i - 1]?.file ? null : <Text bold>{todo.file}</Text>,
            <Button
              key={`${todo.file}:${todo.line}`}
              plain
              onPress={() =>
                update($, selected, () => ({ file: todo.file, line: todo.line }))
              }
            >
              <Text color="subtle">{`  ${todo.line}  `}</Text>
              <Text color={COLOR[todo.tag]}>{todo.tag}</Text>
              {`  ${todo.text}`}
            </Button>,
          ])}
          {todos.length > MAX_ROWS ? (
            <Text dimColor>{`… ${todos.length - MAX_ROWS} more not shown`}</Text>
          ) : null}
        </Box>
      )
    }

    const back = (
      <Button
        key="back"
        label="Back to list"
        hotkey="b"
        autoFocus
        onPress={() => update($, selected, () => null)}
      />
    )
    let source: string
    try {
      source = await $.fs.read(at.file)
    } catch (err) {
      return (
        <Box flexDirection="column">
          {back}
          <Text color="error">{`Cannot read ${at.file}: ${String(err)}`}</Text>
        </Box>
      )
    }
    const first = Math.max(1, at.line - CONTEXT)
    return (
      <Box flexDirection="column">
        {back}
        <Text bold>{`${at.file}:${at.line}`}</Text>
        <Code
          source={source.split('\n').slice(first - 1, at.line + CONTEXT).join('\n')}
          path={at.file}
          startLine={first}
        />
      </Box>
    )
  })
}
