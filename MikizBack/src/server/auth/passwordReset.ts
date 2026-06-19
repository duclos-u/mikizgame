import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "../../db";
import { passwordResetTokens, users } from "../../db/schema";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@mikizgame.com";
const TOKEN_TTL_MS = 15 * 60 * 1000;

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export async function sendResetEmail(email: string, resetUrl: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Réinitialisation de votre mot de passe Mikiz",
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe Mikiz.</p>
      <p>
        <a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p>Ce lien expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function validateResetToken(
  token: string,
): Promise<{ userId: string; isValid: boolean }> {
  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.token, token),
  });

  if (!record) return { userId: "", isValid: false };
  if (record.usedAt !== null) return { userId: record.userId, isValid: false };
  if (record.expiresAt < new Date()) return { userId: record.userId, isValid: false };

  return { userId: record.userId, isValid: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const { userId, isValid } = await validateResetToken(token);
  if (!isValid) throw new Error("Invalid or expired token");

  const passwordHash = await Bun.password.hash(newPassword);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  });
}

export async function createResetToken(userId: string): Promise<string> {
  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  return token;
}
