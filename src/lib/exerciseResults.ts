import { supabase } from "./supabaseClient";

export async function saveExerciseResult(
  userId: string,
  missionId: string | null,
  exerciseType: "spelling" | "dictation" | "speaking" | "listening",
  itemKey: string,
  score: number
) {
  const { error } = await supabase.from("exercise_results").insert({
    user_id: userId,
    mission_id: missionId,
    exercise_type: exerciseType,
    item_key: itemKey,
    score,
  });
  if (error) throw error;
}

export async function getResultsForMission(
  userId: string,
  missionId: string
) {
  const { data, error } = await supabase
    .from("exercise_results")
    .select("*")
    .eq("user_id", userId)
    .eq("mission_id", missionId)
    .order("attempted_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getResultsByType(
  userId: string,
  exerciseType: string
) {
  const { data, error } = await supabase
    .from("exercise_results")
    .select("*")
    .eq("user_id", userId)
    .eq("exercise_type", exerciseType)
    .order("attempted_at", { ascending: false });
  if (error) throw error;
  return data;
}
