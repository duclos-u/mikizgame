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

`gameRegistry.tsx` is the single place that maps a `gameId` string to a React component. To add a new built-in game, add an entry there and create a component under `src/games/<name>/`.

### Game types: external vs internal

Games are defined in `src/data/games.ts` as `Game` objects. A game is either:
- **External** — has a `url`, opens in a new tab.
- **Internal** — has a `route` (e.g. `/games/cineclue`), rendered inside the SPA.

`DailyGamesPage` uses `<Link>` for internal games and `<a target="_blank">` for external games.

### Auth

`src/context/AuthContext.tsx` manages `user`, `token`, and `loading` state. The token is stored in localStorage under `auth_token` and validated on app startup via `api.auth.me()`. Methods: `login()`, `register()`, `logout()`.

### API client

`src/api/client.ts` is the single entry point for all backend calls. The base URL defaults to `/api` and can be overridden via `VITE_API_BASE_URL`. It auto-injects the Bearer token from `AuthContext` on every request.

### State persistence

`src/hooks/useJdj2State.ts` stores which games the user marked done today in localStorage under the key `jdj2`.

The CinéClue game (`src/games/cineclue/index.tsx`) persists its daily state in localStorage under `filmdujourstate_{YYYY-MM-DD}`, then syncs with the API when the user is authenticated.

### Styling

Single global stylesheet at `src/index.sass` — no CSS-in-JS or component-scoped styles. Class names are BEM-ish strings applied directly in JSX. Colors use OKLCH tokens (`--bg`, `--card`, `--accent`, `--text`, `--border`). Typography: Hanken Grotesk (body), Baloo 2 (display).
