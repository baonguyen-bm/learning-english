"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMissionById,
  getUserProgress,
  completeMission,
  type Mission,
} from "@/lib/progress";
import type { Exercise } from "@/types/exercises";
import { SpellingBee } from "@/components/modules/SpellingBee";
import { Dictation } from "@/components/modules/Dictation";
import { Speaking } from "@/components/modules/Speaking";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, ArrowRight, Trophy } from "lucide-react";

export default function MissionPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const missionId = params.id as string;

  const [mission, setMission] = useState<Mission | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getMissionById(missionId);
      if (!data) {
        router.replace("/");
        return;
      }
      setMission(data);
      setExercises([
        ...data.content.spelling.map((s) => ({
          type: "spelling" as const,
          data: s,
        })),
        ...data.content.dictation.map((d) => ({
          type: "dictation" as const,
          data: d,
        })),
        ...(data.content.listening || []).map((l) => ({
          type: "listening" as const,
          data: l,
        })),
        ...data.content.speaking.map((s) => ({
          type: "speaking" as const,
          data: s,
        })),
      ]);
      setLoading(false);
    }
    load();
  }, [missionId, router]);

  const handleComplete = useCallback(
    async (score: number) => {
      const updated = [...scores, score];
      setScores(updated);

      if (currentStep + 1 < exercises.length) {
        setCurrentStep((s) => s + 1);
      } else {
        setShowSummary(true);

        const avg = Math.round(
          updated.reduce((a, b) => a + b, 0) / updated.length
        );

        if (user) {
          setSaving(true);
          try {
            const all = await getUserProgress(user.id);
            const idx = all.findIndex((p) => p.mission_id === missionId);
            const nextId =
              idx >= 0 && idx < all.length - 1
                ? all[idx + 1].mission_id
                : undefined;
            await completeMission(user.id, missionId, avg, nextId);
          } catch (e) {
            console.error("Failed to save progress:", e);
          } finally {
            setSaving(false);
          }
        }
      }
    },
    [scores, currentStep, exercises.length, user, missionId]
  );

  if (loading || !mission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-faded">Loading mission...</p>
        </div>
      </div>
    );
  }

  const spLen = mission.content.spelling.length;
  const diLen = mission.content.dictation.length;
  const liLen = (mission.content.listening || []).length;

  let sectionLabel = "";
  let sectionStep = 0;
  let sectionTotal = 0;

  if (!showSummary) {
    if (currentStep < spLen) {
      sectionLabel = "Spelling";
      sectionStep = currentStep + 1;
      sectionTotal = spLen;
    } else if (currentStep < spLen + diLen) {
      sectionLabel = "Dictation";
      sectionStep = currentStep - spLen + 1;
      sectionTotal = diLen;
    } else if (currentStep < spLen + diLen + liLen) {
      sectionLabel = "Listening";
      sectionStep = currentStep - spLen - diLen + 1;
      sectionTotal = liLen;
    } else {
      sectionLabel = "Speaking";
      sectionStep = currentStep - spLen - diLen - liLen + 1;
      sectionTotal = mission.content.speaking.length;
    }
  }

  const barPercent = showSummary
    ? 100
    : (currentStep / exercises.length) * 100;

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const spellingScores = scores.slice(0, spLen);
  const dictationScores = scores.slice(spLen, spLen + diLen);
  const listeningScores = scores.slice(spLen + diLen, spLen + diLen + liLen);
  const speakingScores = scores.slice(spLen + diLen + liLen);
  const overallScore = avg(scores);

  const scoreBreakdown = [
    { label: "Spelling", score: avg(spellingScores) },
    { label: "Dictation", score: avg(dictationScores) },
    ...(liLen > 0
      ? [{ label: "Listening", score: avg(listeningScores) }]
      : []),
    { label: "Speaking", score: avg(speakingScores) },
  ];

  const current = exercises[currentStep];

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
                  ? "Complete!"
                  : `${sectionLabel} ${sectionStep}/${sectionTotal}`}
              </span>
              <span className="text-xs text-ink-faded tabular-nums">
                {Math.min(currentStep + 1, exercises.length)}/
                {exercises.length}
              </span>
            </div>
            <div className="h-1.5 bg-rule rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${barPercent}%` }}
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
                <Trophy size={36} />
              </div>
              <h1 className="font-display text-3xl text-ink">
                Mission Complete!
              </h1>
              <p className="text-ink-faded">
                Day {mission.day_number}: {mission.title}
              </p>
            </div>

            <div className="flex justify-center py-2">
              <ProgressRing
                progress={overallScore}
                size={120}
                strokeWidth={8}
              />
            </div>

            <Card className="space-y-4">
              <h2 className="text-xs font-medium text-ink-faded uppercase tracking-wider">
                Score Breakdown
              </h2>
              {scoreBreakdown.map(({ label, score }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm text-ink-faded w-20">{label}</span>
                  <div className="flex-1 h-2 bg-rule rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${score}%`,
                        backgroundColor:
                          score >= 80
                            ? "var(--success)"
                            : score >= 50
                              ? "var(--warning)"
                              : "var(--error)",
                      }}
                    />
                  </div>
                  <span className="text-sm font-mono text-ink w-12 text-right tabular-nums">
                    {score}
                  </span>
                </div>
              ))}
            </Card>

            {saving && (
              <p className="text-sm text-ink-faded text-center animate-fade-in">
                Saving progress...
              </p>
            )}

            <Button
              onClick={() => router.push("/")}
              size="lg"
              className="w-full"
            >
              Return to Dashboard <ArrowRight size={18} />
            </Button>
          </div>
        ) : (
          <div key={currentStep}>
            {current.type === "spelling" && (
              <SpellingBee
                word={current.data.word}
                definition={current.data.definition}
                phonetic={current.data.phonetic}
                syllables={current.data.syllables}
                onComplete={handleComplete}
              />
            )}
            {current.type === "dictation" && (
              <Dictation
                sentence={current.data.text}
                hint={current.data.hint}
                onComplete={handleComplete}
              />
            )}
            {current.type === "speaking" && (
              <Speaking
                targetSentence={current.data.text}
                onComplete={handleComplete}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
