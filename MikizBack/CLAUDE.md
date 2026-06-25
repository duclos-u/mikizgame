# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

All commands run from `MikizBack/`:

```bash
bun dev                            # start server with hot reload
bun start                          # start server (production)
bun test                           # run unit tests (no DB required)
bun lint                           # Biome linter
bun format                         # Biome auto-format

bun db:generate                    # generate SQL migrations from schema
bun db:migrate                     # apply pending migrations
bun db:push                        # push schema directly (dev only)
bun db:studio                      # open Drizzle Studio

bun words:schedule [days] [start]  # bulk-schedule daily words
bun words:delete <from> [to]       # delete scheduled words in date range
bun words:set <date> <word>        # set a single word for a date

bun artists:schedule [days] [start] # bulk-schedule daily artists via Spotify
bun artists:set <date> <id|name>    # pin a specific artist to a date (Spotify ID or name)

bun films:schedule [days] [start]  # bulk-schedule daily films via TMDB
bun films:set <date> <tmdbId>      # set a single film for a date
```

## Architecture

Hono app with 5 route groups mounted in `src/index.ts`:

```
/api/auth        → src/routes/auth.ts
/api/motivex       → src/routes/motivex.ts
/api/filmdujour  → src/routes/filmdujour.ts   (Film du Jour game)
/api/cineclue    → src/routes/filmdujour.ts   (film autocomplete search)
/api/leaderboard → src/routes/leaderboard.ts
```

**Auth middleware** (`src/middleware/auth.ts`): call `authMiddleware` on any route that needs a user. It reads the `Authorization: Bearer <token>` header, verifies the JWT, and attaches `c.var.userId`.

**Game logic** lives in pure functions in `src/lib/`:
- `src/lib/motivex.ts` — `evaluateGuess(guess, word)` returns per-letter result
- `src/lib/cineclue.ts` — `compareFilms(submitted, target, prev)` accumulates hints; `indicesFinaux(target)` reveals everything on game end
- `src/lib/tmdb.ts` — `fetchFilmById(id)` fetches from TMDB API with an in-memory Map cache

**Scoring**: `src/routes/leaderboard.ts` uses F1 barème — 1st→25pts, 2nd→18pts, 3rd→15pts, 4th→12pts, 5th→10pts, 6th→8pts, loss→0pts.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Hex string used for JWT signing |
| `PORT` | Server port (default: 3000) |
| `CORS_ORIGIN` | Allowed CORS origin (e.g. `http://localhost:5173`) |
| `DATABASE_SSL` | Set to `true` for SSL DB connections |
| `TMDB_API_KEY` | Required for CinéClue — get one at themoviedb.org |
| `SPOTIFY_CLIENT_ID` | Required for VinyMix search & scheduling — create an app at developer.spotify.com |
| `SPOTIFY_CLIENT_SECRET` | Required for VinyMix search & scheduling — create an app at developer.spotify.com |
| `RESEND_API_KEY` | Required for password reset emails — get one at resend.com |
| `RESEND_FROM_EMAIL` | Sender address for password reset emails (must be a verified domain in Resend) |

## Language Convention

All code identifiers (variable names, function names, route names) and comments must be written in **English**. User-facing content (API response messages, game text, error messages shown to users) may be in French.

## Adding a New Game

1. `src/db/schema/<game>.ts` — define tables with Drizzle
2. `src/lib/<game>.ts` — pure game logic functions
3. `src/routes/<game>.ts` — Hono router, follow Motivex or CinéClue pattern
4. `src/index.ts` — mount the new router
5. `scripts/seed.ts` — insert the new game row
6. `bun db:generate && bun db:migrate`
