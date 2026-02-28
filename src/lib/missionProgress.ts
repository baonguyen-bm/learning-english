/**
 * Persists in-mission progress (currentStep, scores) so users can resume
 * after navigating away. Cleared when mission is completed.
 */

const PREFIX = "learning-english:mission-progress:";

export interface MissionProgress {
  currentStep: number;
  scores: number[];
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
    const parsed = JSON.parse(stored) as MissionProgress;
    if (
      typeof parsed?.currentStep === "number" &&
      Array.isArray(parsed?.scores)
    ) {
      return parsed;
    }
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
