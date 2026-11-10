# todo-tree

Every `TODO`, `FIXME`, `HACK`, `BUG` and `XXX` comment of the repository in a pane beside the chat, grouped by file. Pick one to see the code around it. Modelled on the [Todo Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree) VS Code extension.

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install todo-tree@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer and `git` on the PATH. The pane docks beside the chat in the fullscreen layout (`"tui": "fullscreen"`, terminal at least 110 columns wide); otherwise it opens above the prompt.

## Use

| Command | What it does |
| --- | --- |
| `/todos` | Lists every tag in tracked and untracked (not ignored) files |
| `/todos fixme` | Lists one tag only (`todo`, `fixme`, `hack`, `bug`, `xxx`, any case) |

The pane takes the keyboard when it opens: arrows walk the rows, `Enter` opens one, `b` goes back to the list, `Esc` returns to the prompt.

The plugin only reads: it runs `git grep -n -I --untracked -w -E '(TODO|FIXME|HACK|BUG|XXX)'` and reads the picked file.

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install todo-tree@brandon-35-plugins --scope local`), run in a small JavaScript demo repository.

`/todos`:

```
❯ /todos
  ⎿  todo-tree: Todo tree opened (all tags).

│3 tags  TODO 1  FIXME 1  HACK 1
│src/cart.js
│  1  TODO  // TODO: support discount codes
│  10  FIXME  // FIXME: rounding is wrong for three-decimal currencies
│src/user.js
│  2  HACK  // HACK: name can be missing on old accounts
```

`Down`, `Enter` on the first row:

```
│[ Back to list ]
│src/cart.js:1
│ 1 // TODO: support discount codes
│ 2 export function total(items) {
│ 3   let sum = 0;
│ 4   for (const item of items) {
│ 5     sum += item.price * item.qty;
│ 6   }
```

`b` returned to the list. `/todos fixme`:

```
❯ /todos fixme
  ⎿  todo-tree: Todo tree opened (FIXME).

│1 tag  FIXME 1
│src/cart.js
│  10  FIXME  // FIXME: rounding is wrong for three-decimal currencies
```

`/todos nope`:

```
❯ /todos nope
  ⎿  todo-tree: todos: unknown tag. Valid tags: TODO, FIXME, HACK, BUG, XXX.
```

## Develop

```
claude plugin validate plugins/todo-tree
claude plugin test plugins/todo-tree
```

## Limits

- Git repositories only; files ignored by git are not searched.
- The tag list is fixed and matched as whole upper-case words; custom tags and highlight colors per tag are not configurable.
- The list draws at most 200 rows and says how many were left out.
- Read-only: no editing or completing a tag from the pane.
