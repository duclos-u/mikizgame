# MikizGame

React SPA front-end for Mikiz — a platform hosting French daily mini games. Built with Vite, React 19, and TypeScript.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React 19 |
| Routing | React Router 7 |
| Build | Vite 5 |
| Language | TypeScript 5 |
| Styling | Sass (single global stylesheet) |
| Validation | Zod |
| Linter | ESLint 9 |

---

## Local Setup

### 1. Prerequisites

- Node ≥ 20.0.0

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment (optional)

By default the API client points to `/api`. Override for local development:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:3000/api
```

### 4. Start the dev server

```bash
npm run dev
```

The app runs on `http://localhost:5173` by default.

---

## Project Structure

```
src/
  App.tsx                   # root layout, routing, auth modal state
  main.tsx                  # entry point
  index.sass                # single global stylesheet (OKLCH color tokens)
  api/
    client.ts               # typed API client, auto-injects Bearer token
  context/
    AuthContext.tsx          # user/token state, login/register/logout
  components/
    Header.tsx              # top navigation bar
    DailyGamesPage.tsx      # home hub — game cards grid
    GameHeader.tsx          # header for individual game pages
    LeaderboardPage.tsx     # full leaderboard view
    AuthModal.tsx           # login / register modal
    TeamModal.tsx           # team management modal
  data/
    games.ts                # static game definitions (id, name, route/url)
  hooks/
    useJdj2State.ts         # localStorage: which games marked done today
    useHubScores.ts         # fetches leaderboard data for the hub
  routes/
    GameRoutePage.tsx       # route wrapper for internal games
    gameRegistry.tsx        # maps gameId → React component
  games/
    cineclue/               # Film du Jour — film guessing game
    motivex/                  # Motivex — French Wordle variant
```

---

## Commands

```bash
npm run dev      # start dev server with HMR
npm run build    # type-check + Vite build → dist/
npm run preview  # serve the dist/ build locally
npm run lint     # ESLint
```

---

## Games

| Game | Type | Description |
|---|---|---|
| Motivex | Internal | Guess a French word in 6 tries (Wordle variant) |
| CinéClue | Internal | Guess a film in 10 tries with progressive hints |
