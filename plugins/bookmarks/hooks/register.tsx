import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Register } from 'claude-code'

import {
  ROOT_ARGV,
  addBookmark,
  asBookmarks,
  contextText,
  excerpt,
  idOf,
  lineCount,
  parseArgs,
  relativeTo,
  sortBookmarks,
  storeKey,
} from './bookmarks'
import type { Bookmark } from './bookmarks'

const PANE = 'bookmarks'

const root = atom({ plugin: 'bookmarks', key: 'root' } as const, '')
const list = atom({ plugin: 'bookmarks', key: 'list' } as const, [])
const selected = atom({ plugin: 'bookmarks', key: 'selected' } as const, null)

/** Reads the project's bookmarks from the store and mirrors them in the atoms. */
async function load($: CoreEngineInterface) {
  const cwd = await $.session.cwd()
  const probe = await $.process
    .run(ROOT_ARGV, { cwd })
    .catch(() => ({ exitCode: 1, stdout: '' }))
  const dir = (probe.exitCode === 0 && probe.stdout.trim()) || cwd
  const stored = asBookmarks(await $.store.get(storeKey(dir)))
  await update($, root, () => dir)
  await update($, list, () => stored)
  return { dir, stored }
}

async function save($: CoreEngineInterface, dir: string, next: Bookmark[]) {
  await $.store.set(storeKey(dir), next)
  await update($, list, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bookmark',
      description: 'Bookmark a line of a file',
      argumentHint: '<file>[:line] [note]',
    })
    await $.command.register({
      name: 'bookmarks',
      description: 'List the bookmarks of this project in a pane',
    })
    await $.command.register({
      name: 'bookmark-clear',
      description: 'Remove every bookmark of this project',
    })
    await load($)
    return next(e)
  })

  on('command.run', { command: 'bookmark' }, async ($, e) => {
    const parsed = parseArgs(e.args)
    if ('error' in parsed) return { text: parsed.error }
    const { dir, stored } = await load($)
    const file = relativeTo(dir, parsed.file)
    const text = await $.fs.read(`${dir}/${file}`).catch(() => null)
    if (text === null) return { text: `Cannot read ${file}` }
    const last = lineCount(text)
    if (parsed.line > last) {
      return { text: `${file} has only ${last} lines` }
    }
    const addedAt = new Date(await $.clock.now()).toISOString()
    await save(
      $,
      dir,
      addBookmark(stored, { file, line: parsed.line, note: parsed.note, addedAt }),
    )
    return {
      text: `Bookmarked ${file}:${parsed.line}${parsed.note ? `  ${parsed.note}` : ''}`,
    }
  })

  on('command.run', { command: 'bookmarks' }, async ($, _e) => {
    const { stored } = await load($)
    await update($, selected, () => null)
    await $.ui.open({ id: PANE, title: 'Bookmarks', focus: true })
    return {
      text: `Bookmarks opened (${stored.length}).`,
      ...(stored.length > 0 ? { context: [contextText(stored)] } : {}),
    }
  })

  on('command.run', { command: 'bookmark-clear' }, async ($, _e) => {
    const { dir, stored } = await load($)
    await save($, dir, [])
    await update($, selected, () => null)
    return { text: `Removed ${stored.length} bookmark${stored.length === 1 ? '' : 's'}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const all = sortBookmarks(asBookmarks(await read($, list)))
    const id = await read($, selected)
    const current = all.find(b => idOf(b) === id)

    if (!current) {
      if (all.length === 0) {
        return (
          <Text dimColor>No bookmarks. Add one with /bookmark {'<file>[:line] [note]'}.</Text>
        )
      }
      return (
        <Box flexDirection="column">
          {all.map(b => (
            <Button
              key={`open-${idOf(b)}`}
              plain
              onPress={() => update($, selected, () => idOf(b))}
            >
              {idOf(b)}
              {b.note ? <Text color="subtle">{`  ${b.note}`}</Text> : ''}
            </Button>
          ))}
        </Box>
      )
    }

    const dir = await read($, root)
    const text = await $.fs.read(`${dir}/${current.file}`).catch(() => null)
    const view = text === null ? null : excerpt(text, current.line)
    return (
      <Box flexDirection="column">
        <Button
          key="back"
          label="Back to bookmarks"
          hotkey="b"
          autoFocus
          onPress={() => update($, selected, () => null)}
        />
        <Button
          key="delete"
          label="Delete bookmark"
          hotkey="d"
          onPress={async () => {
            await save(
              $,
              dir,
              all.filter(b => idOf(b) !== idOf(current)),
            )
            await update($, selected, () => null)
          }}
        />
        <Text bold>{idOf(current)}</Text>
        {current.note ? <Text color="subtle">{current.note}</Text> : ''}
        {view === null ? (
          <Text color="error">File not found</Text>
        ) : (
          <Code source={view.source} path={current.file} startLine={view.first} />
        )}
      </Box>
    )
  })
}
