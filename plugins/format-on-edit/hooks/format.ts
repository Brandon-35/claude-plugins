export type Candidate = { dir: string; bin: string }

// shortcut: POSIX paths only (no prettier.cmd, no drive letters), add them when Windows matters.
/** Every place a local prettier may live, from the file's directory up to the root. */
export function candidates(file: string): Candidate[] {
  if (!file.startsWith('/')) return []
  const found: Candidate[] = []
  let dir = file
  do {
    dir = dir.slice(0, dir.lastIndexOf('/'))
    found.push({ dir: dir || '/', bin: `${dir}/node_modules/.bin/prettier` })
  } while (dir)
  return found
}

export const formatArgv = (bin: string, file: string) => [
  bin, '--write', '--ignore-unknown', '--log-level', 'warn', file,
]

export const basename = (file: string) => file.slice(file.lastIndexOf('/') + 1)

export const firstLine = (stderr: string) =>
  stderr.split('\n').find(line => line.trim())?.trim() ?? 'no error output'
