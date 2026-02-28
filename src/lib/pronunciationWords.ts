import { supabase } from "./supabaseClient";
import type { PhonemeResult } from "@/types/pronunciation";

export interface PronunciationWord {
  id: string;
  user_id: string;
  word: string;
  phonetic: string | null;
  best_score: number;
  last_score: number;
  times_practiced: number;
  phonemes_json: PhonemeResult[] | null;
  source_mission_id: string | null;
  created_at: string;
  last_practiced_at: string | null;
}

export type PronunciationFilter = "all" | "weak" | "improved";

/**
 * Upsert a weak word after a Speaking exercise.
 * Uses Supabase .upsert() to avoid TOCTOU race on the UNIQUE(user_id, word) constraint.
 * On conflict, keeps the higher best_score via a follow-up update.
 */
export async function upsertWeakWord(
  userId: string,
  word: string,
  score: number,
  phonemes?: PhonemeResult[],
  missionId?: string
) {
  const now = new Date().toISOString();
  const lowerWord = word.toLowerCase();

  const { data: existing } = await supabase
    .from("pronunciation_words")
    .select("id, best_score")
    .eq("user_id", userId)
    .eq("word", lowerWord)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, unknown> = {
      last_score: score,
      last_practiced_at: now,
    };
    if (score > existing.best_score) {
      updates.best_score = score;
    }
    if (phonemes) {
      updates.phonemes_json = phonemes;
    }
    const { error } = await supabase
      .from("pronunciation_words")
      .update(updates)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("pronunciation_words")
      .upsert(
        {
          user_id: userId,
          word: lowerWord,
          best_score: score,
          last_score: score,
          times_practiced: 0,
          phonemes_json: phonemes ?? null,
          source_mission_id: missionId ?? null,
          last_practiced_at: now,
        },
        { onConflict: "user_id,word" }
      );
    if (error) throw error;
  }
}

/**
 * Batch-upsert multiple weak words (called after Speaking section).
 */
export async function upsertWeakWords(
  userId: string,
  words: { word: string; score: number; phonemes?: PhonemeResult[] }[],
  missionId?: string
) {
  for (const w of words) {
    await upsertWeakWord(userId, w.word, w.score, w.phonemes, missionId);
  }
}

/**
 * Update score after a drill practice session.
 */
export async function updateWordScore(
  userId: string,
  word: string,
  score: number,
  phonemes?: PhonemeResult[]
) {
  const { data: current } = await supabase
    .from("pronunciation_words")
    .select("id, best_score, times_practiced")
    .eq("user_id", userId)
    .eq("word", word.toLowerCase())
    .maybeSingle();

  if (!current) return;

  const updates: Record<string, unknown> = {
    last_score: score,
    times_practiced: current.times_practiced + 1,
    last_practiced_at: new Date().toISOString(),
  };
  if (score > current.best_score) {
    updates.best_score = score;
  }
  if (phonemes) {
    updates.phonemes_json = phonemes;
  }

  const { error } = await supabase
    .from("pronunciation_words")
    .update(updates)
    .eq("id", current.id);
  if (error) throw error;
}

/**
 * Get all pronunciation words for a user, optionally filtered.
 * - "weak": best_score < 75
 * - "improved": best_score >= 75
 * - "all": everything
 */
export async function getWeakWords(
  userId: string,
  filter: PronunciationFilter = "all"
): Promise<PronunciationWord[]> {
  let query = supabase
    .from("pronunciation_words")
    .select("*")
    .eq("user_id", userId);

  if (filter === "weak") {
    query = query.lt("best_score", 75);
  } else if (filter === "improved") {
    query = query.gte("best_score", 75);
  }

  query = query.order("best_score", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Count words with best_score < 75 (for dashboard badge).
 */
export async function getWeakWordCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("pronunciation_words")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .lt("best_score", 75);
  if (error) throw error;
  return count ?? 0;
}
