# git-compare

Compare two branches, tags or commits, or two folders, in a pane beside the chat: the changed files with line counts, and each file's diff. Modelled on [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) Search & Compare and on folder-diff extensions such as [Compare Folders](https://marketplace.visualstudio.com/items?itemName=moshfeu.compare-folders).

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install git-compare@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer and `git` on the PATH. The pane docks beside the chat in the fullscreen layout (`"tui": "fullscreen"`, terminal at least 110 columns wide); otherwise it opens above the prompt.

## Use

| Command | What it compares |
| --- | --- |
| `/compare <ref-a> <ref-b>` | What `ref-b` changed since it left `ref-a` (`git diff a...b`, what a pull request shows) |
| `/compare <ref>` | `ref` against the working tree, uncommitted changes included |
| `/compare <a>..<b>` or `<a>...<b>` | The range, passed to git as written |
| `/compare-dirs <dir-a> <dir-b>` | Two folders or two files, inside a repository or not (`git diff --no-index`); quote a path that has spaces |

The pane takes the keyboard when it opens: `Tab` / arrows walk the files, `Enter` opens one, `b` goes back to the list, `Esc` returns to the prompt.

Read-only: the plugin runs `git rev-parse --verify` and `git diff` and nothing else. An argument that starts with `-` is refused, so nothing typed can be read as a git option.

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install git-compare@brandon-35-plugins --scope local`), in a demo repository with a tag, a rename and an uncommitted change.

```
❯ /compare v0.1.0 main
  ⎿  git-compare: Comparing v0.1.0 and main.

│1 file changed, +1 −1
│R lib/math.py → lib/arith.py +1 −1
```

`Tab`, `Enter`:

```
│[ Back to files ]
│lib/math.py → lib/arith.py
│ 1  def mul(a, b):
│ 2      return a * b
│ 3  def div(a, b):
│ 4 -    return a / b
│ 4 +    return a / b if b else 0
```

One ref, against the working tree:

```
❯ /compare main
  ⎿  git-compare: Comparing main and working tree.

│1 file changed, +1 −0
│M app.py +1 −0
```

Two folders (one changed file, one only in each side):

```
❯ /compare-dirs dirs-a dirs-b

│3 files changed, +3 −2
│M changed.txt +2 −1
│D only_a.txt +0 −1
│A only_b.txt +1 −0
```

Error paths:

```
❯ /compare nope
  ⎿  git-compare: Unknown ref: nope
❯ /compare --output=x main
  ⎿  git-compare: Arguments starting with "-" are not accepted.
❯ /compare
  ⎿  git-compare: Usage: /compare <ref-a> [ref-b]
```

## Develop

```
claude plugin validate plugins/git-compare
claude plugin test plugins/git-compare
```

## Limits

- The whole diff is read once (up to 4 MiB of git output); past that the pane says the list is incomplete.
- A file's diff over about 80,000 characters says so instead of drawing.
- A quoted path cannot itself contain a double quote.
