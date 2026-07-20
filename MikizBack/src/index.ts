import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { admin } from "./routes/admin";
import { auth } from "./routes/auth";
import { chainapan } from "./routes/chainapan";
import { cinemaxdSearch, filmdujour } from "./routes/filmdujour";
import { footix } from "./routes/footix";
import { leaderboard } from "./routes/leaderboard";
import { motivex } from "./routes/motivex";
import { politics } from "./routes/politics";
import { streak } from "./routes/streak";
import { vinymix } from "./routes/vinymix";
import { yearbox } from "./routes/yearbox";

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
app.route("/api/motivex", motivex);
app.route("/api/filmdujour", filmdujour);
app.route("/api/cinemaxd", cinemaxdSearch);
app.route("/api/vinymix", vinymix);
app.route("/api/politics", politics);
app.route("/api/chainapan", chainapan);
app.route("/api/footix", footix);
app.route("/api/yearbox", yearbox);
app.route("/api/admin", admin);
app.route("/api/leaderboard", leaderboard);
app.route("/api/streak", streak);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT ?? 3000);
console.log(`Server running on http://localhost:${port}`);

export default { port, fetch: app.fetch };
