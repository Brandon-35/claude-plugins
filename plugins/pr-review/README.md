# pr-review

Read a GitHub pull request in a pane beside the chat: description, changed files, each file's diff, reviews and comments. Modelled on the [GitHub Pull Requests](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-pull-request-github) VS Code extension.

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install pr-review@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer and the [GitHub CLI](https://cli.github.com) (`gh`), signed in (`gh auth login`), in a folder whose git remote is a GitHub repository. The pane docks beside the chat in the fullscreen layout (`"tui": "fullscreen"`, terminal at least 110 columns wide); otherwise it opens above the prompt.

## Use

| Command | What it does |
| --- | --- |
| `/pr` | Lists the open pull requests of the current repository (up to 30) |
| `/pr <number>` | Opens that pull request |

The pane takes the keyboard when it opens: `Tab` / arrows walk the rows, `Enter` opens a pull request or a file's diff, `b` goes back one level, `PageDown` / arrows scroll, `Esc` returns to the prompt.

**Read-only.** The plugin runs `gh repo view`, `gh pr list`, `gh pr view`, `gh pr diff` and a `GET` on the pull request's review comments. It never comments, reviews, approves, merges, checks out or edits: a pane button would bypass Claude Code's permission prompts, so writing is left to Claude through the Bash tool.

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install pr-review@brandon-35-plugins --scope local`), in a folder whose `origin` is this repository.

```
❯ /pr
  ⎿  pr-review: Pull requests opened.

│#6 feat(git-compare): compare refs and folders in a pane Brandon-35 · git-compare
│#5 feat(git-history): file history pane Brandon-35 · git-history
│#4 feat(blame-lens): inline blame for edits and /blame Brandon-35 · blame-lens
│#3 feat(git-graph): commit graph pane Brandon-35 · git-graph
```

`Enter` on `#3`:

```
│[ Back to list ]
│#3 feat(git-graph): commit graph pane
│OPEN  git-graph → main  by Brandon-35
│+427 −3, 9 files
│https://github.com/Brandon-35/claude-plugins/pull/3
│
│Part of #1
│
│Adds plugins/git-graph: /git-graph [max-commits] opens a pane with git log --graph --all;
│picking a commit shows its header, stat and per-file diff (Code format=diff). Read-only.
│…
│Files
│.claude-plugin/marketplace.json  +12 −2
│README.md  +3 −1
│plugins/git-graph/.claude-plugin/plugin.json  +10 −0
│plugins/git-graph/README.md  +84 −0
│plugins/git-graph/hooks/git.ts  +86 −0
│…
│Reviews and comments
│Brandon-35
│Live check note: the pane is opened with `focus: true` because `ctrl+x tab` hands the
│keyboard to whichever band comes first when several mods draw one. …
```

`Enter` on `plugins/git-graph/hooks/git.ts`:

```
│[ Back to PR ]
│plugins/git-graph/hooks/git.ts
│  1 +// Pure helpers: build git argv lists and parse their output. No `$` here, so
│  2 +// the tests can feed them canned output.
│  3 +
│  4 +const SEP = '\x1f'
```

A merged pull request, and the error paths:

```
❯ /pr 2
│#2 Scaffold: research, marketplace manifest, install notes
│MERGED  scaffold → main  by Brandon-35
│+106 −1, 4 files
│…
│Reviews and comments
│No reviews or comments.

❯ /pr abc
  ⎿  pr-review: Usage: /pr [number]
❯ /pr 999
│GraphQL: Could not resolve to a PullRequest with the number of 999.
```

## Develop

```
claude plugin validate plugins/pr-review
claude plugin test plugins/pr-review
```

## Limits

- Inline review comments (`path:line  author: body`) are covered by tests on canned data only: no pull request with inline comments was at hand for the live run.
- The description is cut at 4,000 characters, each review or comment at 1,000.
- `gh pr diff` fails on very large pull requests; the file list still shows and the diff view shows gh's error.
- GitHub only; other forges are not supported.
