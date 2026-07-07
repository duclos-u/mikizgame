import rawData from "../data/yearbox.json";

export type YearboxDomain = "cinema" | "musique" | "sport" | "politique" | "tech";

export type YearboxFact = {
  domain: YearboxDomain;
  text: string;
};

export type YearboxPuzzle = {
  index: number;
  year: number;
  facts: YearboxFact[];
};

export type YearboxDirection = "exact" | "trop-tot" | "trop-tard";

const ALL_PUZZLES: YearboxPuzzle[] = (rawData as { puzzles: YearboxPuzzle[] }).puzzles;

export function getPuzzle(index: number): YearboxPuzzle | null {
  return ALL_PUZZLES[index] ?? null;
}

export function getPuzzleCount(): number {
  return ALL_PUZZLES.length;
}

export function getFactsRevealed(puzzle: YearboxPuzzle, wrongGuessCount: number): YearboxFact[] {
  return puzzle.facts.slice(0, Math.min(2 + wrongGuessCount, 5));
}

export function compareYear(guess: number, target: number): YearboxDirection {
  if (guess === target) return "exact";
  return guess < target ? "trop-tot" : "trop-tard";
}
