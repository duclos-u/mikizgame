# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `web/`:

```bash
npm run dev       # start dev server with HMR
npm run build     # type-check + vite build → dist/
npm run lint      # eslint
npm run preview   # serve the dist/ build locally
```

There are no tests configured yet.

## Architecture

This is a React + TypeScript SPA (Vite) — a daily games dashboard for a small team.

### Routing

Two routes, defined in `src/App.tsx`:
- `/` → `DailyGamesPage` (the hub)
- `/games/:gameId` → `GameRoutePage`, which delegates to `src/routes/gameRegistry.tsx`

`gameRegistry.tsx` is the single place that maps a `gameId` string to a React component. To add a new built-in game, add an entry there and create a component under `src/games/<name>/`.

### Game types: external vs internal

Games are defined in `src/data/games.ts` as `Game` objects. A game is either:
- **External** — has a `url`, opens in a new tab.
- **Internal** — has a `route` (e.g. `/games/motivex`), rendered inside the SPA. `DailyGamesPage` uses `<Link>` for internal and `<a target="_blank">` for external.

Both types share the same row UI; the distinction is purely whether `route` or `url` is set.

### State persistence

`src/hooks/useJdj2State.ts` stores which games the user marked done today in `localStorage` under the key `jdj2`. Marking done is triggered via `onPlayExternal` in `App.tsx`, passed down to `DailyGamesPage`.

### Static data

`src/data/team.ts` and `src/data/games.ts` are plain TypeScript constants — no API, no backend. Team scores and streaks are hardcoded for now.

### Styling

Single global stylesheet at `src/index.css` — no CSS-in-JS or component-scoped styles. Class names are BEM-ish strings applied directly in JSX.
