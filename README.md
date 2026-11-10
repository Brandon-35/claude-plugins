# claude-plugins

Open-source plugins and mods for [Claude Code](https://claude.com/claude-code), built by Brandon Ta.

Each plugin lives in its own folder under `plugins/<name>/` with its own README, and can be installed on its own.

## Plugins

| Plugin | Status | What it does |
| ------ | ------ | ------------ |
| [pr-review](plugins/pr-review) | works (live-tested on 2.1.322) | `/pr [number]`: a pull request's description, files, diffs, reviews and comments in a pane (read-only, needs `gh`) |

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
