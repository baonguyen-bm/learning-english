/**
 * Dialog voice preferences for Listening Comprehension.
 * Stored in localStorage. Each speaker position maps to a voice key.
 */

const STORAGE_KEY = "learning-english:dialog-voices";

/** Voice options for API TTS (must match src/app/api/tts/route.ts VOICE_MAP) */
export const DIALOG_VOICE_OPTIONS = [
  { key: "default", label: "Aria (default)" },
  { key: "male", label: "Guy (male)" },
  { key: "female", label: "Aria (female)" },
  { key: "male2", label: "Christopher (male)" },
  { key: "female2", label: "Jenny (female)" },
] as const;

type DialogVoiceKey = (typeof DIALOG_VOICE_OPTIONS)[number]["key"];

const DEFAULT_VOICES: DialogVoiceKey[] = [
  "default",
  "male",
  "female",
  "male2",
  "female2",
];

export function getDialogVoices(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_VOICES];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [...DEFAULT_VOICES];
    const parsed = JSON.parse(stored) as string[];
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return [...DEFAULT_VOICES];
}

export function setDialogVoices(voices: string[]) {
  if (typeof window === "undefined") return;
  const validKeys = new Set<DialogVoiceKey>(DIALOG_VOICE_OPTIONS.map((o) => o.key));
  const filtered: DialogVoiceKey[] = voices
    .slice(0, 10)
    .map((v) => (validKeys.has(v as DialogVoiceKey) ? (v as DialogVoiceKey) : "default"));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getDialogVoiceForSpeaker(speakerIndex: number): string {
  const voices = getDialogVoices();
  return voices[speakerIndex % voices.length] ?? "default";
}
