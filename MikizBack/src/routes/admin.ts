import { zValidator } from "@hono/zod-validator";
import { between, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import {
  chainapanDaily,
  cinemaxdDaily,
  motivexDailyWords,
  politicsDaily,
  users,
  yearboxDaily,
  yearboxEventSuggestions,
} from "../db/schema";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { normalizeWord } from "../lib/normalize";
import { fetchFilmById } from "../lib/tmdb";
import { getPolitician } from "../lib/politics";
import { findPuzzleByYear, getPuzzle } from "../lib/yearbox";
import { isValidWord } from "../lib/words";

const admin = new Hono();

const PAGE_SIZE = 20;

const VALID_STATUSES = ["pending", "approved", "rejected"] as const;
type SuggestionStatus = (typeof VALID_STATUSES)[number];

/**
 * GET /api/admin/suggestions?status=pending&page=1
 * Admin only. Lists event suggestions filtered by status.
 */
admin.get("/suggestions", adminAuthMiddleware, async (c) => {
  const status = (c.req.query("status") ?? "pending") as SuggestionStatus;
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  if (!VALID_STATUSES.includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const [suggestions, totalResult] = await Promise.all([
    db
      .select({
        id: yearboxEventSuggestions.id,
        userId: yearboxEventSuggestions.userId,
        username: users.username,
        year: yearboxEventSuggestions.year,
        domain: yearboxEventSuggestions.domain,
        text: yearboxEventSuggestions.text,
        status: yearboxEventSuggestions.status,
        adminNote: yearboxEventSuggestions.adminNote,
        createdAt: yearboxEventSuggestions.createdAt,
        reviewedAt: yearboxEventSuggestions.reviewedAt,
      })
      .from(yearboxEventSuggestions)
      .innerJoin(users, eq(yearboxEventSuggestions.userId, users.id))
      .where(eq(yearboxEventSuggestions.status, status))
      .orderBy(desc(yearboxEventSuggestions.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ total: count() })
      .from(yearboxEventSuggestions)
      .where(eq(yearboxEventSuggestions.status, status)),
  ]);

  return c.json({
    suggestions: suggestions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      reviewedAt: s.reviewedAt?.toISOString() ?? null,
    })),
    total: totalResult[0]?.total ?? 0,
    page,
  });
});

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  adminNote: z.string().max(300).optional(),
});

/**
 * PATCH /api/admin/suggestions/:id
 * Admin only. Approves or rejects a suggestion.
 */
admin.patch(
  "/suggestions/:id",
  adminAuthMiddleware,
  zValidator("json", reviewSchema),
  async (c) => {
    const { id } = c.req.param();
    const { status, adminNote } = c.req.valid("json");

    const [updated] = await db
      .update(yearboxEventSuggestions)
      .set({ status, adminNote: adminNote ?? null, reviewedAt: new Date() })
      .where(eq(yearboxEventSuggestions.id, id))
      .returning({ id: yearboxEventSuggestions.id });

    if (!updated) return c.json({ error: "Suggestion not found" }, 404);
    return c.json({ ok: true });
  },
);

// ─── Schedule routes ──────────────────────────────────────────────────────────

const SCHEDULE_GAMES = ["motivex", "cinemaxd", "politeki", "yearbox", "chainapan"] as const;
type ScheduleGame = (typeof SCHEDULE_GAMES)[number];

function dateRange(from?: string, to?: string): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  const f = from ?? today;
  const t =
    to ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })();
  return { from: f, to: t };
}

/**
 * GET /api/admin/schedule/:game?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
admin.get("/schedule/:game", adminAuthMiddleware, async (c) => {
  const game = c.req.param("game") as ScheduleGame;
  if (!SCHEDULE_GAMES.includes(game)) return c.json({ error: "Unknown game" }, 400);

  const { from, to } = dateRange(c.req.query("from"), c.req.query("to"));

  type RawEntry = { date: string; label: string; payload: Record<string, unknown> };
  const entries: RawEntry[] = [];

  if (game === "motivex") {
    const rows = await db
      .select({ date: motivexDailyWords.date, word: motivexDailyWords.word })
      .from(motivexDailyWords)
      .where(between(motivexDailyWords.date, from, to))
      .orderBy(motivexDailyWords.date);
    for (const r of rows) {
      entries.push({ date: r.date, label: r.word, payload: { word: r.word } });
    }
  } else if (game === "cinemaxd") {
    const rows = await db
      .select({ date: cinemaxdDaily.date, tmdbId: cinemaxdDaily.tmdbId })
      .from(cinemaxdDaily)
      .where(between(cinemaxdDaily.date, from, to))
      .orderBy(cinemaxdDaily.date);
    for (const r of rows) {
      const film = await fetchFilmById(r.tmdbId);
      entries.push({
        date: r.date,
        label: film?.titre ?? `Film #${r.tmdbId}`,
        payload: { tmdbId: r.tmdbId },
      });
    }
  } else if (game === "politeki") {
    const rows = await db
      .select({ date: politicsDaily.date, politicianIndex: politicsDaily.politicianIndex })
      .from(politicsDaily)
      .where(between(politicsDaily.date, from, to))
      .orderBy(politicsDaily.date);
    for (const r of rows) {
      const p = getPolitician(r.politicianIndex);
      entries.push({
        date: r.date,
        label: p ? `${p.prenom} ${p.nom}` : `Politicien #${r.politicianIndex}`,
        payload: { politicianIndex: r.politicianIndex },
      });
    }
  } else if (game === "yearbox") {
    const rows = await db
      .select({ date: yearboxDaily.date, puzzleIndex: yearboxDaily.puzzleIndex })
      .from(yearboxDaily)
      .where(between(yearboxDaily.date, from, to))
      .orderBy(yearboxDaily.date);
    for (const r of rows) {
      const puzzle = getPuzzle(r.puzzleIndex);
      entries.push({
        date: r.date,
        label: puzzle ? String(puzzle.year) : `Puzzle #${r.puzzleIndex}`,
        payload: { puzzleIndex: r.puzzleIndex },
      });
    }
  } else if (game === "chainapan") {
    const rows = await db
      .select({
        date: chainapanDaily.date,
        startWord: chainapanDaily.startWord,
        targetWord: chainapanDaily.targetWord,
      })
      .from(chainapanDaily)
      .where(between(chainapanDaily.date, from, to))
      .orderBy(chainapanDaily.date);
    for (const r of rows) {
      entries.push({
        date: r.date,
        label: `${r.startWord} → ${r.targetWord}`,
        payload: { startWord: r.startWord, targetWord: r.targetWord },
      });
    }
  }

  return c.json({ game, entries });
});

const motivexScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  word: z.string().min(1).max(20),
});
const cinemaxdScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tmdbId: z.number().int().positive(),
});
const politikiScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  politicianIndex: z.number().int().min(0),
});
const yearboxScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  puzzleIndex: z.number().int().min(0).optional(),
  year: z.number().int().min(1900).max(2030).optional(),
});
const chainapanScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startWord: z.string().min(1).max(10),
  targetWord: z.string().min(1).max(10),
});

/**
 * POST /api/admin/schedule/:game
 * Upserts a scheduled entry for the given game and date.
 */
admin.post("/schedule/motivex", adminAuthMiddleware, zValidator("json", motivexScheduleSchema), async (c) => {
  const { date, word } = c.req.valid("json");
  const normalized = normalizeWord(word);
  await db
    .insert(motivexDailyWords)
    .values({ date, word: normalized })
    .onConflictDoUpdate({ target: motivexDailyWords.date, set: { word: normalized } });
  return c.json({ ok: true, entry: { date, label: normalized, payload: { word: normalized } } });
});

admin.post("/schedule/cinemaxd", adminAuthMiddleware, zValidator("json", cinemaxdScheduleSchema), async (c) => {
  const { date, tmdbId } = c.req.valid("json");
  const film = await fetchFilmById(tmdbId);
  if (!film) return c.json({ error: "Film introuvable sur TMDB" }, 400);
  await db
    .insert(cinemaxdDaily)
    .values({ date, tmdbId })
    .onConflictDoUpdate({ target: cinemaxdDaily.date, set: { tmdbId } });
  return c.json({ ok: true, entry: { date, label: film.titre, payload: { tmdbId } } });
});

admin.post("/schedule/politeki", adminAuthMiddleware, zValidator("json", politikiScheduleSchema), async (c) => {
  const { date, politicianIndex } = c.req.valid("json");
  const p = getPolitician(politicianIndex);
  if (!p) return c.json({ error: "Politicien introuvable" }, 400);
  await db
    .insert(politicsDaily)
    .values({ date, politicianIndex })
    .onConflictDoUpdate({ target: politicsDaily.date, set: { politicianIndex } });
  const label = `${p.prenom} ${p.nom}`;
  return c.json({ ok: true, entry: { date, label, payload: { politicianIndex } } });
});

admin.post("/schedule/yearbox", adminAuthMiddleware, zValidator("json", yearboxScheduleSchema), async (c) => {
  const { date, puzzleIndex: rawIndex, year } = c.req.valid("json");
  let puzzleIndex = rawIndex;
  if (puzzleIndex === undefined && year !== undefined) {
    const found = findPuzzleByYear(year);
    if (!found) return c.json({ error: `Aucun puzzle pour l'année ${year}` }, 400);
    puzzleIndex = found.index;
  }
  if (puzzleIndex === undefined) return c.json({ error: "puzzleIndex ou year requis" }, 400);
  const puzzle = getPuzzle(puzzleIndex);
  if (!puzzle) return c.json({ error: "Puzzle introuvable" }, 400);
  await db
    .insert(yearboxDaily)
    .values({ date, puzzleIndex })
    .onConflictDoUpdate({ target: yearboxDaily.date, set: { puzzleIndex } });
  return c.json({ ok: true, entry: { date, label: String(puzzle.year), payload: { puzzleIndex } } });
});

admin.post("/schedule/chainapan", adminAuthMiddleware, zValidator("json", chainapanScheduleSchema), async (c) => {
  const { date, startWord: rawStart, targetWord: rawTarget } = c.req.valid("json");
  const startWord = normalizeWord(rawStart);
  const targetWord = normalizeWord(rawTarget);
  if (startWord.length !== 4 || targetWord.length !== 4)
    return c.json({ error: "Les deux mots doivent faire 4 lettres" }, 400);
  if (!isValidWord(startWord)) return c.json({ error: `"${startWord}" n'est pas un mot valide` }, 400);
  if (!isValidWord(targetWord)) return c.json({ error: `"${targetWord}" n'est pas un mot valide` }, 400);
  if (startWord === targetWord) return c.json({ error: "Les deux mots doivent être différents" }, 400);
  await db
    .insert(chainapanDaily)
    .values({ date, startWord, targetWord })
    .onConflictDoUpdate({ target: chainapanDaily.date, set: { startWord, targetWord } });
  const label = `${startWord} → ${targetWord}`;
  return c.json({ ok: true, entry: { date, label, payload: { startWord, targetWord } } });
});

/**
 * DELETE /api/admin/schedule/:game/:date
 */
admin.delete("/schedule/:game/:date", adminAuthMiddleware, async (c) => {
  const game = c.req.param("game") as ScheduleGame;
  const date = c.req.param("date");

  if (!SCHEDULE_GAMES.includes(game)) return c.json({ error: "Unknown game" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "Invalid date" }, 400);

  let deleted = false;

  if (game === "motivex") {
    const result = await db.delete(motivexDailyWords).where(eq(motivexDailyWords.date, date)).returning({ id: motivexDailyWords.id });
    deleted = result.length > 0;
  } else if (game === "cinemaxd") {
    const result = await db.delete(cinemaxdDaily).where(eq(cinemaxdDaily.date, date)).returning({ date: cinemaxdDaily.date });
    deleted = result.length > 0;
  } else if (game === "politeki") {
    const result = await db.delete(politicsDaily).where(eq(politicsDaily.date, date)).returning({ date: politicsDaily.date });
    deleted = result.length > 0;
  } else if (game === "yearbox") {
    const result = await db.delete(yearboxDaily).where(eq(yearboxDaily.date, date)).returning({ date: yearboxDaily.date });
    deleted = result.length > 0;
  } else if (game === "chainapan") {
    const result = await db.delete(chainapanDaily).where(eq(chainapanDaily.date, date)).returning({ id: chainapanDaily.id });
    deleted = result.length > 0;
  }

  if (!deleted) return c.json({ error: "Aucune entrée à supprimer" }, 404);
  return c.json({ ok: true });
});

export { admin };
