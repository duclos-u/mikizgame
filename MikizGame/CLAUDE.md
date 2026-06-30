# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

All commands run from `MikizGame/`:

```bash
npm run dev          # sync types then start dev server with HMR
npm run build        # sync types, type-check, then Vite build → dist/
npm run lint         # ESLint
npm run preview      # serve the dist/ build locally
npm run sync-types   # copy MikizBack/src/types/api.ts → src/api/shared-types.ts
```

`sync-types` runs automatically as `predev` and `prebuild` — you rarely need to call it manually.

There are no tests configured yet.

## Architecture

This is a React + TypeScript SPA (Vite) — a daily games dashboard for a small team.

### Routing

Four routes, defined in `src/App.tsx`:
- `/` → `DailyGamesPage` (the hub)
- `/leaderboard` → `LeaderboardPage`
- `/games/:gameId` → `GameRoutePage`, which calls `renderGame()` from `src/routes/gameRegistry.tsx`
- `/reset-password` → `ResetPasswordPage`

`gameRegistry.tsx` exports `renderGame(gameId)` — a function, not a component. It looks up the matching game in `GAMES` from `src/data/games.ts` and calls `createElement` on its `component`. `GameRoutePage.tsx` is the actual route component that wraps the result.

### Game types: external vs internal

Games are defined in `src/data/games.ts` as `Game` objects. A game is either:
- **External** — has a `url`, opens in a new tab.
- **Internal** — has a `route` (e.g. `/games/vinymix`) and a `component` field pointing to its React component, rendered inside the SPA.

The optional `slug` field overrides the backend DB slug when it differs from the frontend `id`. Example: the politics game has `id: "politics"` but the backend slug is `"politeki"` — so `slug: "politeki"` is set on the `Game` object and used when fetching scores.

**To add a new internal game:** add a `Game` entry to `GAMES` in `src/data/games.ts` (with `route`, `component`, and optionally `checkDoneToday` and `slug`), then create the component under `src/games/<name>/`. No other file needs updating.

`DailyGamesPage` uses `<Link>` for internal games and `<a target="_blank">` for external games.

### Live internal games

| id | Component |
|---|---|
| `motivex` | `src/games/motivex/index.tsx` |
| `cinemaxd` | `src/games/cinemaxd/index.tsx` |
| `vinymix` | `src/games/vinymix/index.tsx` |
| `politics` | `src/games/politics/index.tsx` |

### Auth

`src/context/AuthContext.tsx` manages `user`, `token`, and `loading` state. The token is stored in localStorage under `auth_token` and validated on app startup via `api.auth.me()`. Methods: `login()`, `register()`, `logout()`.

### API client

`src/api/client.ts` is the single entry point for all backend calls. The base URL defaults to `/api` and can be overridden via `VITE_API_BASE_URL`. It auto-injects the Bearer token from `AuthContext` on every request.

`src/api/shared-types.ts` contains the shared API types synced from `MikizBack/src/types/api.ts` — **never edit this file directly**. Edit the source in MikizBack and run `npm run sync-types`.

### State persistence

All localStorage keys are centralized in `src/constants/storage.ts` (`STORAGE_KEYS`). Use those constants — never write raw key strings.

`src/hooks/useJdj2State.ts` stores which games the user marked done today under `STORAGE_KEYS.JDJ2_STATE`.

`src/hooks/useHubScores.ts` fetches per-game scores displayed on hub cards.

Game sessions use `src/hooks/useGameSession.ts` — a generic hook that reads from localStorage first, then silently refreshes from the API when authenticated. Pass a `cacheKey` from `STORAGE_KEYS` and a `fetch` function. Set `requireAuth: true` for games that need a login to play.

`src/utils/date.ts` exports `today()` — use it instead of inline `new Date().toISOString().slice(0, 10)` calls.

### Utilities

- `src/utils/artistColors.ts` — color-mapping helpers used in Vinymix components
- `src/data/team.ts` — team member data used by `TeamModal`
- `canvas-confetti` — win-state celebration animation, used across games

### Styling

Single global stylesheet at `src/index.sass` — no CSS-in-JS or component-scoped styles. Class names are BEM-ish strings applied directly in JSX. Colors use OKLCH tokens (`--bg`, `--card`, `--accent`, `--text`, `--border`). Typography: Hanken Grotesk (body), Baloo 2 (display).

## Language Convention

All code identifiers (variable names, function names, component names, CSS class names) and comments must be written in **English**. User-facing content (UI labels, game text, messages displayed to users) may be in French.
