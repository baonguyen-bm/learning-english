"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserProgress,
  ensureProgressInitialized,
  calculateStreak,
  type UserProgress,
} from "@/lib/progress";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { cn } from "@/lib/utils";
import { Flame, LogOut, ArrowRight, BookOpen } from "lucide-react";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function loadData() {
      try {
        await ensureProgressInitialized(user!.id);
        const [progressData, streakData] = await Promise.all([
          getUserProgress(user!.id),
          calculateStreak(user!.id),
        ]);
        setProgress(progressData);
        setStreak(streakData);
      } catch (e) {
        setError("Failed to load missions. Please refresh the page.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  const todaysMission = progress.find((p) => p.status === "open");
  const totalPoints = progress
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.score, 0);

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
            <h1 className="font-display text-xl text-ink">
              English Daily Practice
            </h1>
            <p className="text-sm text-ink-faded">
              {user?.user_metadata?.full_name || user?.email || "Welcome"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 text-accent font-display text-lg">
                <Flame size={20} />
                {streak}
              </div>
            )}
            <span className="text-sm text-ink-ghost tabular-nums">
              {totalPoints} pts
            </span>
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
              <h2 className="font-display text-2xl md:text-3xl text-ink mb-1">
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
              <p className="font-display text-2xl text-ink mb-2">
                All missions complete!
              </p>
              <p className="text-ink-faded">
                You can revisit any mission to improve your score.
              </p>
            </Card>
          </section>
        )}

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
