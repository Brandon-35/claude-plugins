# format-on-edit

Runs the project's own Prettier on every file Claude edits or writes, the way `editor.formatOnSave` does in VS Code, and tells Claude when the file changed under it. Modelled on the [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) VS Code extension.

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install format-on-edit@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer and Prettier installed in the project (`node_modules/.bin/prettier` in the file's folder or any folder above it). A project without it is left alone, silently.

## Use

Nothing to run. After each successful `Edit` or `Write`:

1. the plugin finds the nearest `node_modules/.bin/prettier` above the file;
2. runs `prettier --write --ignore-unknown --log-level warn <file>` from that folder, so the project's `.prettierrc` and `.prettierignore` apply;
3. when the file changed, draws `✓ formatted with prettier` under the tool's row and adds a hidden note to the tool result telling Claude to re-read the file before its next edit; when Prettier fails, draws `prettier failed: <first error line>`.

| Command | What it does |
| --- | --- |
| `/format-on-edit` | Says whether formatting is on and how many files were formatted this session |
| `/format-on-edit off` / `on` | Turns it off or on for this session |

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install format-on-edit@brandon-35-plugins --scope local`), run in a small JavaScript demo repository with `prettier` installed. Claude was asked to write a badly spaced, single-quoted line with the Edit tool:

```
⏺ Update(src/user.js)
  ✓ formatted with prettier
  ⎿  Added 1 line, removed 1 line
      1  export function greet(user) {
      2    // HACK: name can be missing on old accounts
      3 -  const name = user.name || "there";
      3 +  const name = user.name   ||   'friend'
      4    return `Hello, ${name}!`;
      5  }

⏺ Edit applied, but prettier rewrote it. src/user.js:3 now reads const name = user.name || "friend";, not
  your exact spacing and single quotes.
```

The file on disk afterwards: `  const name = user.name || "friend";`. Claude's answer shows the hidden note reached it.

```
❯ /format-on-edit
  ⎿  format-on-edit: Formatting on, 1 file formatted this session
❯ /format-on-edit off
  ⎿  format-on-edit: Formatting off
❯ /format-on-edit maybe
  ⎿  format-on-edit: Usage: /format-on-edit [on|off]
```

With formatting off, the same kind of edit stayed as written (`'pal'` kept its single quotes) and no line was drawn under the row.

## Develop

```
claude plugin validate plugins/format-on-edit
claude plugin test plugins/format-on-edit
```

## Limits

- Prettier only, and only a local install: no `npx`, no global Prettier, no download. Other formatters (Black, gofmt, rustfmt) are not run.
- It runs the binary found in the project's `node_modules`, with the project's config and plugins: use it in projects whose dependencies you trust, as with any `npm` script.
- Edits made through the Bash tool or by other tools are not formatted.
- POSIX paths only (macOS, Linux); Windows is not handled.
- The on/off switch lasts for the session; there is no per-project setting.
