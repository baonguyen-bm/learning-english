export interface PhonemeResult {
  phoneme: string;
  accuracyScore: number;
  /** IPA representation */
  ipa?: string;
}

export interface WordPronunciationResult {
  word: string;
  accuracyScore: number;
  errorType: "none" | "mispronunciation" | "omission" | "insertion";
  phonemes?: PhonemeResult[];
}

export interface PronunciationResult {
  transcript: string;
  /** 0-100 */
  accuracyScore: number;
  /** 0-100 */
  fluencyScore: number;
  /** 0-100 */
  completenessScore: number;
  /** 0-100, only from Azure */
  prosodyScore?: number;
  /** 0-100 overall */
  pronunciationScore: number;
  words: WordPronunciationResult[];
  /** Which engine produced this result */
  source: "azure" | "heuristic";
}
