export interface SpellingItem {
  word: string;
  definition: string;
  phonetic?: string;
  syllables?: string;
}

export interface DictationItem {
  text: string;
  hint?: string;
}

export interface SpeakingItem {
  text: string;
}

export interface ListeningDialogLine {
  speaker: string;
  text: string;
}

export interface ListeningQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface ListeningItem {
  title: string;
  dialog: ListeningDialogLine[];
  questions: ListeningQuestion[];
}

export type Exercise =
  | { type: "spelling"; data: SpellingItem }
  | { type: "dictation"; data: DictationItem }
  | { type: "speaking"; data: SpeakingItem }
  | { type: "listening"; data: ListeningItem };
