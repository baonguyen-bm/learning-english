"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserProgress,
  ensureProgressInitialized,
  calculateStreak,
  getUserDifficulty,
  switchDifficulty,
  getDifficultySuggestion,
  type UserProgress,
  type DifficultySuggestion,
} from "@/lib/progress";
import { getDueReviewCount } from "@/lib/srs";
import { getWeakWordCount } from "@/lib/pronunciationWords";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { cn } from "@/lib/utils";
import {
  Flame,
  LogOut,
  ArrowRight,
  BookOpen,
  RotateCcw,
  Sparkles,
  TrendingDown,
  X,
  Settings,
  Mic,
} from "lucide-react";

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Intermediate",
  3: "Advanced",
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [difficulty, setDifficulty] = useState(2);
  const [suggestion, setSuggestion] = useState<DifficultySuggestion | null>(
    null
  );
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [pronCount, setPronCount] = useState(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    async function loadData() {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setError(null);
      try {
        const userDiff = await getUserDifficulty(user!.id);
        setDifficulty(userDiff);

        await ensureProgressInitialized(user!.id, userDiff);
        const [progressData, streakData] = await Promise.all([
          getUserProgress(user!.id, userDiff),
          calculateStreak(user!.id),
        ]);

        setProgress(progressData);
        setStreak(streakData);
      } catch (e) {
        setError("Failed to load missions. Please refresh the page.");
        console.error(e);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }

      try {
        const [reviewData, suggestionData, pronData] = await Promise.all([
          getDueReviewCount(user!.id),
          getDifficultySuggestion(user!.id),
          getWeakWordCount(user!.id),
        ]);
        setReviewCount(reviewData);
        setSuggestion(suggestionData);
        setPronCount(pronData);

        const dismissed = sessionStorage.getItem("suggestion_dismissed");
        if (dismissed === "true") setSuggestionDismissed(true);
      } catch (e) {
        console.error("Failed to load secondary data:", e);
      }
    }

    loadData();

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && user && !loadingRef.current)
        loadData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [user]);

  const todaysMission = progress.find((p) => p.status === "open");
  const totalPoints = progress
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.score, 0);

  const handleAcceptSuggestion = async () => {
    if (!user || !suggestion) return;
    const confirmed = window.confirm(
      "This will reset your mission progress and streak. Continue?"
    );
    if (!confirmed) return;

    setSwitching(true);
    try {
      await switchDifficulty(user.id, suggestion.suggested);
      window.location.reload();
    } catch (e) {
      console.error("Failed to switch difficulty:", e);
      setSwitching(false);
    }
  };

  const handleDismissSuggestion = () => {
    setSuggestionDismissed(true);
    sessionStorage.setItem("suggestion_dismissed", "true");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-faded">Loading missions...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-page">
      <header className="border-b border-rule bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-semibold text-xl text-ink">
              English Daily Practice
            </h1>
            <p className="text-sm text-ink-faded">
              {user?.user_metadata?.full_name || user?.email || "Welcome"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {DIFFICULTY_LABELS[difficulty] || "Intermediate"}
            </span>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 text-accent font-display text-lg">
                <Flame size={20} />
                {streak}
              </div>
            )}
            <span className="text-sm text-ink-ghost tabular-nums">
              {totalPoints} pts
            </span>
            <Link
              href="/settings"
              className="p-2 rounded-lg text-ink-ghost hover:text-ink hover:bg-page transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 space-y-8">
        {error && (
          <p className="text-sm text-error animate-fade-in">{error}</p>
        )}

        {todaysMission && (
          <section className="animate-slide-up">
            <Card className="border-primary/20 bg-primary/[0.03] relative overflow-hidden">
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                Today&apos;s Mission
              </p>
              <h2 className="font-display font-semibold text-2xl md:text-3xl text-ink mb-1">
                Day {todaysMission.missions.day_number}:{" "}
                {todaysMission.missions.title}
              </h2>
              <p className="text-ink-faded text-sm mb-5">
                {todaysMission.missions.description}
              </p>
              <Link href={`/mission/${todaysMission.mission_id}`}>
                <Button size="lg">
                  Start Mission <ArrowRight size={18} />
                </Button>
              </Link>
            </Card>
          </section>
        )}

        {!todaysMission && progress.length > 0 && (
          <section className="animate-slide-up">
            <Card className="text-center py-8">
              <p className="font-display font-semibold text-2xl text-ink mb-2">
                All missions complete!
              </p>
              <p className="text-ink-faded">
                You can revisit any mission to improve your score.
              </p>
            </Card>
          </section>
        )}

        {reviewCount > 0 && (
          <section className="animate-slide-up">
            <Card className="border-accent/20 bg-accent/[0.03]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <RotateCcw size={20} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink">
                    {reviewCount} word{reviewCount !== 1 ? "s" : ""} to review
                  </p>
                  <p className="text-xs text-ink-faded">
                    Spaced repetition keeps words fresh
                  </p>
                </div>
                <Link href="/review">
                  <Button size="sm">
                    Review <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </Card>
          </section>
        )}

        {suggestion && !suggestionDismissed && (
          <section className="animate-slide-up">
            <Card
              className={cn(
                "relative",
                suggestion.type === "suggest_harder"
                  ? "border-success/20 bg-success/[0.03]"
                  : "border-warning/20 bg-warning/[0.03]"
              )}
            >
              <button
                onClick={handleDismissSuggestion}
                className="absolute top-3 right-3 text-ink-ghost hover:text-ink-faded min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X size={16} />
              </button>
              <div className="flex items-start gap-3 pr-8">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    suggestion.type === "suggest_harder"
                      ? "bg-success/10"
                      : "bg-warning/10"
                  )}
                >
                  {suggestion.type === "suggest_harder" ? (
                    <Sparkles size={20} className="text-success" />
                  ) : (
                    <TrendingDown size={20} className="text-warning" />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-ink text-sm">
                    {suggestion.type === "suggest_harder"
                      ? "You're doing great! Ready for harder missions?"
                      : "Want to try easier missions to build confidence?"}
                  </p>
                  <p className="text-xs text-ink-faded">
                    Switch to{" "}
                    {DIFFICULTY_LABELS[suggestion.suggested] || "Intermediate"}{" "}
                    difficulty
                  </p>
                  <Button
                    size="sm"
                    onClick={handleAcceptSuggestion}
                    disabled={switching}
                  >
                    {switching ? "Switching..." : "Switch Level"}
                  </Button>
                </div>
              </div>
            </Card>
          </section>
        )}

        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-slide-up">
          <Link href="/vocabulary">
            <Card hover className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-medium text-ink text-sm">Vocabulary</p>
                <p className="text-xs text-ink-faded">Your word collection</p>
              </div>
            </Card>
          </Link>
          <Link href="/review">
            <Card hover className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <RotateCcw size={20} className="text-accent" />
              </div>
              <div>
                <p className="font-medium text-ink text-sm">Review</p>
                <p className="text-xs text-ink-faded">Practice weak words</p>
              </div>
            </Card>
          </Link>
          <Link href="/pronunciation">
            <Card hover className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                <Mic size={20} className="text-success" />
              </div>
              <div>
                <p className="font-medium text-ink text-sm">Phát âm</p>
                <p className="text-xs text-ink-faded">
                  {pronCount > 0 ? `${pronCount} từ cần luyện` : "Luyện phát âm"}
                </p>
              </div>
            </Card>
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium text-ink-faded uppercase tracking-wider">
            All Missions
          </h2>
          <div className="space-y-2">
            {progress.map((p, i) => (
              <MissionRow key={p.id} progress={p} index={i} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function MissionRow({
  progress: p,
  index,
}: {
  progress: UserProgress;
  index: number;
}) {
  const isPlayable = p.status === "open" || p.status === "completed";

  const inner = (
    <Card
      hover={isPlayable}
      className={cn(
        "flex items-center gap-4 animate-slide-up",
        !isPlayable && "opacity-50"
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {p.status === "completed" ? (
        <ProgressRing
          progress={p.score}
          size={48}
          strokeWidth={4}
          animated={false}
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-page border border-rule flex items-center justify-center shrink-0">
          <BookOpen size={20} className="text-ink-ghost" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink truncate">
          Day {p.missions.day_number}: {p.missions.title}
        </p>
        <p className="text-sm text-ink-faded truncate">
          {p.missions.description}
        </p>
      </div>
      <Badge status={p.status} />
    </Card>
  );

  if (isPlayable) {
    return <Link href={`/mission/${p.mission_id}`}>{inner}</Link>;
  }
  return inner;
}
