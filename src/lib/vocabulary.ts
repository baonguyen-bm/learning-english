import { supabase } from "./supabaseClient";

export interface VocabularyEntry {
  id: string;
  user_id: string;
  word: string;
  definition: string | null;
  phonetic: string | null;
  syllables: string | null;
  times_practiced: number;
  best_score: number;
  starred: boolean;
  next_review_at: string | null;
  srs_interval: number;
  created_at: string;
  last_practiced_at: string;
}

export type VocabularyFilter = "needs_practice" | "mastered" | "starred";
export type VocabularySortBy = "word" | "last_practiced_at";

export async function upsertVocabulary(
  userId: string,
  word: string,
  definition?: string,
  phonetic?: string,
  syllables?: string,
  score: number = 0
) {
  const { error } = await supabase.rpc("upsert_vocabulary", {
    p_user_id: userId,
    p_word: word,
    p_definition: definition ?? null,
    p_phonetic: phonetic ?? null,
    p_syllables: syllables ?? null,
    p_score: score,
  });
  if (error) throw error;
}

export async function getUserVocabulary(
  userId: string,
  filter?: VocabularyFilter,
  sortBy: VocabularySortBy = "last_practiced_at"
): Promise<VocabularyEntry[]> {
  let query = supabase
    .from("vocabulary")
    .select("*")
    .eq("user_id", userId);

  if (filter === "needs_practice") {
    query = query.lt("best_score", 75);
  } else if (filter === "mastered") {
    query = query.eq("best_score", 100);
  } else if (filter === "starred") {
    query = query.eq("starred", true);
  }

  if (sortBy === "word") {
    query = query.order("word", { ascending: true });
  } else {
    query = query.order("last_practiced_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function toggleStar(
  userId: string,
  word: string
): Promise<boolean> {
  const { data: current, error: fetchError } = await supabase
    .from("vocabulary")
    .select("starred, next_review_at")
    .eq("user_id", userId)
    .eq("word", word)
    .single();

  if (fetchError) throw fetchError;

  const newStarred = !current.starred;

  const updates: Record<string, unknown> = { starred: newStarred };
  if (newStarred && !current.next_review_at) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updates.next_review_at = tomorrow.toISOString();
    updates.srs_interval = 1;
  }

  const { error: updateError } = await supabase
    .from("vocabulary")
    .update(updates)
    .eq("user_id", userId)
    .eq("word", word);

  if (updateError) throw updateError;
  return newStarred;
}

export async function getVocabularyCount(userId: string): Promise<{
  total: number;
  needsPractice: number;
  mastered: number;
}> {
  const { data, error } = await supabase
    .from("vocabulary")
    .select("best_score")
    .eq("user_id", userId);

  if (error) throw error;

  const all = data || [];
  return {
    total: all.length,
    needsPractice: all.filter((v) => v.best_score < 75).length,
    mastered: all.filter((v) => v.best_score === 100).length,
  };
}
