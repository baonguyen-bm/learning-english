import { supabase } from "./supabaseClient";
import type {
  SpellingItem,
  DictationItem,
  SpeakingItem,
  ListeningItem,
} from "@/types/exercises";

export interface Mission {
  id: string;
  day_number: number;
  title: string;
  description: string;
  difficulty: number;
  content: {
    spelling: SpellingItem[];
    dictation: DictationItem[];
    speaking: SpeakingItem[];
    listening?: ListeningItem[];
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

export async function getMissions(difficulty?: number): Promise<Mission[]> {
  let query = supabase
    .from("missions")
    .select("*")
    .order("day_number", { ascending: true });

  if (difficulty !== undefined) {
    query = query.eq("difficulty", difficulty);
  }

  const { data, error } = await query;
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

export async function ensureProgressInitialized(
  userId: string,
  difficulty?: number
) {
  const effectiveDifficulty = difficulty ?? await getUserDifficulty(userId);

  let missionQuery = supabase
    .from("missions")
    .select("id, day_number")
    .order("day_number", { ascending: true });

  if (effectiveDifficulty !== undefined) {
    missionQuery = missionQuery.eq("difficulty", effectiveDifficulty);
  }

  const { data: missions } = await missionQuery;
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
  userId: string,
  difficulty?: number
): Promise<UserProgress[]> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("*, missions(*)")
    .eq("user_id", userId)
    .order("missions(day_number)", { ascending: true });

  if (error) throw error;

  if (difficulty !== undefined) {
    return (data || []).filter(
      (p) => p.missions && p.missions.difficulty === difficulty
    );
  }

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

export async function getUserDifficulty(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("difficulty_preference")
    .eq("id", userId)
    .single();

  if (error || !data) return 2;
  return data.difficulty_preference ?? 2;
}

export async function setUserDifficulty(
  userId: string,
  difficulty: number
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ difficulty_preference: difficulty })
    .eq("id", userId);

  if (error) throw error;
}

export async function switchDifficulty(
  userId: string,
  newDifficulty: number
): Promise<void> {
  await setUserDifficulty(userId, newDifficulty);

  const { error: deleteError } = await supabase
    .from("user_progress")
    .delete()
    .eq("user_id", userId);

  if (deleteError) throw deleteError;

  await ensureProgressInitialized(userId, newDifficulty);
}

export async function getRollingAverageScore(
  userId: string,
  lastN: number = 3
): Promise<number | null> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("score")
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(lastN);

  if (error || !data || data.length < lastN) return null;

  return Math.round(data.reduce((sum, p) => sum + p.score, 0) / data.length);
}

export interface DifficultySuggestion {
  type: "suggest_harder" | "suggest_easier";
  current: number;
  suggested: number;
}

export async function getDifficultySuggestion(
  userId: string
): Promise<DifficultySuggestion | null> {
  const [difficulty, avg] = await Promise.all([
    getUserDifficulty(userId),
    getRollingAverageScore(userId),
  ]);

  if (avg === null) return null;

  if (avg >= 85 && difficulty < 3) {
    return { type: "suggest_harder", current: difficulty, suggested: difficulty + 1 };
  }
  if (avg <= 50 && difficulty > 1) {
    return { type: "suggest_easier", current: difficulty, suggested: difficulty - 1 };
  }
  return null;
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
