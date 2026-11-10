# Research: the most-installed VS Code git diff/history extensions

Queried on 2026-11-10 from the Visual Studio Marketplace gallery API
(`POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`,
search terms `git`, `git diff`, `git history`, `git blame`, `diff folder`, `compare`,
sorted by install count). Install counts are the `install` statistic the API
returned that day.

## Inclusion rule

An extension counts when its core job is **viewing git diffs, history or
blame**. Higher-install extensions that do something else were left out:

| Extension | Installs | Why it is not in the top 5 |
| --- | ---: | --- |
| GitHub Copilot / Copilot Chat | 74.9M / 79.2M | AI assistant, not a git viewer |
| GitHub Theme | 20.6M | Color theme |
| GitHub Actions | 9.0M | CI workflows |
| GitHub Codespaces, GitHub Repositories, Remote Repositories | 8.6M / 7.1M / 6.8M | Remote environments |
| gitignore | 6.5M | `.gitignore` templates |
| Open in GitHub | 4.6M | Opens a URL, shows no diff or history |
| GitDoc | 3.9M (3,936,231) | Auto-commits on save; it writes history, it does not show it |
| Git Extension Pack | 3.8M | A bundle of the extensions below |

## The top 5

| # | Extension | Installs | Marketplace |
| - | --- | ---: | --- |
| 1 | GitLens — Git supercharged (`eamodio.gitlens`) | 53,838,983 | https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens |
| 2 | GitHub Pull Requests (`GitHub.vscode-pull-request-github`) | 37,408,852 | https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-pull-request-github |
| 3 | Git History (`donjayamanne.githistory`) | 17,525,261 | https://marketplace.visualstudio.com/items?itemName=donjayamanne.githistory |
| 4 | Git Graph (`mhutchie.git-graph`) | 15,688,058 | https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph |
| 5 | Git Blame (`waderyan.gitblame`) | 3,915,465 | https://marketplace.visualstudio.com/items?itemName=waderyan.gitblame |

Folder-diff extensions came in far lower (Compare Folders 725,534; Diff Folders
221,965), so folder diff is folded into `git-compare` instead of getting a
plugin of its own.

## What each plugin takes

Claude Code mods (2.1.312+) can add a pane beside the chat, a band above the
prompt, a line under a tool call's row, a status line entry, toasts and slash
commands, and can run host commands (`git`, `gh`). Each feature below was
picked because it fits one of those extension points.

| Extension | Feature taken | Plugin |
| --- | --- | --- |
| GitLens | Current-line blame annotation and blame hover (who last changed this line, when, in which commit) | `blame-lens` |
| GitLens | Search & Compare: compare two branches, tags or commits, file by file | `git-compare` |
| Git Blame | Status-bar blame of the line being worked on | `blame-lens` (status line) |
| Git History | File history: every commit that touched one file, and that file's diff in each | `git-history` |
| Git Graph | Commit graph of all branches, commit details, files changed and diff of a commit | `git-graph` |
| GitHub Pull Requests | Review a pull request inside the editor: description, changed files, per-file diff, review comments | `pr-review` |
| Diff Folders / Compare Folders | Compare two folders | `git-compare` (`/compare-dirs`) |

### How the features map to Claude Code

- **Inline blame → `blame-lens`.** VS Code shows blame at the cursor. In Claude
  Code the "cursor" is the edit Claude is about to make, so the blame is taken
  for the lines an `Edit` replaces, *before* the edit runs (after it, git only
  says "Not Committed Yet"), and drawn under that tool call's row. The latest
  one also goes to the status line. `/blame <file>[:line]` gives the blame on demand.
- **Commit graph → `git-graph`.** `/git-graph` opens a pane with
  `git log --graph` of all refs; picking a commit shows its message, stats and diff.
- **File history → `git-history`.** `/file-history <path>` opens a pane listing
  the commits that touched the file (following renames); picking one shows the
  file's diff in that commit.
- **Compare → `git-compare`.** `/compare <ref-a> [ref-b]` lists changed files
  with line counts; picking one shows its diff. `/compare-dirs <a> <b>` does the
  same for two folders through `git diff --no-index`.
- **Pull requests → `pr-review`.** `/pr-review [number]` opens a pane with the PR's
  title, state, description, changed files with diffs, and review comments,
  read through the `gh` CLI.

## Skipped, and why

| Feature | Why it was skipped |
| --- | --- |
| Per-turn diff review | Claude Code's built-in diff panel (fullscreen TUI) already shows what each turn changed. |
| Blame annotations in the gutter of every line | Claude Code has no editor gutter; blame is shown per edit and per command instead. |
| GitLens CodeLens (authors above each function) | No code view to attach lenses to. |
| Git Graph branch actions (checkout, merge, rebase, push from the graph) | Destructive git actions from a pane button bypass Claude Code's permission prompts; left to Claude through the Bash tool. |
| Writing PR review comments, approving, merging | Writes to GitHub from a pane button bypass permission prompts; `pr-review` is read-only. |
| GitLens AI commit explanations | Claude itself does that already. |
| Line history (Git History "history of a line") | Covered by `/blame <file>:<line>` plus `/file-history`; a separate view added little. |

## Second batch: themes and everyday extensions

Queried from the Marketplace gallery API on 2026-11-10, sorted by installs, in the Themes, Formatters and Linters categories and for the search terms `todo`, `error`, `bookmarks`, `spell` and `time tracking`.

### Themes

| Extension | Installs | Plugin |
| --- | --- | --- |
| [GitHub Theme](https://marketplace.visualstudio.com/items?itemName=GitHub.github-vscode-theme) | 20,587,629 | `github-theme` (GitHub Dark, GitHub Light) |
| [One Dark Pro](https://marketplace.visualstudio.com/items?itemName=zhuangtongfa.Material-theme) | 12,912,152 | `one-dark-pro` |

These are the two most-installed color themes. Ranked above them in the Themes category are C/C++ Themes (61,446,744; installed as a dependency of the C/C++ extension), two file icon themes (Material Icon Theme, vscode-icons) and PowerShell, none of which is a color theme a person picks. Next in line: Dracula Theme Official (11,133,216) and Atom One Dark Theme (7,413,097).

A Claude Code theme plugin is data: `themes/<slug>.json` with a `name`, a built-in `base` (`dark`, `light`, …) and `overrides` of the terminal theme's color keys. The person picks it with `/theme`.

### Everyday extensions

| Extension | Installs | Feature taken | Plugin |
| --- | --- | --- | --- |
| [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) | 72,858,534 | Format on save | `format-on-edit` |
| [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) | 53,757,161 | Lint the open file | `error-lens` |
| [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) | 10,284,031 | Diagnostics shown inline, at the line | `error-lens` |
| [Todo Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree) | 7,916,940 | Tree of TODO/FIXME comment tags | `todo-tree` |
| [Bookmarks](https://marketplace.visualstudio.com/items?itemName=alefragnani.Bookmarks) | 5,214,851 | Mark lines and jump back to them | `bookmarks` |

They were chosen for what they add to a session where Claude does the editing:

- **Format on save → `format-on-edit`.** Claude's `Edit` and `Write` are the "save". The project's local Prettier runs on the written file, and a hidden note tells Claude the file changed so its next edit does not fail on stale text.
- **Inline diagnostics → `error-lens`.** The problems of the file Claude just edited are drawn under that edit and handed back to Claude in the same turn, instead of surfacing at the next build.
- **Todo Tree → `todo-tree`.** `/todos` lists comment tags by file in a pane.
- **Bookmarks → `bookmarks`.** `/bookmark` and `/bookmarks` keep per-project marks across sessions and hand the list to Claude.

### Skipped in this batch

| Extension | Installs | Why it was skipped |
| --- | --- | --- |
| Material Icon Theme, vscode-icons | 36,182,246 / 24,806,190 | File icon themes: the terminal interface draws no file icons. |
| Code Spell Checker | 18,603,677 | Needs a bundled dictionary, and these plugins take no runtime dependency. |
| WakaTime | 23,108,823 | Sends activity to an external service; a local-only tracker would not be the same feature. |
| Live Server | 84,301,216 | Starting a dev server is already a Bash tool call for Claude. |
| Better Comments, TODO Highlight | 10,791,220 / 6,191,908 | Comment colouring in an editor; there is no editor view to colour. `todo-tree` covers finding the tags. |
| Dracula, Atom One Dark and further themes | 11,133,216 / 7,413,097 | Out of scope for two theme plugins; the same `themes/*.json` format fits them. |
