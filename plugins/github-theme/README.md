# github-theme

GitHub Dark and GitHub Light color themes for the Claude Code terminal interface, modelled on the VS Code extension [GitHub Theme](https://marketplace.visualstudio.com/items?itemName=GitHub.github-vscode-theme).

A theme plugin holds no code: each file in `themes/` names a built-in base theme and the colors it replaces (text, borders, status colors, diff backgrounds, message backgrounds).

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install github-theme@brandon-35-plugins
```

## Use

Run `/theme` and pick **GitHub Dark** or **GitHub Light**. The picker previews a theme as you move over it; Enter keeps it, Esc cancels. Syntax highlighting inside code blocks keeps its own setting (`ctrl+t` in the picker).

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace, `/theme` typed at the prompt:

```
   Theme
   Choose the text style that looks best with your terminal
       Auto (match terminal)
       Dark mode
     ✔ Light mode
       Dark mode (colorblind-friendly)
       Light mode (colorblind-friendly)
       Dark mode (ANSI colors only)
       Light mode (ANSI colors only)
   ❯   GitHub Dark    from github-theme
       GitHub Light   from github-theme
       New custom theme…
```

Moving the cursor from Light mode to GitHub Dark and then GitHub Light repainted the picker's diff preview each time: the removed line's background went from the light preset's to a dark red on GitHub Dark and `#ffebe9` (drawn as the 256-color `255`) on GitHub Light, the added line's to dark green and `#dafbe1` (`194`).

## Colors

Taken from GitHub's Primer palette (MIT): dark `#e6edf3` text, `#58a6ff` accent, `#3fb950` / `#f85149` / `#d29922` status; light `#1f2328` text, `#0969da` accent, `#1a7f37` / `#cf222e` / `#9a6700` status. The full list is in `themes/github-dark.json` and `themes/github-light.json`.

## Limits

- The terminal's own background color is the terminal's: set it in your terminal profile to match (`#0d1117` for dark, `#ffffff` for light).
- A terminal without true color shows the nearest of its 256 colors.
- An unofficial port: not affiliated with or endorsed by the authors of the original theme.
