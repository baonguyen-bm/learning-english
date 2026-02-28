/**
 * Persists in-mission progress per section so users can resume
 * after navigating away. Cleared when mission is completed.
 */

const PREFIX = "learning-english:mission-progress:";

export type SectionType = "spelling" | "dictation" | "listening" | "speaking";

export interface SectionProgress {
  currentStep: number;
  scores: number[];
  completed: boolean;
}

export interface MissionProgress {
  sections: Partial<Record<SectionType, SectionProgress>>;
  activeSection: SectionType | null;
}

export function getMissionProgress(
  userId: string,
  missionId: string
): MissionProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const key = `${PREFIX}${userId}:${missionId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed?.sections && typeof parsed.sections === "object") {
      return parsed as MissionProgress;
    }
    // Old format detected — discard
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  return null;
}

export function setMissionProgress(
  userId: string,
  missionId: string,
  progress: MissionProgress
) {
  if (typeof window === "undefined") return;
  try {
    const key = `${PREFIX}${userId}:${missionId}`;
    localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function clearMissionProgress(userId: string, missionId: string) {
  if (typeof window === "undefined") return;
  try {
    const key = `${PREFIX}${userId}:${missionId}`;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
