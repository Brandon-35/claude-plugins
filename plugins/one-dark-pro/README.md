# one-dark-pro

The One Dark Pro color theme for the Claude Code terminal interface, modelled on the VS Code extension [One Dark Pro](https://marketplace.visualstudio.com/items?itemName=zhuangtongfa.Material-theme).

A theme plugin holds no code: each file in `themes/` names a built-in base theme and the colors it replaces (text, borders, status colors, diff backgrounds, message backgrounds).

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install one-dark-pro@brandon-35-plugins
```

## Use

Run `/theme` and pick **One Dark Pro**. The picker previews a theme as you move over it; Enter keeps it, Esc cancels. Syntax highlighting inside code blocks keeps its own setting (`ctrl+t` in the picker).

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
   ❯   One Dark Pro   from one-dark-pro
       New custom theme…
```

Moving the cursor onto One Dark Pro repainted the picker's diff preview with the theme's muted red and green line backgrounds (`#55313a` and `#2f4a36`, drawn as the 256-colors `238` and `237` in the recording terminal).

## Colors

Taken from One Dark Pro (MIT), Atom's One Dark: `#abb2bf` text, `#61afef` accent, `#98c379` / `#e06c75` / `#e5c07b` status, `#c678dd` for modes. The full list is in `themes/one-dark-pro.json`.

## Limits

- The terminal's own background color is the terminal's: set it in your terminal profile to match (`#282c34`).
- A terminal without true color shows the nearest of its 256 colors.
- An unofficial port: not affiliated with or endorsed by the authors of the original theme.
