import { supabase } from "./supabaseClient";
import missionsJson from "../../data/missions.json";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export interface Mission {
  id: string;
  day_number: number;
  title: string;
  description: string;
  content: {
    spelling: { word: string; definition: string }[];
    dictation: { text: string; hint: string }[];
    speaking: { text: string }[];
  };
}

export interface UserProgress {
  id: string;
  user_id: string;
  mission_id: string;
  status: "locked" | "open" | "completed";
  score: number;
  completed_at: string | null;
  missions: Mission;
}

// ---------------------------------------------------------------------------
// Dev-mode helpers (localStorage)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "edp_dev_progress";

function getDevMissions(): Mission[] {
  return missionsJson.map((m) => ({
    id: `dev-mission-${m.day_number}`,
    day_number: m.day_number,
    title: m.title,
    description: m.description ?? "",
    content: m.content as Mission["content"],
  }));
}

function readDevProgress(): UserProgress[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeDevProgress(progress: UserProgress[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getMissions(): Promise<Mission[]> {
  if (DEV_MODE) return getDevMissions();

  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .order("day_number", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getMissionById(
  missionId: string
): Promise<Mission | null> {
  if (DEV_MODE) {
    return getDevMissions().find((m) => m.id === missionId) ?? null;
  }

  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (error) return null;
  return data;
}

export async function ensureProgressInitialized(userId: string) {
  if (DEV_MODE) {
    const existing = readDevProgress();
    if (existing.length > 0) return;

    const missions = getDevMissions();
    const progress: UserProgress[] = missions.map((m) => ({
      id: `dev-progress-${m.day_number}`,
      user_id: userId,
      mission_id: m.id,
      status: m.day_number === 1 ? "open" : "locked",
      score: 0,
      completed_at: null,
      missions: m,
    }));
    writeDevProgress(progress);
    return;
  }

  const { data: missions } = await supabase
    .from("missions")
    .select("id, day_number")
    .order("day_number", { ascending: true });

  if (!missions || missions.length === 0) return;

  const { data: existing } = await supabase
    .from("user_progress")
    .select("mission_id")
    .eq("user_id", userId);

  const existingIds = new Set((existing || []).map((p) => p.mission_id));
  const toInsert = missions
    .filter((m) => !existingIds.has(m.id))
    .map((m) => ({
      user_id: userId,
      mission_id: m.id,
      status: m.day_number === 1 ? "open" : "locked",
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("user_progress").insert(toInsert);
    if (error) throw error;
  }
}

export async function getUserProgress(
  userId: string
): Promise<UserProgress[]> {
  if (DEV_MODE) {
    let progress = readDevProgress();
    if (progress.length === 0) {
      await ensureProgressInitialized(userId);
      progress = readDevProgress();
    }
    return progress;
  }

  const { data, error } = await supabase
    .from("user_progress")
    .select("*, missions(*)")
    .eq("user_id", userId)
    .order("missions(day_number)", { ascending: true });

  if (error) throw error;
  return data;
}

export async function completeMission(
  userId: string,
  missionId: string,
  score: number,
  nextMissionId?: string
) {
  if (DEV_MODE) {
    const progress = readDevProgress();
    const idx = progress.findIndex((p) => p.mission_id === missionId);
    if (idx !== -1) {
      progress[idx].status = "completed";
      progress[idx].score = Math.max(progress[idx].score, score);
      progress[idx].completed_at = new Date().toISOString();
    }
    if (nextMissionId) {
      const nextIdx = progress.findIndex(
        (p) => p.mission_id === nextMissionId
      );
      if (nextIdx !== -1 && progress[nextIdx].status === "locked") {
        progress[nextIdx].status = "open";
      }
    }
    writeDevProgress(progress);
    return;
  }

  const { data: existing } = await supabase
    .from("user_progress")
    .select("score")
    .eq("user_id", userId)
    .eq("mission_id", missionId)
    .single();

  const finalScore = existing ? Math.max(existing.score, score) : score;

  const { error: updateError } = await supabase
    .from("user_progress")
    .update({
      status: "completed",
      score: finalScore,
      completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("mission_id", missionId);

  if (updateError) throw updateError;

  if (nextMissionId) {
    const { error: unlockError } = await supabase
      .from("user_progress")
      .update({ status: "open" })
      .eq("user_id", userId)
      .eq("mission_id", nextMissionId)
      .eq("status", "locked");

    if (unlockError) throw unlockError;
  }
}

export async function calculateStreak(userId: string): Promise<number> {
  let dates: number[];

  if (DEV_MODE) {
    const progress = readDevProgress();
    const completed = progress.filter((p) => p.completed_at);
    if (completed.length === 0) return 0;

    dates = completed
      .map((p) => {
        const d = new Date(p.completed_at!);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => b - a);
  } else {
    const { data, error } = await supabase
      .from("user_progress")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (error || !data || data.length === 0) return 0;

    dates = data
      .map((p) => {
        const d = new Date(p.completed_at!);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => b - a);
  }

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneDayMs = 86400000;
  let expected = today.getTime();

  for (const date of dates) {
    if (date === expected || date === expected - oneDayMs) {
      streak++;
      expected = date - oneDayMs;
    } else {
      break;
    }
  }

  return streak;
}
