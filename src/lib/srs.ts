import { supabase } from "./supabaseClient";
import type { VocabularyEntry } from "./vocabulary";

export async function getDueReviewItems(
  userId: string,
  limit: number = 15
): Promise<VocabularyEntry[]> {
  const { data, error } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("user_id", userId)
    .not("next_review_at", "is", null)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getDueReviewCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("vocabulary")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("next_review_at", "is", null)
    .lte("next_review_at", new Date().toISOString());

  if (error) throw error;
  return count ?? 0;
}

export async function updateSRSAfterReview(
  userId: string,
  word: string,
  score: number
) {
  const { data: current, error: fetchError } = await supabase
    .from("vocabulary")
    .select("srs_interval, best_score, times_practiced")
    .eq("user_id", userId)
    .eq("word", word)
    .single();

  if (fetchError) throw fetchError;

  let newInterval: number;
  if (score >= 75) {
    newInterval = Math.min(current.srs_interval * 2, 30);
  } else if (score >= 50) {
    newInterval = current.srs_interval;
  } else {
    newInterval = 1;
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  const { error: updateError } = await supabase
    .from("vocabulary")
    .update({
      srs_interval: newInterval,
      next_review_at: nextReview.toISOString(),
      best_score: Math.max(current.best_score, score),
      times_practiced: current.times_practiced + 1,
      last_practiced_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("word", word);

  if (updateError) throw updateError;
}
