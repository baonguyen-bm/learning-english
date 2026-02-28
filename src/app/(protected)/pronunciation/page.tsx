"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getWeakWords,
  updateWordScore,
  type PronunciationWord,
  type PronunciationFilter,
} from "@/lib/pronunciationWords";
import { WordDrill } from "@/components/modules/WordDrill";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Mic,
  Volume2,
  ChevronRight,
} from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import type { PhonemeResult } from "@/types/pronunciation";

const FILTER_TABS: { label: string; value: PronunciationFilter }[] = [
  { label: "Tất cả", value: "all" },
  { label: "Chưa đạt", value: "weak" },
  { label: "Đã cải thiện", value: "improved" },
];

function scoreBadgeColor(score: number) {
  if (score >= 75) return "bg-success/10 text-success";
  if (score >= 50) return "bg-warning/10 text-warning";
  return "bg-error/10 text-error";
}

export default function PronunciationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { speak, isSpeaking } = useTTS();

  const [allWords, setAllWords] = useState<PronunciationWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PronunciationFilter>("all");
  const [drillingWord, setDrillingWord] = useState<PronunciationWord | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const data = await getWeakWords(user!.id, "all");
        setAllWords(data);
      } catch (e) {
        console.error("Failed to load pronunciation words:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const stats = useMemo(() => {
    const total = allWords.length;
    const weak = allWords.filter((w) => w.best_score < 75).length;
    const improved = allWords.filter((w) => w.best_score >= 75).length;
    return { total, weak, improved };
  }, [allWords]);

  const words = useMemo(() => {
    if (filter === "weak") return allWords.filter((w) => w.best_score < 75);
    if (filter === "improved") return allWords.filter((w) => w.best_score >= 75);
    return allWords;
  }, [allWords, filter]);

  const handleDrillComplete = async (
    word: PronunciationWord,
    score: number,
    phonemes?: PhonemeResult[]
  ) => {
    if (!user) return;
    try {
      await updateWordScore(user.id, word.word, score, phonemes);
    } catch (e) {
      console.error("Failed to update word score:", e);
    }
    setAllWords((prev) =>
      prev.map((w) =>
        w.id === word.id
          ? {
              ...w,
              last_score: score,
              best_score: Math.max(w.best_score, score),
              times_practiced: w.times_practiced + 1,
              last_practiced_at: new Date().toISOString(),
              phonemes_json: phonemes ?? w.phonemes_json,
            }
          : w
      )
    );
    setDrillingWord(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-faded">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (drillingWord) {
    return (
      <main className="min-h-screen bg-page">
        <header className="border-b border-rule bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 md:px-8 py-3 flex items-center gap-4">
            <button
              onClick={() => setDrillingWord(null)}
              className="text-ink-faded hover:text-ink transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="font-display font-semibold text-xl text-ink">
                Luyện: {drillingWord.word}
              </h1>
              <p className="text-xs text-ink-faded">
                Điểm tốt nhất: {drillingWord.best_score}/100 · Đã luyện{" "}
                {drillingWord.times_practiced} lần
              </p>
            </div>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
          <WordDrill
            word={drillingWord.word}
            phonetic={drillingWord.phonetic ?? undefined}
            previousPhonemes={
              (drillingWord.phonemes_json as PhonemeResult[] | null) ?? undefined
            }
            onComplete={(score, phonemes) =>
              handleDrillComplete(drillingWord, score, phonemes)
            }
            onSkip={() => setDrillingWord(null)}
          />
        </div>
      </main>
    );
  }

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
            <h1 className="font-display font-semibold text-xl text-ink">
              Luyện phát âm
            </h1>
            <p className="text-xs text-ink-faded">
              {stats.total} từ · {stats.weak} cần luyện · {stats.improved} đã cải thiện
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-4 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                filter === tab.value
                  ? "bg-primary text-white"
                  : "bg-surface border border-rule text-ink-faded hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {words.length === 0 ? (
          <Card className="text-center py-8">
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-ink/5">
                <Mic size={24} className="text-ink-ghost" />
              </div>
              <p className="text-ink-faded">
                {filter === "all"
                  ? "Chưa có từ nào. Hãy hoàn thành bài Speaking trong mission để bắt đầu."
                  : filter === "weak"
                    ? "Không có từ nào cần luyện. Tốt lắm!"
                    : "Chưa có từ nào đã cải thiện."}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {words.map((entry) => (
              <Card
                key={entry.id}
                hover
                className="animate-slide-up cursor-pointer"
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full flex items-center gap-3 text-left cursor-pointer"
                  onClick={() => setDrillingWord(entry)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDrillingWord(entry); }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-ink font-medium text-lg">
                        {entry.word}
                      </span>
                      {entry.phonetic && (
                        <span className="text-xs text-primary font-mono">
                          {entry.phonetic}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-ghost mt-0.5">
                      Luyện {entry.times_practiced} lần
                      {entry.last_practiced_at &&
                        ` · ${new Date(entry.last_practiced_at).toLocaleDateString("vi-VN")}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-mono px-2 py-0.5 rounded-full",
                      scoreBadgeColor(entry.best_score)
                    )}
                  >
                    {entry.best_score}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(entry.word, 0.7);
                    }}
                    disabled={isSpeaking}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-ghost hover:text-primary transition-colors"
                  >
                    <Volume2 size={18} />
                  </button>
                  <ChevronRight size={16} className="text-ink-ghost" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
