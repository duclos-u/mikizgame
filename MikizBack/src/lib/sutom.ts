export type LetterResult = "correct" | "present" | "absent";

export interface GuessResult {
  guess: string;
  result: LetterResult[];
}

/**
 * Evaluates a guess against the target word using standard Wordle rules.
 * Handles duplicate letters correctly: a letter is only marked "present"
 * as many times as it appears in the target word.
 */
export function evaluateGuess(guess: string, word: string): LetterResult[] {
  const len = word.length;
  const result: LetterResult[] = new Array(len).fill("absent");
  const wordLetters = word.split("");
  const guessLetters = guess.split("");

  // First pass: correct positions
  for (let i = 0; i < len; i++) {
    if (guessLetters[i] === wordLetters[i]) {
      result[i] = "correct";
      wordLetters[i] = "";
      guessLetters[i] = "";
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < len; i++) {
    if (guessLetters[i] === "") continue;
    const idx = wordLetters.indexOf(guessLetters[i]);
    if (idx !== -1) {
      result[i] = "present";
      wordLetters[idx] = "";
    }
  }

  return result;
}
