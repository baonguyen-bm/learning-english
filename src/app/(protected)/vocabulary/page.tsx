"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTTS } from "@/hooks/useTTS";
import {
  getUserVocabulary,
  toggleStar,
  type VocabularyEntry,
  type VocabularyFilter,
  type VocabularySortBy,
} from "@/lib/vocabulary";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Star,
  Volume2,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";

const FILTER_TABS: { label: string; value: VocabularyFilter | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Needs Practice", value: "needs_practice" },
  { label: "Mastered", value: "mastered" },
  { label: "Starred", value: "starred" },
];

function scoreBadgeColor(score: number) {
  if (score >= 80) return "bg-success/10 text-success";
  if (score >= 50) return "bg-warning/10 text-warning";
  return "bg-error/10 text-error";
}

export default function VocabularyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { speak, isSpeaking } = useTTS();

  const [words, setWords] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VocabularyFilter | "all">("all");
  const [sortBy, setSortBy] = useState<VocabularySortBy>("last_practiced_at");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const data = await getUserVocabulary(
        user!.id,
        filter === "all" ? undefined : filter,
        sortBy
      );
      setWords(data);
      setLoading(false);
    }
    load();
  }, [user, filter, sortBy]);

  const filtered = useMemo(() => {
    if (!search.trim()) return words;
    const q = search.toLowerCase();
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.definition?.toLowerCase().includes(q)
    );
  }, [words, search]);

  const stats = useMemo(() => {
    const total = words.length;
    const needsPractice = words.filter((w) => w.best_score < 75).length;
    const mastered = words.filter((w) => w.best_score === 100).length;
    return { total, needsPractice, mastered };
  }, [words]);

  const handleToggleStar = async (word: string) => {
    if (!user) return;
    const newStarred = await toggleStar(user.id, word);
    setWords((prev) =>
      prev.map((w) => (w.word === word ? { ...w, starred: newStarred } : w))
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-faded">Loading vocabulary...</p>
        </div>
      </div>
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
            <h1 className="font-display font-semibold text-xl text-ink">My Vocabulary</h1>
            <p className="text-xs text-ink-faded">
              {stats.total} words · {stats.needsPractice} to practice ·{" "}
              {stats.mastered} mastered
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-4 space-y-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-ghost"
          />
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
            placeholder="Search words..."
            className="pl-9"
          />
        </div>

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
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setSortBy("word")}
              className={cn(
                "px-2 py-1 rounded text-xs transition-colors",
                sortBy === "word"
                  ? "bg-primary/10 text-primary"
                  : "text-ink-ghost hover:text-ink-faded"
              )}
            >
              A-Z
            </button>
            <button
              onClick={() => setSortBy("last_practiced_at")}
              className={cn(
                "px-2 py-1 rounded text-xs transition-colors",
                sortBy === "last_practiced_at"
                  ? "bg-primary/10 text-primary"
                  : "text-ink-ghost hover:text-ink-faded"
              )}
            >
              Recent
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-ink-faded">
              {words.length === 0
                ? "No vocabulary yet. Complete spelling exercises to collect words!"
                : "No words match your search."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => {
              const isExpanded = expanded === entry.word;
              return (
                <Card
                  key={entry.id}
                  className="animate-slide-up"
                  hover
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() =>
                      setExpanded(isExpanded ? null : entry.word)
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-ink font-medium">
                        {entry.word}
                      </span>
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
                        handleToggleStar(entry.word);
                      }}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <Star
                        size={18}
                        className={cn(
                          "transition-colors",
                          entry.starred
                            ? "fill-accent text-accent"
                            : "text-ink-ghost"
                        )}
                      />
                    </button>
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-ink-ghost" />
                    ) : (
                      <ChevronDown size={16} className="text-ink-ghost" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-rule space-y-2 animate-fade-in">
                      {entry.definition && (
                        <p className="text-sm text-ink-faded italic">
                          {entry.definition}
                        </p>
                      )}
                      {entry.phonetic && (
                        <p className="text-sm text-primary">
                          {entry.phonetic}
                        </p>
                      )}
                      {entry.syllables && (
                        <p className="text-sm text-ink-faded">
                          Syllables: {entry.syllables}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-ink-ghost">
                        <span>Practiced {entry.times_practiced}x</span>
                        <span>Best: {entry.best_score}</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => speak(entry.word)}
                        disabled={isSpeaking}
                      >
                        <Volume2 size={14} />
                        Hear it
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
