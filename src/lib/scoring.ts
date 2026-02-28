export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function scoreSpelling(input: string, target: string): number {
  const distance = levenshteinDistance(
    input.trim().toLowerCase(),
    target.trim().toLowerCase()
  );
  if (distance === 0) return 100;
  if (distance === 1) return 75;
  if (distance === 2) return 50;
  return 0;
}

function normalize(s: string): string[] {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * LCS-based alignment that tolerates minor misspellings.
 * Returns a map of targetIndex → inputIndex for matched word pairs.
 */
export function lcsAlignment(
  inputWords: string[],
  targetWords: string[]
): Map<number, number> {
  const m = inputWords.length;
  const n = targetWords.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const dist = levenshteinDistance(inputWords[i - 1], targetWords[j - 1]);
      if (dist <= 2) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const alignment = new Map<number, number>();
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    const dist = levenshteinDistance(inputWords[i - 1], targetWords[j - 1]);
    if (dist <= 2 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      alignment.set(j - 1, i - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return alignment;
}

export function scoreDictation(input: string, target: string): number {
  const inputWords = normalize(input);
  const targetWords = normalize(target);

  if (targetWords.length === 0 || inputWords.length === 0) return 0;

  const alignment = lcsAlignment(inputWords, targetWords);
  let totalScore = 0;

  for (let j = 0; j < targetWords.length; j++) {
    if (alignment.has(j)) {
      const dist = levenshteinDistance(
        inputWords[alignment.get(j)!],
        targetWords[j]
      );
      if (dist === 0) totalScore += 1;
      else if (dist === 1) totalScore += 0.75;
      else if (dist === 2) totalScore += 0.5;
    }
  }

  const lengthPenalty =
    inputWords.length > targetWords.length * 1.5
      ? targetWords.length / inputWords.length
      : 1;

  return Math.round((totalScore / targetWords.length) * 100 * lengthPenalty);
}

export type WordDiffResult = {
  word: string;
  expected: string;
  status: "correct" | "close" | "wrong" | "missing";
};

export function diffWords(input: string, target: string): WordDiffResult[] {
  const inputWords = normalize(input);
  const targetWords = normalize(target);
  const alignment = lcsAlignment(inputWords, targetWords);

  return targetWords.map((expected, j) => {
    if (!alignment.has(j)) {
      return { word: "", expected, status: "missing" as const };
    }
    const i = alignment.get(j)!;
    const dist = levenshteinDistance(inputWords[i], expected);
    let status: WordDiffResult["status"];
    if (dist === 0) status = "correct";
    else if (dist <= 2) status = "close";
    else status = "wrong";
    return { word: inputWords[i], expected, status };
  });
}

// ---------------------------------------------------------------------------
// Character-level diff (for spelling feedback)
// ---------------------------------------------------------------------------

export type CharDiffOp =
  | { type: "match"; char: string }
  | { type: "substitute"; got: string; expected: string }
  | { type: "insert"; char: string }
  | { type: "delete"; char: string };

export function diffChars(input: string, target: string): CharDiffOp[] {
  const a = input.toLowerCase();
  const b = target.toLowerCase();
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops: CharDiffOp[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: "match", char: target[j - 1] });
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.unshift({
        type: "substitute",
        got: input[i - 1],
        expected: target[j - 1],
      });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.unshift({ type: "delete", char: input[i - 1] });
      i--;
    } else {
      ops.unshift({ type: "insert", char: target[j - 1] });
      j--;
    }
  }

  return ops;
}

export function scoreSpeaking(transcript: string, target: string): number {
  const spokenWords = normalize(transcript);
  const targetWords = normalize(target);

  if (targetWords.length === 0) return 0;

  let matched = 0;
  const used = new Set<number>();

  for (const tw of targetWords) {
    const idx = spokenWords.findIndex((w, i) => !used.has(i) && w === tw);
    if (idx !== -1) {
      matched++;
      used.add(idx);
    }
  }

  return Math.round((matched / targetWords.length) * 100);
}
