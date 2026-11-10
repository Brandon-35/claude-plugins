# bookmarks

Mark a line in a file with a note, list the marks in a pane beside the chat, and jump back to the code around one. Bookmarks are kept per project across sessions. Modelled on the [Bookmarks](https://marketplace.visualstudio.com/items?itemName=alefragnani.Bookmarks) VS Code extension.

## Install

```
claude plugin marketplace add Brandon-35/claude-plugins
claude plugin install bookmarks@brandon-35-plugins
```

Needs Claude Code 2.1.322 or newer. The pane docks beside the chat in the fullscreen layout (`"tui": "fullscreen"`, terminal at least 110 columns wide); otherwise it opens above the prompt.

## Use

| Command | What it does |
| --- | --- |
| `/bookmark <file>[:line] [note]` | Adds a bookmark (line 1 when left out); the same `file:line` again replaces the note |
| `/bookmarks` | Opens the list, sorted by file then line |
| `/bookmark-clear` | Removes every bookmark of this project |

In the pane: arrows walk the rows, `Enter` opens one with the code around it, `b` goes back, `d` deletes the open bookmark, `Esc` returns to the prompt.

`/bookmarks` also hands the list to Claude as a hidden note, so "open my bookmark about rounding" works afterwards.

Paths are relative to the project root (`git rev-parse --show-toplevel`, or the session's folder outside a repository). Bookmarks are stored in the plugin's own store under that root; nothing is written into the project.

## Recorded run

Claude Code 2.1.322, plugin installed from a local marketplace (`claude plugin marketplace add <path> --scope local`, `claude plugin install bookmarks@brandon-35-plugins --scope local`), run in a small JavaScript demo repository.

```
❯ /bookmark src/cart.js:10 rounding bug lives here
  ⎿  bookmarks: Bookmarked src/cart.js:10  rounding bug lives here
❯ /bookmark src/user.js:2
  ⎿  bookmarks: Bookmarked src/user.js:2
❯ /bookmark src/nope.js:3
  ⎿  bookmarks: Cannot read src/nope.js
❯ /bookmark src/user.js:99
  ⎿  bookmarks: src/user.js has only 5 lines
❯ /bookmarks
  ⎿  bookmarks: Bookmarks opened (2).

│src/cart.js:10  rounding bug lives here
│src/user.js:2
```

`Down`, `Enter` on the first row:

```
│[ Back to bookmarks ]
│[ Delete bookmark ]
│src/cart.js:10
│rounding bug lives here
│  5     sum += item.price * item.qty;
│  6   }
│  7   return sum;
│  8 }
│  9
│ 10 // FIXME: rounding is wrong for three-decimal currencies
│ 11 export function format(amount) {
│ 12   return amount.toFixed(2);
│ 13 }
```

`d` deleted it and returned to the list:

```
│src/user.js:2
```

After quitting and starting a new session in the same folder, `/bookmarks` listed the saved bookmarks again, and:

```
❯ /bookmark-clear
  ⎿  bookmarks: Removed 2 bookmarks.
```

## Develop

```
claude plugin validate plugins/bookmarks
claude plugin test plugins/bookmarks
```

## Limits

- A bookmark is a line number, not a tracked position: it does not move when lines are added above it.
- No gutter marks and no next/previous jump: the terminal has no editor to draw them in.
- The hidden note for Claude is covered by a unit test only; it was not exercised in the recorded session.
- A file name containing `:` needs an explicit `:line`.
