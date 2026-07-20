# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Repo Layout

```
MikizStack/
├── MikizBack/   # Bun + Hono REST API
├── MikizGame/   # React + TypeScript SPA (Vite)
├── data/        # Raw CSV datasets for Politeki (deputies, government members, presidents)
└── scripts/     # Python data-enrichment scripts that produce MikizBack/src/data/politics.json
```

Each sub-project has its own `CLAUDE.md` with detailed commands and architecture.

## Live Games

| Game | Type | Backend route | Frontend component |
|---|---|---|---|
| Motivex | Daily word (Wordle-style) | `/api/motivex` | `src/games/motivex/` |
| Cinemaxd | Daily film guessing | `/api/filmdujour` + `/api/cinemaxd` | `src/games/cinemaxd/` |
| Vinymix | Daily music artist guessing | `/api/vinymix` | `src/games/vinymix/` |
| Politeki | Daily French politician guessing | `/api/politics` | `src/games/politics/` |
| Yearbox | Daily year-guessing (facts revealed per wrong guess) | `/api/yearbox` | `src/games/yearbox/` |
| Chainapan | Daily word-ladder (4-letter chain) | `/api/chainapan` | `src/games/chainapan/` |

## Admin Backoffice

Accessible at `/admin` (frontend) — guarded by `user.isAdmin === true`.

**Promote a user to admin:**
```bash
cd MikizBack && bun admin:set <email>           # promote
cd MikizBack && bun admin:set <email> --revoke  # revoke
```

**Features:**
- **Suggestions Yearbox** — review user-submitted event suggestions (approve / reject with optional note)
- **Planning des jeux** — view, set, edit, and delete the daily schedule for Yearbox, Politeki, Motivex, Chainapan, and Cinemaxd; solutions are blurred by default and revealed on hover or via a global checkbox

**Backend routes** (`/api/admin`, guarded by `adminAuthMiddleware`):
- `GET /api/admin/suggestions` — list suggestions by status with pagination
- `PATCH /api/admin/suggestions/:id` — approve or reject a suggestion
- `GET /api/admin/schedule/:game` — list scheduled entries for a 30-day window
- `POST /api/admin/schedule/:game` — upsert a day's content (game-specific payload)
- `DELETE /api/admin/schedule/:game/:date` — remove a scheduled day

## Type-Sync Contract

`MikizBack/src/types/api.ts` is the **authoritative source** for all shared backend → frontend API types.

`MikizGame/src/api/shared-types.ts` is a synced copy — **never edit it directly**. It is regenerated automatically before every `dev` and `build` run via `npm run sync-types` (defined in `MikizGame/package.json`).

When modifying response shapes, always update `MikizBack/src/types/api.ts` first.

## Politeki Data Pipeline

Raw CSV data in `data/` (French deputies, government members, presidents since the 5th Republic) is enriched by Python scripts in `scripts/` (fetching birthdates, birth locations, origin regions, party affiliations, popularity scores, etc.) and produces the static dataset at `MikizBack/src/data/politics.json` (~1.4 MB). This file is loaded by the backend at startup and must not be hand-edited.

## Deployment

Both sub-projects deploy independently on [Railway](https://railway.app). Each has its own `railway.toml` at the sub-project root.
