import { beforeAll, describe, expect, test } from "bun:test";
import { signToken, verifyToken } from "../src/lib/jwt";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
});

describe("JWT", () => {
  test("signs and verifies a token", async () => {
    const payload = { sub: "user-uuid-123", username: "alice" };
    const token = await signToken(payload);
    expect(typeof token).toBe("string");

    const verified = await verifyToken(token);
    expect(verified.sub).toBe("user-uuid-123");
    expect(verified.username).toBe("alice");
  });

  test("rejects a tampered token", async () => {
    const token = await signToken({ sub: "x", username: "y" });
    const tampered = token.slice(0, -4) + "XXXX";
    expect(verifyToken(tampered)).rejects.toThrow();
  });

  test("rejects a completely invalid token", async () => {
    expect(verifyToken("not.a.jwt")).rejects.toThrow();
  });
});
