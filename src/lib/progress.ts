import { supabase } from "./supabaseClient";

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

export async function getMissions(): Promise<Mission[]> {
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
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (error) return null;
  return data;
}

export async function ensureProgressInitialized(userId: string) {
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
  const { data, error } = await supabase
    .from("user_progress")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  if (error || !data || data.length === 0) return 0;

  const dates = data
    .map((p) => {
      const d = new Date(p.completed_at!);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => b - a);

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
