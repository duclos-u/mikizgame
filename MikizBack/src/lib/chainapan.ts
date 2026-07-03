import { normalizeWord } from "./normalize";
import { isValidWord } from "./words";

export const MAX_STEPS = 8;
export const WORD_LENGTH = 5;

export type StepTileResult = "correct" | "changed" | "neutral";

export interface ChainapanStep {
  word: string;
  tileResults: StepTileResult[];
}

export function letterDiff(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) count++;
  }
  return count;
}

export function changedPosition(a: string, b: string): number {
  let idx = -1;
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      idx = i;
      count++;
    }
  }
  return count === 1 ? idx : -1;
}

export function computeStepTiles(prev: string, word: string, target: string): StepTileResult[] {
  const changedIdx = changedPosition(prev, word);
  return word.split("").map((ch, i) => {
    if (ch === target[i]) return "correct";
    if (i === changedIdx) return "changed";
    return "neutral";
  });
}

export function validateStep(word: string, prevWord: string): string | null {
  const normalized = normalizeWord(word);
  if (normalized.length !== WORD_LENGTH) {
    return `Le mot doit avoir ${WORD_LENGTH} lettres`;
  }
  const diff = letterDiff(normalized, prevWord);
  if (diff === 0) {
    return "Le mot doit différer d'au moins une lettre";
  }
  if (diff > 1) {
    return "Le mot doit différer d'exactement une lettre";
  }
  if (!isValidWord(normalized)) {
    return "Mot invalide";
  }
  return null;
}
