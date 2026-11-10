# error-lens

ESLint problems of the file Claude just edited, shown at the edit: under the tool's row, on the status line, and in a hidden note Claude reads, so it can fix what it broke in the same turn. Modelled on the [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) and [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) VS Code extensions.

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install error-lens@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer and ESLint installed in the project (`node_modules/.bin/eslint` in the file's folder or any folder above it). A project without it is left alone, silently.

## Use

Nothing to run. After each successful `Edit` or `Write` of a `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` or `.vue` file, the plugin runs `eslint --format json --no-color <file>` from the folder that holds `node_modules` and shows the result:

- under the tool's row: a summary and up to 5 problems with line, column, message and rule;
- on the status line: `eslint: 2 errors in user.js`, cleared at the next prompt or when the file is clean again;
- to Claude: up to 10 problems as a hidden note after the tool result.

| Command | What it does |
| --- | --- |
| `/problems` | Lists the problems of every file edited this session that still has some |

The plugin never fixes anything (`--fix` is never passed) and never writes a file.

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install error-lens@brandon-35-plugins --scope local`), run in a small JavaScript demo repository with `eslint` and `@eslint/js` recommended rules. Claude was asked to insert two faulty lines with the Edit tool and report what the tool feedback said:

```
⏺ Update(src/user.js)
  ✘ 2 errors (eslint)
  L3:9  'unused' is assigned a value but never used.  no-unused-vars
  L4:15  'missing' is not defined.  no-undef
  ⎿  Added 2 lines
      1  export function greet(user) {
      2    // HACK: name can be missing on old accounts
      3 +  const unused = 1;
      4 +  console.log(missing);
      5    const name = user.name || "there";

⏺ Edit applied once; the eslint hook flagged unused as unused (no-unused-vars, L3) and missing as
  undefined (no-undef, L4).

  ⚠ error-lens: eslint: 2 errors in user.js
```

The last line is the status line; Claude's answer shows the hidden note reached it.

```
❯ /problems
  ⎿  error-lens: <demo>/src/user.js (2 errors)
       L3:9 error 'unused' is assigned a value but never used. (no-unused-vars)
       L4:15 error 'missing' is not defined. (no-undef)
```

(`<demo>` stands for the demo repository's absolute path.) After a second Edit removed the two lines, nothing was drawn under its row, the status line entry was gone, and:

```
❯ /problems
  ⎿  error-lens: No problems in files edited this session.
```

## Develop

```
claude plugin validate plugins/error-lens
claude plugin test plugins/error-lens
```

## Limits

- ESLint only, and only a local install: no `npx`, no global ESLint, no download. TypeScript compiler errors, Pyright, Ruff and other linters are not run.
- It runs the binary found in the project's `node_modules` with the project's config, which is code: use it in projects whose dependencies you trust, as with any `npm` script.
- One file per edit is linted, so a problem an edit causes in another file is not seen.
- Edits made through the Bash tool are not linted.
- POSIX paths only (macOS, Linux); Windows is not handled.
