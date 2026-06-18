#!/usr/bin/env bun
/**
 * Reset a user's password by email.
 *
 * Usage:
 *   bun users:set-password <email> <new-password>
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: bun users:set-password <email> <new-password>");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const user = await db.query.users.findFirst({ where: eq(users.email, email) });

if (!user) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

const passwordHash = await Bun.password.hash(password);
await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

console.log(`Password updated for ${user.username} (${email}).`);
process.exit(0);
