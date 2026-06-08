import { readFileSync } from "fs";
import { join } from "path";
import { normalizeWord } from "./normalize";

let dailyWords: string[] | null = null;
let validWordSet: Set<string> | null = null;

function parse(content: string): string[] {
  return content
    .split("\n")
    .map((line) => normalizeWord(line.trim()))
    .filter((w) => w.length >= 5 && w.length <= 9);
}

function load(): void {
  if (dailyWords && validWordSet) return;

  const wordsDir = join(import.meta.dir, "../../words");

  const dailyContent = readFileSync(
    join(wordsDir, "fr-daily-words.txt"),
    "utf-8"
  );
  dailyWords = parse(dailyContent);

  const validContent = readFileSync(
    join(wordsDir, "fr-valid-words.txt"),
    "utf-8"
  );
  const validList = parse(validContent);

  validWordSet = new Set([...dailyWords, ...validList]);
}

export function getDailyWordList(): string[] {
  load();
  return dailyWords!;
}

export function isValidWord(word: string): boolean {
  load();
  return validWordSet!.has(normalizeWord(word));
}
