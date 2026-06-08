import { describe, expect, test } from "bun:test";
import { evaluateGuess } from "../src/lib/sutom";

describe("evaluateGuess", () => {
  test("all correct", () => {
    expect(evaluateGuess("MONDE", "MONDE")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  test("all absent", () => {
    expect(evaluateGuess("ABCDE", "FGHIJ")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
  });

  test("all present (anagram)", () => {
    // MONDE vs EMOND — every letter exists but in wrong position
    expect(evaluateGuess("MONDE", "EMOND")).toEqual([
      "present",
      "present",
      "present",
      "present",
      "present",
    ]);
  });

  test("mixed correct and absent", () => {
    // MONDE vs MXNXE — M correct, O absent, N correct, D absent, E correct
    expect(evaluateGuess("MONDE", "MXNXE")).toEqual([
      "correct",
      "absent",
      "correct",
      "absent",
      "correct",
    ]);
  });

  test("duplicate letters — only marks as many as exist in word", () => {
    // Word: BELLE — has one B, two L, one E at end
    // Guess: LLBBB
    // L at 0: word has L at 2 and 3; mark present (uses one L slot)
    // L at 1: still one L remaining; mark present (uses second L slot)
    // B at 2: word has B at 0; mark present
    // B at 3: no B remaining; absent
    // B at 4: no B remaining; absent
    expect(evaluateGuess("LLBBB", "BELLE")).toEqual([
      "present",
      "present",
      "present",
      "absent",
      "absent",
    ]);
  });

  test("correct takes priority over present for the same letter", () => {
    // Word: BELLE — B at 0 is correct
    // Guess: BOLLE
    // B(0) correct, O(1) absent, L(2) correct, L(3) correct, E(4) correct
    expect(evaluateGuess("BOLLE", "BELLE")).toEqual([
      "correct",
      "absent",
      "correct",
      "correct",
      "correct",
    ]);
  });
});
