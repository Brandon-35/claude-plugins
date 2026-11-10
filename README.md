# claude-plugins

Open-source plugins and mods for [Claude Code](https://claude.com/claude-code), built by Brandon Ta.

Each plugin lives in its own folder under `plugins/<name>/` with its own README, and can be installed on its own.

## Plugins

| Plugin | Status | What it does |
| ------ | ------ | ------------ |
| [git-graph](plugins/git-graph) | works (live-tested on 2.1.322) | `/git-graph`: commit graph of every branch in a pane; pick a commit for its details and diff |
| [blame-lens](plugins/blame-lens) | works (live-tested on 2.1.322) | Inline git blame under every `Edit` Claude makes and on the status line; `/blame <file>[:line[-line]]` |
| [git-history](plugins/git-history) | works (live-tested on 2.1.322) | `/file-history <path>`: the commits that touched a file (renames followed) and its diff in each |
| [git-compare](plugins/git-compare) | works (live-tested on 2.1.322) | `/compare <ref-a> [ref-b]` and `/compare-dirs <a> <b>`: changed files with line counts, and each file's diff |
| [pr-review](plugins/pr-review) | works (live-tested on 2.1.322) | `/pr-review [number]`: a pull request's description, files, diffs, reviews and comments in a pane (read-only, needs `gh`) |
| [github-theme](plugins/github-theme) | works (live-tested on 2.1.322) | GitHub Dark and GitHub Light color themes, picked with `/theme` |
| [one-dark-pro](plugins/one-dark-pro) | works (live-tested on 2.1.322) | The One Dark Pro color theme, picked with `/theme` |

Which extensions these are modelled on, and why: [docs/research.md](docs/research.md).

## Install

Add this repository as a marketplace once, then install any plugin from it:

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install <plugin>@brandon-35-plugins
```

Or, at the prompt of a terminal session: `/plugin install <plugin> --marketplace Brandon-35/claude-plugins`.

The plugins are mods: they need Claude Code 2.1.322 or newer. Panes dock beside the chat in the fullscreen layout (`"tui": "fullscreen"`).

## Contributing

Issues and pull requests are welcome. Keep each plugin self-contained, documented, and tested.

## License

MIT
