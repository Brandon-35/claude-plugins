# blame-lens

Inline git blame for the lines Claude edits. Modelled on [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) current-line blame and the [Git Blame](https://marketplace.visualstudio.com/items?itemName=waderyan.gitblame) status bar.

In an editor, blame follows the cursor. In Claude Code the cursor is the edit Claude is about to make, so `blame-lens` takes the blame of the lines an `Edit` replaces **before** the edit runs (afterwards git only says "Not Committed Yet") and shows it:

- as a dim line under that `Edit`'s row in the transcript: who last changed those lines, when, in which commit;
- on the status line, until your next prompt.

`/blame` gives the same on demand for any file, line or range.

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install blame-lens@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer and `git` on the PATH.

## Use

| Command | What it does |
| --- | --- |
| `/blame <file>` | Blame of the whole file (first 200 lines) |
| `/blame <file>:<line>` | Blame of one line |
| `/blame <file>:<start>-<end>` | Blame of a line range |

Edits need no command: every `Edit` Claude makes in a git repository is annotated. A file outside a repository, a new file, or a failing `git blame` is left unannotated; the hook never blocks or delays the edit beyond the `git blame` call. Read-only: the plugin runs `git blame --porcelain` and nothing else.

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install blame-lens@brandon-35-plugins --scope local`), in a demo repository with three authors.

Asking Claude to change one line of `lib/arith.py`:

```
⏺ Update(lib/arith.py)
  blame L4 Linus, 2 weeks ago · 72fbb07 fix(lib): guard division by zero
  ⎿  Added 1 line, removed 1 line
      1  def mul(a, b):
      2      return a * b
      3  def div(a, b):
      4 -    return a / b if b else 0
      4 +    return a / b if b else None
```

The status line then read `blame-lens: L4 Linus, 2 weeks ago · 72fbb07 fix(lib): guard division by zero`.

`/blame`:

```
❯ /blame lib/arith.py:3-4
  ⎿  blame-lens: lib/arith.py:3-4
     9fcfb55 Linus 1 month ago      3│ def div(a, b):
     72fbb07 Linus 2 weeks ago      4│     return a / b if b else 0
❯ /blame nope.py
  ⎿  blame-lens: blame: fatal: no such path 'nope.py' in HEAD
```

## Develop

```
claude plugin validate plugins/blame-lens
claude plugin test plugins/blame-lens
```

`hooks/blame.ts` holds the argv builder, the porcelain parser and the formatting; `hooks/register.tsx` the `tool.call` hook on `Edit`, the `ToolUse` row annotation and `/blame`.

## Limits

- Only `Edit` is annotated. A `Write` that replaces a whole file is not.
- An `Edit` with `replace_all` is annotated for its first match only.
- Runs of lines are grouped per commit; more than three groups are shown as `+N more`.
