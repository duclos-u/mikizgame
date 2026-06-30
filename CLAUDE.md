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

## Type-Sync Contract

`MikizBack/src/types/api.ts` is the **authoritative source** for all shared backend → frontend API types.

`MikizGame/src/api/shared-types.ts` is a synced copy — **never edit it directly**. It is regenerated automatically before every `dev` and `build` run via `npm run sync-types` (defined in `MikizGame/package.json`).

When modifying response shapes, always update `MikizBack/src/types/api.ts` first.

## Politeki Data Pipeline

Raw CSV data in `data/` (French deputies, government members, presidents since the 5th Republic) is enriched by Python scripts in `scripts/` (fetching birthdates, birth locations, origin regions, party affiliations, popularity scores, etc.) and produces the static dataset at `MikizBack/src/data/politics.json` (~1.4 MB). This file is loaded by the backend at startup and must not be hand-edited.

## Deployment

Both sub-projects deploy independently on [Railway](https://railway.app). Each has its own `railway.toml` at the sub-project root.
