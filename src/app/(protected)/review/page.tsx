"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getDueReviewItems, updateSRSAfterReview } from "@/lib/srs";
import { saveExerciseResult } from "@/lib/exerciseResults";
import type { VocabularyEntry } from "@/lib/vocabulary";
import { SpellingBee } from "@/components/modules/SpellingBee";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, ArrowRight, PartyPopper, Inbox } from "lucide-react";

export default function ReviewPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<VocabularyEntry[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const due = await getDueReviewItems(user!.id);
      setItems(due);
      setLoading(false);
    }
    load();
  }, [user]);

  const handleComplete = useCallback(
    async (score: number) => {
      if (!user) return;
      const word = items[currentIdx];

      updateSRSAfterReview(user.id, word.word, score).catch(console.error);
      saveExerciseResult(user.id, null, "spelling", word.word, score).catch(
        console.error
      );

      const updated = [...scores, score];
      setScores(updated);

      if (currentIdx + 1 < items.length) {
        setCurrentIdx((i) => i + 1);
      } else {
        setShowSummary(true);
      }
    },
    [user, items, currentIdx, scores]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-faded">Loading review...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-page">
        <header className="border-b border-rule bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 md:px-8 py-3 flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-ink-faded hover:text-ink transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-display font-semibold text-xl text-ink">Review</h1>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
          <Card className="text-center py-8 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/10 text-success mx-auto">
              <Inbox size={36} />
            </div>
            <h2 className="font-display font-semibold text-2xl text-ink">
              Nothing to review!
            </h2>
            <p className="text-ink-faded">
              Great work! Check back later for words that need practice.
            </p>
            <Button onClick={() => router.push("/")}>
              Back to Dashboard <ArrowRight size={16} />
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  const avg =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

  return (
    <main className="min-h-screen bg-page">
      <header className="border-b border-rule bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-ink-faded hover:text-ink transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-ink">
                {showSummary
                  ? "Review Complete!"
                  : `Review ${currentIdx + 1}/${items.length}`}
              </span>
            </div>
            <div className="h-1.5 bg-rule rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${showSummary ? 100 : (currentIdx / items.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        {showSummary ? (
          <div className="space-y-6 animate-scale-in">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 text-accent">
                <PartyPopper size={36} />
              </div>
              <h1 className="font-display font-semibold text-3xl text-ink">
                Review Complete!
              </h1>
              <p className="text-ink-faded">
                You reviewed {items.length} word{items.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex justify-center py-2">
              <ProgressRing
                progress={avg}
                size={120}
                strokeWidth={8}
              />
            </div>

            <Button
              onClick={() => router.push("/")}
              size="lg"
              className="w-full"
            >
              Return to Dashboard <ArrowRight size={18} />
            </Button>
          </div>
        ) : (
          <div key={currentIdx}>
            <SpellingBee
              word={items[currentIdx].word}
              definition={items[currentIdx].definition ?? undefined}
              phonetic={items[currentIdx].phonetic ?? undefined}
              syllables={items[currentIdx].syllables ?? undefined}
              onComplete={handleComplete}
            />
          </div>
        )}
      </div>
    </main>
  );
}
