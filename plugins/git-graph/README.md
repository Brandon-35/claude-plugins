# git-graph

A commit graph of every branch, in a pane beside the chat. Pick a commit to see its message, stats and diff. Modelled on the [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) VS Code extension.

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install git-graph@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer and `git` on the PATH. The pane docks beside the chat in the fullscreen layout (`"tui": "fullscreen"`, terminal at least 110 columns wide); otherwise it opens above the prompt.

## Use

| Command | What it does |
| --- | --- |
| `/git-graph` | Opens the graph of all refs, newest first (up to 300 commits) |
| `/git-graph 50` | Same, limited to 50 commits |

The pane takes the keyboard when it opens: `Tab` / arrows walk the commits, `Enter` opens one, `b` goes back to the graph, `Esc` returns to the prompt.

The plugin only reads: it runs `git rev-parse`, `git log --graph --all` and `git show`. Checkout, merge, rebase and push from the graph are left out on purpose, since a pane button would bypass Claude Code's permission prompts.

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install git-graph@brandon-35-plugins --scope local`), run in a demo repository with two feature branches, a merge, a tag and a rename.

`/git-graph`:

```
❯ /git-graph
  ⎿  git-graph: Git graph opened (up to 300 commits).

│* 5f80e23 (feature/sub) feat(lib): add sub Ada, 9 days ago
│* 72fbb07 (HEAD -> main) fix(lib): guard division by zero Linus, 2 weeks ago
│* fb67d67 refactor(lib): rename math to arith Grace, 3 weeks ago
│*   58eed58 (tag: v0.1.0) Merge branch 'feature/greeting' Linus, 4 weeks ago
│|\
│* | 9fcfb55 feat(lib): add div Linus, 4 weeks ago
│| * 9613884 (feature/greeting) feat: add farewell Ada, 5 weeks ago
│| * b58cf89 refactor: use f-string in greet Grace, 5 weeks ago
│|/
│* fbe8c03 feat(lib): add math helpers Grace, 5 weeks ago
│* c4c65ec feat: initial app Ada, 6 weeks ago
```

`Tab`, `Tab`, `Enter` on `72fbb07`:

```
│[ Back to graph ]
│commit 72fbb07b475ca2b4f8b5194d2a90696ff0a15ab6
│Author: Linus <linus@example.com>
│Date:   Sun Oct 25 10:00:00 2026 +0700
│Refs:   HEAD -> main
│
│fix(lib): guard division by zero
│---
│ lib/arith.py | 2 +-
│ 1 file changed, 1 insertion(+), 1 deletion(-)
│
│lib/arith.py
│ 1  def mul(a, b):
│ 2      return a * b
│ 3  def div(a, b):
│ 4 -    return a / b
│ 4 +    return a / b if b else 0
```

`b` returned to the graph; `/git-graph 3` listed the newest three commits.

## Develop

```
claude plugin validate plugins/git-graph
claude plugin test plugins/git-graph
```

`hooks/git.ts` holds the git argv builders and output parsers; `hooks/register.tsx` the command and the pane; `tests/` mounts the pane on the terminal and desktop surfaces against canned git output.

## Limits

- A commit's diff is drawn up to about 80,000 characters; larger files say so instead of drawing.
- The graph is `git log --graph` text, not coloured rails.
