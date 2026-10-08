# KEDIT-CODE Template

Code-driven 9:16 motion graphics. You edit a **script** (plain data); the **engine** animates it.

## Run
```
npm install
npm run dev        # open the URL it prints
```
Build: `npm run build`

## Make a new video (2 minutes)
1. Copy `src/scripts/_template.js` → `src/scripts/my-video.js`
2. Edit the scenes
3. In `src/scripts/index.js`: `import mine from './my-video.js'` and add `mine` to `SCRIPTS`
4. Pick it from the dropdown (or open `?script=my-video`)

## Scene types
| type | fields |
|---|---|
| `hook` | `eyebrow`, `lines[]` (use `<em>…</em>` for accent), `sub` |
| `code` | `file`, `lines[]`, `highlight[]` (line indexes), `button`, `run` (`'success'`/`'error'`), `cps` |
| `result` | `cmd`, `output[]` (start with ✓ green / ✗ red), `counter{from,to,prefix,suffix,decimals,label}`, `progress`, `graph{label,points[]}` — every part is optional |
| `list` | `title`, `items[{label,value}]` |
| `outro` | `lines[]`, `tag` |

Any scene also accepts `hold` (seconds to pause at the end). Script-level: `theme{accent,accent2}`, `cps`, `beat`.

## Recording
Open `?clean` (or `?clean&script=my-video`) — controls disappear and the stage fills the screen. Screen-record it (OBS, QuickTime, phone recorder) and trim.

## Structure
- `src/scripts/` — **your content** (edit these)
- `src/engine/primitives.js` — reusable animations (typeText, reveal, counter, graph, glitch, shake, cameraPunch…)
- `src/engine/scenes.jsx` — scene types (add new ones here)
- `src/engine/build.js` — script → timeline
- `src/styles.css` — look & feel
