# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

All commands run from `MikizBack/`:

```bash
bun dev                            # start server with hot reload
bun start                          # start server (production)
bun test                           # run unit tests (no DB required)
bun lint                           # Biome linter
bun lint:fix                       # Biome auto-fix
bun format                         # Biome auto-format

bun db:generate                    # generate SQL migrations from schema
bun db:migrate                     # apply pending migrations
bun db:push                        # push schema directly (dev only)
bun db:studio                      # open Drizzle Studio
bun db:seed                        # seed initial game rows

bun words:build                    # build word list files from source
bun words:schedule [days] [start]  # bulk-schedule daily words
bun words:delete <from> [to]       # delete scheduled words in date range
bun words:set <date> <word>        # set a single word for a date

bun artists:schedule [days] [start]  # bulk-schedule daily artists via Spotify
bun artists:set <date> <id|name>     # pin a specific artist to a date (Spotify ID or name)
bun artists:delete <from> [to]       # delete scheduled artists in date range
bun artists:backfill [days]          # backfill missing artist metadata

bun films:schedule [days] [start]  # bulk-schedule daily films via TMDB
bun films:set <date> <tmdbId>      # set a single film for a date
bun films:delete <from> [to]       # delete scheduled films in date range

bun politicians:schedule [days] [start]  # bulk-schedule daily politicians
bun politicians:set <date> <id>          # pin a specific politician to a date
bun politicians:delete <from> [to]       # delete scheduled politicians in date range

bun chainapan:set <date> <start> <target>  # set a word-ladder puzzle for a date
bun chainapan:delete <from> [to]           # delete scheduled chainapan puzzles

bun yearbox:set <date> <puzzleIndex>    # pin a yearbox puzzle to a date
bun yearbox:schedule [days] [start]     # bulk-schedule yearbox puzzles
bun yearbox:delete <from> [to]          # delete scheduled yearbox puzzles

bun admin:set <email>           # promote a user to admin
bun admin:set <email> --revoke  # revoke admin status
```

## Architecture

Hono app with route groups mounted in `src/index.ts`:

```
/api/auth        → src/routes/auth.ts
/api/motivex     → src/routes/motivex.ts
/api/filmdujour  → src/routes/filmdujour.ts    (Cinemaxd game sessions/guesses)
/api/cinemaxd    → src/routes/filmdujour.ts    (film autocomplete search)
/api/vinymix     → src/routes/vinymix.ts       (Vinymix game)
/api/politics    → src/routes/politics.ts      (Politeki game)
/api/yearbox     → src/routes/yearbox.ts       (Yearbox game + event suggestions)
/api/chainapan   → src/routes/chainapan.ts     (Chainapan word-ladder game)
/api/leaderboard → src/routes/leaderboard.ts
/api/admin       → src/routes/admin.ts         (backoffice: suggestions + scheduling)
```

**Auth middleware** (`src/middleware/auth.ts`):
- `authMiddleware` — requires a valid JWT; rejects unauthenticated requests. Attaches `c.var.userId`.
- `optionalAuthMiddleware` — attaches `c.var.userId` if a valid token is present, but does not reject if missing. Used for routes that work both logged-in and anonymous.
- `adminAuthMiddleware` (`src/middleware/adminAuth.ts`) — verifies JWT **and** checks `users.isAdmin = true`; returns 403 if not admin.

All three read the `Authorization: Bearer <token>` header and verify the JWT.

**Game logic** lives in pure functions in `src/lib/`:
- `src/lib/motivex.ts` — `evaluateGuess(guess, word)` returns per-letter result
- `src/lib/cinemaxd.ts` — `compareFilms(submitted, target, prev)` accumulates hints; `indicesFinaux(target)` reveals everything on game end
- `src/lib/vinymix.ts` — `compareArtists()`, `followerTier()`, `dailySeed()`
- `src/lib/politics.ts` — `getPolitician(index)`, `searchPoliticians(q)`, Politeki comparison logic
- `src/lib/yearbox.ts` — `getPuzzle(index)`, `getPuzzleCount()`, `findPuzzleByYear(year)`, `compareYear()`
- `src/lib/chainapan.ts` — `validateStep()`, `letterDiff()`, word-ladder logic
- `src/lib/words.ts` — `isValidWord(word)` against the French 4-letter word list
- `src/lib/normalize.ts` — `normalizeWord(raw)` strips accents and uppercases
- `src/lib/tmdb.ts` — `fetchFilmById(id)` fetches from TMDB API with an in-memory Map cache
- `src/lib/spotify.ts` — Spotify API client (artist search + token management)
- `src/lib/musicbrainz.ts` — MusicBrainz API client
- `src/lib/genres.ts` — genre normalization/mapping helpers

**Canonical types**: `src/types/api.ts` is the source of truth for shared backend → frontend API types. When modifying response shapes, update this file first — the frontend syncs from it automatically via `npm run sync-types`.

**Password reset**: `src/server/auth/passwordReset.ts` handles the Resend email integration, triggered by `POST /api/auth/forgot-password`.

**Static dataset**: `src/data/politics.json` (~1.4 MB) is the Politeki politician dataset loaded at startup. It is generated by the Python scripts in the root `scripts/` directory — do not hand-edit it.

**Scoring**: `src/routes/leaderboard.ts` uses F1 barème — 1st→25pts, 2nd→18pts, 3rd→15pts, 4th→12pts, 5th→10pts, 6th→8pts, loss→0pts.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Hex string used for JWT signing |
| `PORT` | Server port (default: 3000) |
| `CORS_ORIGIN` | Allowed CORS origin (e.g. `http://localhost:5173`) |
| `DATABASE_SSL` | Set to `true` for SSL DB connections |
| `TMDB_API_KEY` | Required for Cinemaxd — get one at themoviedb.org |
| `SPOTIFY_CLIENT_ID` | Required for Vinymix search & scheduling — create an app at developer.spotify.com |
| `SPOTIFY_CLIENT_SECRET` | Required for Vinymix search & scheduling — create an app at developer.spotify.com |
| `RESEND_API_KEY` | Required for password reset emails — get one at resend.com |
| `RESEND_FROM_EMAIL` | Sender address for password reset emails (must be a verified domain in Resend) |

## Language Convention

All code identifiers (variable names, function names, route names) and comments must be written in **English**. User-facing content (API response messages, game text, error messages shown to users) may be in French.

## Adding a New Game

1. `src/db/schema/<game>.ts` — define tables with Drizzle
2. `src/lib/<game>.ts` — pure game logic functions
3. `src/routes/<game>.ts` — Hono router, follow Motivex or Vinymix pattern
4. `src/index.ts` — mount the new router
5. `scripts/seed.ts` — add the game row to the seed script (for local dev)
6. **Write a data migration** to insert the game row into the `games` table — this is **mandatory for production**. Railway runs `bun db:migrate` on deploy but does NOT run the seed script. Without this row, `getXxxGameId()` returns `null` and leaderboard entries are never written.

   Create `drizzle/migrations/NNNN_seed_<game>_game.sql`:
   ```sql
   INSERT INTO games (slug, name, active) VALUES ('<slug>', '<Name>', true)
   ON CONFLICT (slug) DO UPDATE SET name = '<Name>', active = true;
   ```
   Then add the entry to `drizzle/migrations/meta/_journal.json`.

7. `bun db:generate && bun db:migrate`
