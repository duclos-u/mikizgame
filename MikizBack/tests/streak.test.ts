import { describe, expect, test } from "bun:test";
import { computeStreakUpdate } from "../src/lib/streak";

describe("computeStreakUpdate", () => {
  test("first ever play starts a streak of 1", () => {
    const result = computeStreakUpdate(
      { streakCount: 0, longestStreakCount: 0, lastPlayedDate: null },
      "2026-07-20",
    );
    expect(result).toMatchObject({ streakCount: 1, longestStreakCount: 1, changed: true });
  });

  test("playing again the same day is a no-op", () => {
    const result = computeStreakUpdate(
      { streakCount: 3, longestStreakCount: 5, lastPlayedDate: "2026-07-20" },
      "2026-07-20",
    );
    expect(result).toMatchObject({ streakCount: 3, longestStreakCount: 5, changed: false });
  });

  test("playing the day after yesterday increments the streak", () => {
    const result = computeStreakUpdate(
      { streakCount: 3, longestStreakCount: 3, lastPlayedDate: "2026-07-19" },
      "2026-07-20",
    );
    expect(result).toMatchObject({ streakCount: 4, longestStreakCount: 4, changed: true });
  });

  test("a gap of one or more days resets the streak to 1", () => {
    const result = computeStreakUpdate(
      { streakCount: 10, longestStreakCount: 10, lastPlayedDate: "2026-07-15" },
      "2026-07-20",
    );
    expect(result).toMatchObject({ streakCount: 1, longestStreakCount: 10, changed: true });
  });

  test("longest streak is preserved through a reset", () => {
    const result = computeStreakUpdate(
      { streakCount: 2, longestStreakCount: 50, lastPlayedDate: "2026-07-10" },
      "2026-07-20",
    );
    expect(result.longestStreakCount).toBe(50);
  });

  test("crossing a milestone is reported once", () => {
    const result = computeStreakUpdate(
      { streakCount: 6, longestStreakCount: 6, lastPlayedDate: "2026-07-19" },
      "2026-07-20",
    );
    expect(result.newMilestone).toBe(7);
  });

  test("no milestone reported when not crossed", () => {
    const result = computeStreakUpdate(
      { streakCount: 4, longestStreakCount: 4, lastPlayedDate: "2026-07-19" },
      "2026-07-20",
    );
    expect(result.newMilestone).toBeNull();
  });
});
