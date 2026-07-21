# Social Features Plan — Friends & Leagues

Status: draft plan, not yet implemented.

## Scope (v1)

1. **Friends** — send/accept/reject friend requests, list friends, unfriend.
2. **Leagues** — named groups joined via invite code (not limited to mutual friends), with F1-barème standings reusing the existing leaderboard scoring.

Out of scope for v1 (candidates for later): activity/notifications feed, blocking, league seasons/resets, friends-only global leaderboard toggle (can piggyback on league standings instead — see "Open questions").

## Data model

New Drizzle schema files, following the existing `src/db/schema/<domain>.ts` pattern.

### `src/db/schema/friendships.ts`

```ts
export const friendshipStatus = pgEnum("friendship_status", ["pending", "accepted"]);

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    respondedAt: timestamp("responded_at"),
  },
  (table) => [
    uniqueIndex("uq_friendship_pair").on(table.requesterId, table.addresseeId),
    index("idx_friendship_addressee").on(table.addresseeId, table.status),
  ],
);
```

One row per direction covers the request lifecycle simply. To answer "are A and B friends" or "list A's friends" query both `requesterId = A OR addresseeId = A` with `status = 'accepted'`. A check constraint (`requester_id <> addressee_id`) prevents self-friending; app code checks the reverse pair before insert to avoid duplicate requests going both ways.

### `src/db/schema/leagues.ts`

```ts
export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(), // e.g. 6-char base32, human-shareable
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leagueMembers = pgTable(
  "league_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_league_member").on(table.leagueId, table.userId)],
);
```

No `role` column needed for v1 — ownership is just `leagues.ownerId`; membership is flat. Standings are computed on read from `leaderboardEntries`, same as the existing cross-game leaderboard — no new points/scoring tables.

Both files get added to `src/db/schema/index.ts` (`export * from "./friendships"`, `export * from "./leagues"`), and a migration via `bun db:generate && bun db:migrate`.

## Backend logic (`src/lib/`)

- `src/lib/friends.ts` — pure helpers: `areFriends(a, b)` query shape, request validation (no self-request, no duplicate pending request in either direction).
- `src/lib/leagues.ts` — `generateInviteCode()` (short random code, e.g. nanoid alphabet without ambiguous chars, retried on unique-constraint collision), and standings computation that reuses `RANK_POINTS` / `pointsExpr` from `src/lib/leaderboard.ts` — same F1 barème (1st→25 … loss→0), just scoped to a member-userId list instead of "everyone."

Reusing `src/lib/leaderboard.ts` here is the key move: league standings and friends-scoped views are the *same* cross-game aggregation query already in `leaderboard.ts:/cross`, just with an added `inArray(users.id, memberIds)` filter. Worth extracting that query into a shared function (e.g. `computeCrossLeaderboard(date, userIds?)`) that both `/api/leaderboard/cross` and `/api/leagues/:id/standings` call, instead of duplicating it.

## API routes

### `src/routes/friends.ts` → mounted at `/api/friends`, all behind `authMiddleware`

| Route | Description |
|---|---|
| `GET /api/friends` | List accepted friends (username, avatar-derivable initials, streak). |
| `GET /api/friends/requests` | List incoming + outgoing pending requests. |
| `POST /api/friends/requests` `{ username }` | Send a request. 404 if user not found, 409 if already friends/pending. |
| `POST /api/friends/requests/:id/accept` | Accept — only the addressee may accept. |
| `POST /api/friends/requests/:id/reject` | Reject/cancel — either party may reject a pending request. |
| `DELETE /api/friends/:userId` | Unfriend (deletes the accepted row). |

### `src/routes/leagues.ts` → mounted at `/api/leagues`, all behind `authMiddleware`

| Route | Description |
|---|---|
| `GET /api/leagues` | Leagues the current user belongs to. |
| `POST /api/leagues` `{ name }` | Create a league; creator becomes owner + first member; generates invite code. |
| `POST /api/leagues/join` `{ inviteCode }` | Join via code. 404 if code invalid. |
| `GET /api/leagues/:id` | League detail: name, owner, member list. Members-only (403 otherwise). |
| `GET /api/leagues/:id/standings?date=` | Cross-game F1 standings scoped to members, same shape as `/api/leaderboard/cross`. |
| `POST /api/leagues/:id/regenerate-code` | Owner-only. |
| `DELETE /api/leagues/:id/members/me` | Leave a league. |
| `DELETE /api/leagues/:id` | Owner-only, deletes league + memberships (cascade). |

Both routers get mounted in `src/index.ts` next to the existing route groups, and new response shapes go into `MikizBack/src/types/api.ts` first (per the Type-Sync Contract), before the frontend consumes them.

## Frontend (`MikizGame`)

- **`FriendsPage`** — search-by-username add flow, pending requests (incoming/outgoing) with accept/reject, friends list. Reuses the `Avatar` (initials-circle) pattern already in `LeaderboardPage.tsx`.
- **`LeaguesPage`** — list of leagues the user's in, "Create league" modal, "Join with code" input.
- **`LeagueDetailPage`** — standings table styled like the existing cross-game leaderboard, member list, invite-code share button (copy-to-clipboard), leave/delete controls gated on ownership.
- **`api/client.ts`** — typed functions for the new endpoints, mirroring existing patterns (`getLeaderboardCross`, etc.).
- **Nav** — add a friend-request badge count (small unread-style indicator) once `GET /api/friends/requests` is wired up.

## Phased rollout

1. **Schema + migrations**: `friendships`, `leagues`, `league_members` tables.
2. **Friends backend**: `src/lib/friends.ts`, `src/routes/friends.ts`, mount route, add types to `api.ts`.
3. **Friends UI**: `FriendsPage`, nav entry point, request badge.
4. **Leagues backend**: `src/lib/leagues.ts` (invite codes + shared standings query extracted from `leaderboard.ts`), `src/routes/leagues.ts`, mount route, add types.
5. **Leagues UI**: `LeaguesPage`, `LeagueDetailPage`, create/join flows.

Each phase is independently shippable and testable — friends can ship and be useful (a friends list) before leagues exist.

## Open questions / decisions to make before building

- **League size cap?** Standings queries are cheap (they're just a filtered version of the existing cross-leaderboard query), but the UI may want a soft cap (e.g. 50) to keep the standings table readable.
- **Invite code reuse after leaving?** Simplest v1 behavior: leaving a league doesn't invalidate the code; only "regenerate" does.
- **Should unfriending affect league membership?** Recommend no — leagues are independent, invite-code-based groups, not derived from the friend graph (per your scope choice).
- **Do we ever need a friends-only *global* leaderboard, separate from leagues?** If yes later, it can literally just be a system-generated League containing your friends — reuses all the same standings code with no new backend logic.
