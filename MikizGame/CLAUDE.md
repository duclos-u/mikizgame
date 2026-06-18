# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

All commands run from `MikizGame/`:

```bash
npm run dev      # start dev server with HMR
npm run build    # type-check + Vite build → dist/
npm run lint     # ESLint
npm run preview  # serve the dist/ build locally
```

There are no tests configured yet.

## Architecture

This is a React + TypeScript SPA (Vite) — a daily games dashboard for a small team.

### Routing

Three routes, defined in `src/App.tsx`:
- `/` → `DailyGamesPage` (the hub)
- `/leaderboard` → `LeaderboardPage`
- `/games/:gameId` → `GameRoutePage`, which delegates to `src/routes/gameRegistry.tsx`

`gameRegistry.tsx` is a thin adapter — it reads `GAMES` from `src/data/games.ts` and calls `createElement` on the matching `game.component`. It has no component map of its own.

### Game types: external vs internal

Games are defined in `src/data/games.ts` as `Game` objects. A game is either:
- **External** — has a `url`, opens in a new tab.
- **Internal** — has a `route` (e.g. `/games/cineclue`) and a `component` field pointing to its React component, rendered inside the SPA.

**To add a new internal game:** add a `Game` entry to `GAMES` in `src/data/games.ts` (with `route`, `component`, and optionally `checkDoneToday`), then create the component under `src/games/<name>/`. No other file needs updating.

`DailyGamesPage` uses `<Link>` for internal games and `<a target="_blank">` for external games.

### Auth

`src/context/AuthContext.tsx` manages `user`, `token`, and `loading` state. The token is stored in localStorage under `auth_token` and validated on app startup via `api.auth.me()`. Methods: `login()`, `register()`, `logout()`.

### API client

`src/api/client.ts` is the single entry point for all backend calls. The base URL defaults to `/api` and can be overridden via `VITE_API_BASE_URL`. It auto-injects the Bearer token from `AuthContext` on every request.

### State persistence

All localStorage keys are centralized in `src/constants/storage.ts` (`STORAGE_KEYS`). Use those constants — never write raw key strings.

`src/hooks/useJdj2State.ts` stores which games the user marked done today under `STORAGE_KEYS.JDJ2_STATE`.

Game sessions use `src/hooks/useGameSession.ts` — a generic hook that reads from localStorage first, then silently refreshes from the API when authenticated. Pass a `cacheKey` from `STORAGE_KEYS` and a `fetch` function. Set `requireAuth: true` for games that need a login to play.

`src/utils/date.ts` exports `today()` — use it instead of inline `new Date().toISOString().slice(0, 10)` calls.

### Styling

Single global stylesheet at `src/index.sass` — no CSS-in-JS or component-scoped styles. Class names are BEM-ish strings applied directly in JSX. Colors use OKLCH tokens (`--bg`, `--card`, `--accent`, `--text`, `--border`). Typography: Hanken Grotesk (body), Baloo 2 (display).

## Language Convention

All code identifiers (variable names, function names, component names, CSS class names) and comments must be written in **English**. User-facing content (UI labels, game text, messages displayed to users) may be in French.
