#!/usr/bin/env bun
import { join } from "path";
/**
 * Downloads Lexique 3.83 and generates two word lists for Motivex:
 *   words/fr-daily-words.txt  — top 7300 common words (used as target words)
 *   words/fr-valid-words.txt  — broader dictionary (accepted as guesses only)
 *
 * Usage: bun run words:build
 */
import { $ } from "bun";
import { normalizeWord } from "../src/lib/normalize";

const ZIP_URL = "http://www.lexique.org/databases/Lexique383/Lexique383.zip";
const TMP_DIR = "/tmp/lexique-build";
const OUT_DIR = join(import.meta.dir, "../words");
const DAILY_WORDS_COUNT = 7300;
const MIN_DAILY_FREQ = 5;
const MIN_VALID_FREQ = 0.01;

await $`mkdir -p ${TMP_DIR}`;

console.log("Downloading Lexique 3.83 (~25 MB)...");
await $`curl -sL ${ZIP_URL} -o ${TMP_DIR}/Lexique383.zip`;

console.log("Extracting TSV...");
const tsvContent = await $`unzip -p ${TMP_DIR}/Lexique383.zip Lexique383.tsv`.text();

console.log("Parsing entries...");
const lines = tsvContent.split("\n");
const header = lines[0].split("\t");

// Match exact column name or "N_name" prefixed form (e.g. "6_freqfilms2")
function colIdx(name: string): number {
  const idx = header.findIndex((h) => h === name || h.endsWith(`_${name}`));
  if (idx === -1) throw new Error(`Column "${name}" not found in TSV header`);
  return idx;
}

const iOrtho = colIdx("ortho");
// Use word-form frequency (not lemma frequency) so rare conjugations score low
const iFreqFilms = colIdx("freqfilms2");
const iFreqLivres = colIdx("freqlivres");

// Deduplicate by normalized form, keeping highest frequency
const wordFreq = new Map<string, number>();

for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const parts = line.split("\t");
  if (parts.length <= Math.max(iOrtho, iFreqFilms, iFreqLivres)) continue;

  const ortho = parts[iOrtho];
  // Skip multi-word expressions (hyphens, spaces, apostrophes create false concatenations)
  if (/[-\s']/.test(ortho)) continue;
  const normalized = normalizeWord(ortho);
  if (normalized.length < 4 || normalized.length > 9) continue;

  const freq =
    (Number.parseFloat(parts[iFreqFilms]) || 0) + (Number.parseFloat(parts[iFreqLivres]) || 0);

  const current = wordFreq.get(normalized) ?? 0;
  if (freq > current) wordFreq.set(normalized, freq);
}

const sorted = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]);

const dailyWords = sorted
  .filter(([, freq]) => freq >= MIN_DAILY_FREQ)
  .slice(0, DAILY_WORDS_COUNT)
  .map(([word]) => word);

const dailySet = new Set(dailyWords);
const validWords = sorted
  .filter(([word, freq]) => freq >= MIN_VALID_FREQ && !dailySet.has(word))
  .map(([word]) => word);

await Bun.write(join(OUT_DIR, "fr-daily-words.txt"), dailyWords.join("\n") + "\n");
await Bun.write(join(OUT_DIR, "fr-valid-words.txt"), validWords.join("\n") + "\n");

console.log(`Daily words written:  ${dailyWords.length}`);
console.log(`Valid words written:  ${validWords.length}`);
console.log(`Output directory:     ${OUT_DIR}`);

await $`rm -rf ${TMP_DIR}`;
