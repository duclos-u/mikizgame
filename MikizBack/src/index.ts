import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./routes/auth";
import { cineclueSearch, filmdujour } from "./routes/filmdujour";
import { leaderboard } from "./routes/leaderboard";
import { sutom } from "./routes/sutom";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.route("/api/auth", auth);
app.route("/api/sutom", sutom);
app.route("/api/filmdujour", filmdujour);
app.route("/api/cineclue", cineclueSearch);
app.route("/api/leaderboard", leaderboard);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT ?? 3000);
console.log(`Server running on http://localhost:${port}`);

export default { port, fetch: app.fetch };
