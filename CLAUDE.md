# CLAUDE.md

Dispatch calendar built on `react-calendar-timeline`. Dispatchers add, edit,
and delete driver events, with validation enforced everywhere an event
can change (form save, drag, resize).

## Commands

- `npm run dev` — local dev server
- `npm test` — always use this, never bare `vitest`. Sets `TZ=America/Chicago`,
  required for the DST test in `validateEvent.test.js`.
- `npm run build` — production build
- `*.test.jsx` opts into jsdom per file via `// @vitest-environment jsdom`;
  other tests use the default `node` env. Don't switch the whole project.

## Validation rules (`src/validateEvent.js`)

- Title: 5-35 characters after trimming.
- Duration: greater than zero, at most 24 elapsed hours (can cross midnight).
- No overlap for the same driver (back-to-back allowed); checked against
  the destination driver on a move.
- Locked: an event whose *stored* start is at or before now can't be
  edited, moved, or resized. Delete is never locked.

## Architecture

- `validateEvent(candidate, items, now)` is the single validation path —
  form save, drag, and resize all call it. Never duplicate its logic.
- `now` is always the caller's own `Date.now()` at the moment of the
  action, never a stale prop or cached value.
- React stays at 16.6 (class components, no hooks); `vite.config.js` sets
  `jsxRuntime: "classic"` since React 16.6 has no `react/jsx-runtime`.
- `moment` is aliased to `moment/moment.js` in `vite.config.js` — its
  dynamic locale `require` breaks Vite's dev pre-bundler otherwise.

## Commits

- One feature per commit. Stage files by name (`git add path/to/file`) —
  never `git add .`. Imperative commit messages (e.g. "Add validateEvent
  tests").
