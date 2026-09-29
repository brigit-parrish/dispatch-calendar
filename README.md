# Dispatch Calendar

A dispatch calendar built on `react-calendar-timeline`. Dispatchers can add, edit, and delete events per driver, with validation enforced everywhere an event can change.

## Run it

    npm install
    npm run dev      # local dev server
    npm test         # Vitest (sets TZ=America/Chicago for the DST test)
    npm run build

Demo data is generated on each page load and lives in memory only. There is no backend.

Note: `npm test` sets `TZ` inline, which works on macOS/Linux. On Windows, use `cross-env` (listed under next steps).

## What it does

- **Add:** double-click an empty cell. The driver is preselected and the start is in the future (a click in the past rounds up to the next 15 minutes).
- **Edit:** double-click an event.
- **Delete:** the Delete button in the form, or the Delete key on a selected event (never Backspace, ignored while typing).
- **Drag and resize:** rejected changes show a red banner that auto-dismisses after 5 seconds. Resizes are capped at 24 hours during the drag.
- **Locked events:** anything that starts at or before now is faded, can't be dragged or resized, and opens in the form with Save disabled. Delete still works.
- **Now marker:** a red line at the current time; hovering it shows the exact time. The view re-renders every minute so locks stay current.

## Rules

- Title: 5 to 35 characters after trimming.
- Duration: greater than zero and at most 24 hours, measured as elapsed time. It can cross midnight. A 6 PM to 6 PM span across a fall-back DST change is 25 hours and is rejected.
- No overlap for the same driver (back-to-back is allowed). Overlap is checked against the destination driver when an event is moved.
- Past and active events can't be edited, moved, or resized.

## Design decisions

- **One validator.** `validateEvent(candidate, items, now)` is a pure function called from form save, drag, and resize. `now` is passed in so tests never mock the clock, and each handler passes `Date.now()` at the moment of the action.
- **The lock uses the stored event's original start**, not the proposed one, so a locked event can't be dragged into the future.
- **All errors are returned**, not just the first, so the form shows everything at once.
- **Product calls:** new events can't start in the past; delete is never locked; the driver can be changed in the form.
- **React 16.6 kept** (class components). The starter shipped with it, and the upgrade is listed under next steps.

## Fixes to the starter code

- `items.sort((a, b) => b - a)` produced NaN and did nothing. It now sorts by start.
- The fake data overlapped per driver. It is now built sequentially per driver, and three of the thirty drivers always have an active event so a locked item is guaranteed to exist in the demo (their position isn't fixed to the top rows, since the driver list is alphabetized separately). The generated window is symmetric around now, so `daysInPast` also controls how far into the future events go.
- The commented-out `canMove: startValue > now` would go stale. Locking is now computed at render time and enforced in the handlers.
- `faker@4` was replaced with `@faker-js/faker`.

## Testing

- Vitest tests for `validateEvent` (36 tests: title, duration, DST, overlap, past-start, locked-original, combined behavior, invalid input) and the data generator (20 tests: no overlaps, valid titles, start < end, across 20 runs). Tests were written and reviewed before the implementation, in separate commits, so the tests-only commit fails on its own by design.
- React Testing Library tests for `EventForm` (12 tests): renders correctly in add/edit mode, autofocuses the title, shows title/duration/overlap/locked errors individually and together, trims the title before saving, disables Save (but not Delete) on a locked event, and closes on Escape or an overlay click.
- Total: 68 (`npm test`).
- The now-marker and lock behavior (`canMove`/`canResize`, the minute re-render) are checked manually only; there's no automated test for them yet.
- UI flows were also checked by hand in the browser.

## How I used the agent

I used Claude Code in the terminal inside VS Code. It could read and edit files, run shell commands (npm, git, the build), and run headless browser checks (Playwright) for verification — though I overrode those more than once when they contradicted what I saw myself in the browser. I also used a separate Claude chat to talk through plans and review diffs, since I wanted to understand each piece before it got written.

**Process**
- I started in plan mode. It proposed a file structure and a list of `validateEvent` test cases, and I reviewed that before any code existed.
- I approved every edit by hand instead of using auto mode.
- One feature per commit, files staged by name, never `git add .`. I ran `npm test` and the app myself instead of trusting the agent's summary.
- Tests came first: I reviewed the test file, then the agent wrote the implementation to pass it.

**Things I caught in review**
- The plan only checked the candidate's new start, so a locked event could have been dragged into the future and passed. The lock now checks the stored event's original start.
- React 16.6 has no `react/jsx-runtime`, so Vite needed the classic JSX runtime.
- The form was reading `now` from props, which goes stale if the modal sits open. It now calls `Date.now()` at submit time.
- Backspace was deleting the selected event. It's Delete only now, and ignored while typing.
- Double-clicking a cell in the past opened a form with a start time that would fail its own validation.
- Drag handlers get a group index, not a group id, so they have to be mapped before the overlap check.

**Things that got past me or the agent**
- The agent's headless check said the now-marker wasn't rendering when it was. I could see the line in my browser, so I stopped that debugging.
- The agent started a Playwright browser check without being asked, during the event-form review; I told it to skip that and rely on my own manual testing instead.

**Where I stopped**
I prototyped a driver search filter, but cross-row drag stopped working when the group list was filtered. I suspected the library's group-index mapping but didn't trace it to a root cause, and after about an hour I removed the filter instead of shipping something half-broken. Both commits are still in the history.

## Time spent

About 3 hours on the core (setup, `validateEvent` and its tests, the form, drag/resize validation, locking) and about 3 hours on the extras, component tests, and this README. Roughly 6 hours total.

## Known limitations and next steps

- `moment` is aliased to its prebuilt file in `vite.config.js` because moment 2.18's dynamic locale require breaks Vite's dev pre-bundler. Upgrade or replace it.
- Dependencies are old (`react-calendar-timeline@0.28`, `moment@2.18`, `react@16.6`), so `npm audit` reports vulnerabilities, and the bundle is about 855 kB.
- Upgrading React is the prerequisite for a UI library such as MUI.
- Form fields aren't disabled for a locked event (Save is).
- Clearing a date input shows a misleading message.
- No end-to-end tests yet (Playwright is the next candidate).
- `npm test` uses inline `TZ`; use `cross-env` for Windows.
