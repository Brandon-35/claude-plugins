# git-history

The history of one file, in a pane beside the chat: every commit that touched it (renames followed), and that file's diff in each. Modelled on the [Git History](https://marketplace.visualstudio.com/items?itemName=donjayamanne.githistory) VS Code extension.

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install git-history@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer and `git` on the PATH. The pane docks beside the chat in the fullscreen layout (`"tui": "fullscreen"`, terminal at least 110 columns wide); otherwise it opens above the prompt.

## Use

| Command | What it does |
| --- | --- |
| `/file-history <path>` | Lists up to 200 commits that touched the file, newest first |

The pane takes the keyboard when it opens: `Tab` / arrows walk the commits, `Enter` opens one, `b` goes back to the list, `Esc` returns to the prompt.

Read-only: the plugin runs `git log --follow --name-status` and `git show` and nothing else.

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install git-history@brandon-35-plugins --scope local`), in a demo repository where `lib/math.py` was renamed to `lib/arith.py`.

```
❯ /file-history lib/arith.py
  ⎿  git-history: History of lib/arith.py opened.

│lib/arith.py (4 commits)
│72fbb07 2026-10-25 fix(lib): guard division by zero Linus
│fb67d67 2026-10-20 refactor(lib): rename math to arith Grace lib/math.py → lib/arith.py
│9fcfb55 2026-10-10 feat(lib): add div Linus
│fbe8c03 2026-10-05 feat(lib): add math helpers Grace
```

`Enter` on the rename commit `fb67d67`:

```
│[ Back to history ]
│commit fb67d67cac5a5b8ecc7d52b658b6a0e747dcb43f
│Author: Grace <grace@example.com>
│Date:   2026-10-20
│
│refactor(lib): rename math to arith
│(no content change, e.g. a pure rename)
```

`b`, then `Enter` on the first commit `fbe8c03`, made before the rename:

```
│[ Back to history ]
│commit fbe8c03abe880343df6f08ec12587b70385a7d19
│Author: Grace <grace@example.com>
│Date:   2026-10-05
│
│feat(lib): add math helpers
│ 1 +def mul(a, b):
│ 2 +    return a * b
```

Error paths:

```
❯ /file-history nope.txt
  ⎿  git-history: No history for nope.txt.
❯ /file-history
  ⎿  git-history: Usage: /file-history <path>
```

## Develop

```
claude plugin validate plugins/git-history
claude plugin test plugins/git-history
```

## Limits

- At most 200 commits are listed.
- A diff over about 80,000 characters says so instead of drawing.
- Line history is not a separate view; use `/blame <file>:<line>` from `blame-lens`.
