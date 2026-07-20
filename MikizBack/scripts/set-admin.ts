#!/usr/bin/env bun
/**
 * Promote or revoke admin status for a user.
 *
 * Usage:
 *   bun admin:set <email>           # promote to admin
 *   bun admin:set <email> --revoke  # revoke admin status
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

const [email, flag] = process.argv.slice(2);

if (!email) {
  console.error("Usage: bun admin:set <email> [--revoke]");
  process.exit(1);
}

const revoke = flag === "--revoke";

const user = await db.query.users.findFirst({
  where: eq(users.email, email),
  columns: { id: true, username: true, isAdmin: true },
});

if (!user) {
  console.error(`Utilisateur introuvable : ${email}`);
  process.exit(1);
}

await db.update(users).set({ isAdmin: !revoke }).where(eq(users.id, user.id));

if (revoke) {
  console.log(`✓ ${email} (${user.username}) n'est plus admin.`);
} else {
  console.log(`✓ ${email} (${user.username}) est maintenant admin.`);
}

process.exit(0);
