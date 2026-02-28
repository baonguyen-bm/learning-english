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
import type { Exercise, SpellingItem } from "@/types/exercises";
import { SpellingBee } from "@/components/modules/SpellingBee";
import { Dictation } from "@/components/modules/Dictation";
import { Speaking } from "@/components/modules/Speaking";
import { ListeningComprehension } from "@/components/modules/ListeningComprehension";
import { saveExerciseResult } from "@/lib/exerciseResults";
import { upsertVocabulary } from "@/lib/vocabulary";
import {
  getMissionProgress,
  setMissionProgress,
  clearMissionProgress,
  type SectionType,
  type SectionProgress,
} from "@/lib/missionProgress";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Trophy,
  BookOpen,
  PenLine,
  Headphones,
  Mic,
  CheckCircle2,
} from "lucide-react";

const SECTION_META: Record<
  SectionType,
  { label: string; icon: typeof BookOpen; color: string }
> = {
  spelling: { label: "Spelling", icon: BookOpen, color: "text-primary" },
  dictation: { label: "Dictation", icon: PenLine, color: "text-accent" },
  listening: { label: "Listening", icon: Headphones, color: "text-warning" },
  speaking: { label: "Speaking", icon: Mic, color: "text-success" },
};

const DEFAULT_SECTION_PROGRESS: Record<SectionType, SectionProgress> = {
  spelling: { currentStep: 0, scores: [], completed: false },
  dictation: { currentStep: 0, scores: [], completed: false },
  listening: { currentStep: 0, scores: [], completed: false },
  speaking: { currentStep: 0, scores: [], completed: false },
};

export default function MissionPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const missionId = params.id as string;

  const [mission, setMission] = useState<Mission | null>(null);
  const [sectionExercises, setSectionExercises] = useState<
    Record<SectionType, Exercise[]>
  >({ spelling: [], dictation: [], listening: [], speaking: [] });
  const [sectionProgress, setSectionProgress] = useState<
    Record<SectionType, SectionProgress>
  >({
    spelling: { currentStep: 0, scores: [], completed: false },
    dictation: { currentStep: 0, scores: [], completed: false },
    listening: { currentStep: 0, scores: [], completed: false },
    speaking: { currentStep: 0, scores: [], completed: false },
  });
  const [activeSection, setActiveSection] = useState<SectionType | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const getAvailableSections = useCallback((): SectionType[] => {
    return (
      ["spelling", "dictation", "listening", "speaking"] as SectionType[]
    ).filter((s) => sectionExercises[s].length > 0);
  }, [sectionExercises]);

  useEffect(() => {
    async function load() {
      const data = await getMissionById(missionId);
      if (!data) {
        router.replace("/");
        return;
      }
      setMission(data);

      const grouped: Record<SectionType, Exercise[]> = {
        spelling: data.content.spelling.map((s) => ({
          type: "spelling" as const,
          data: s,
        })),
        dictation: data.content.dictation.map((d) => ({
          type: "dictation" as const,
          data: d,
        })),
        listening: (data.content.listening || []).map((l) => ({
          type: "listening" as const,
          data: l,
        })),
        speaking: data.content.speaking.map((s) => ({
          type: "speaking" as const,
          data: s,
        })),
      };
      setSectionExercises(grouped);

      if (user) {
        const saved = getMissionProgress(user.id, missionId);
        if (saved) {
          const restoredProgress = { ...DEFAULT_SECTION_PROGRESS };
          for (const [key, sp] of Object.entries(saved.sections)) {
            if (sp && key in restoredProgress) {
              restoredProgress[key as SectionType] = sp;
            }
          }
          setSectionProgress(restoredProgress);
          setActiveSection(saved.activeSection);
        }
      }
      setLoading(false);
    }
    load();
  }, [missionId, router, user]);

  const saveMissionCompletion = useCallback(
    async (finalScore: number) => {
      if (!user) return;
      setSaving(true);
      setSaveError(null);
      try {
        const all = await getUserProgress(user.id);
        const idx = all.findIndex((p) => p.mission_id === missionId);
        const nextId =
          idx >= 0 && idx < all.length - 1
            ? all[idx + 1].mission_id
            : undefined;
        await completeMission(user.id, missionId, finalScore, nextId);
      } catch (e) {
        console.error("Failed to save progress:", e);
        setSaveError(
          "Could not save progress. Your completion may not be recorded. Please check your connection and try again."
        );
      } finally {
        setSaving(false);
      }
    },
    [user, missionId]
  );

  const advanceToNext = useCallback(
    async (score: number) => {
      if (!activeSection) return;

      const section = sectionProgress[activeSection];
      const exercises = sectionExercises[activeSection];
      const updatedScores = [...section.scores, score];
      const nextStep = section.currentStep + 1;
      const sectionDone = nextStep >= exercises.length;

      const updatedProgress = {
        ...sectionProgress,
        [activeSection]: {
          currentStep: sectionDone ? exercises.length : nextStep,
          scores: updatedScores,
          completed: sectionDone,
        },
      };
      setSectionProgress(updatedProgress);

      if (sectionDone) {
        const availableSections = getAvailableSections();
        const allDone = availableSections.every((s) =>
          s === activeSection ? true : updatedProgress[s].completed
        );

        if (allDone) {
          setShowSummary(true);
          setActiveSection(null);
          if (user) clearMissionProgress(user.id, missionId);

          const allScores = availableSections.flatMap((s) =>
            s === activeSection ? updatedScores : updatedProgress[s].scores
          );
          const avgScore = Math.round(
            allScores.reduce((a, b) => a + b, 0) / allScores.length
          );
          await saveMissionCompletion(avgScore);
        } else {
          setActiveSection(null);
          if (user) {
            setMissionProgress(user.id, missionId, {
              sections: updatedProgress,
              activeSection: null,
            });
          }
        }
      } else {
        if (user) {
          setMissionProgress(user.id, missionId, {
            sections: updatedProgress,
            activeSection,
          });
        }
      }
    },
    [
      activeSection,
      sectionProgress,
      sectionExercises,
      getAvailableSections,
      user,
      missionId,
      saveMissionCompletion,
    ]
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

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const activeSectionLabel = activeSection
    ? SECTION_META[activeSection].label
    : "";
  const activeSectionStep = activeSection
    ? sectionProgress[activeSection].currentStep + 1
    : 0;
  const activeSectionTotal = activeSection
    ? sectionExercises[activeSection].length
    : 0;
  const totalExercises = getAvailableSections().reduce(
    (sum, s) => sum + sectionExercises[s].length,
    0
  );
  const totalCompleted = getAvailableSections().reduce(
    (sum, s) => sum + sectionProgress[s].scores.length,
    0
  );
  const barPercent = showSummary
    ? 100
    : totalExercises > 0
      ? (totalCompleted / totalExercises) * 100
      : 0;

  const allScores = getAvailableSections().flatMap(
    (s) => sectionProgress[s].scores
  );
  const overallScore = avg(allScores);

  const scoreBreakdown = getAvailableSections().map((s) => ({
    label: SECTION_META[s].label,
    score: avg(sectionProgress[s].scores),
  }));

  return (
    <main className="min-h-screen bg-page">
      <header className="border-b border-rule bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-3 flex items-center gap-4">
          <button
            onClick={() => {
              if (activeSection) {
                setActiveSection(null);
                if (user) {
                  setMissionProgress(user.id, missionId, {
                    sections: sectionProgress,
                    activeSection: null,
                  });
                }
              } else {
                router.push("/");
              }
            }}
            className="text-ink-faded hover:text-ink transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-ink">
                {showSummary
                  ? "Complete!"
                  : activeSection
                    ? `${activeSectionLabel} ${activeSectionStep}/${activeSectionTotal}`
                    : mission.title}
              </span>
              <span className="text-xs text-ink-faded tabular-nums">
                {totalCompleted}/{totalExercises}
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
              <h1 className="font-display font-semibold text-3xl text-ink">
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

            {saveError && (
              <div className="p-4 rounded-lg bg-error/10 border border-error/30 space-y-2 animate-fade-in">
                <p className="text-sm text-error">{saveError}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => saveMissionCompletion(overallScore)}
                >
                  Retry saving
                </Button>
              </div>
            )}

            <Button
              onClick={() => router.push("/")}
              size="lg"
              className="w-full"
            >
              Return to Dashboard <ArrowRight size={18} />
            </Button>
          </div>
        ) : !activeSection ? (
          <div className="space-y-6 animate-scale-in">
            <div className="text-center space-y-2">
              <h1 className="font-display font-semibold text-2xl text-ink">
                {mission.title}
              </h1>
              <p className="text-sm text-ink-faded">
                Day {mission.day_number} — Choose a section to start
              </p>
            </div>

            <div className="grid gap-3">
              {getAvailableSections().map((sectionKey) => {
                const meta = SECTION_META[sectionKey];
                const progress = sectionProgress[sectionKey];
                const count = sectionExercises[sectionKey].length;
                const Icon = meta.icon;
                const avgScore = progress.scores.length
                  ? Math.round(
                      progress.scores.reduce((a, b) => a + b, 0) /
                        progress.scores.length
                    )
                  : null;

                return (
                  <button
                    key={sectionKey}
                    onClick={() => {
                      if (!progress.completed) {
                        setActiveSection(sectionKey);
                        if (user) {
                          setMissionProgress(user.id, missionId, {
                            sections: sectionProgress,
                            activeSection: sectionKey,
                          });
                        }
                      }
                    }}
                    disabled={progress.completed}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                      progress.completed
                        ? "bg-success/5 border-success/20 opacity-80"
                        : "bg-surface border-rule hover:border-primary hover:shadow-sm active:scale-[0.98]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        progress.completed ? "bg-success/10" : "bg-page"
                      )}
                    >
                      {progress.completed ? (
                        <CheckCircle2 size={24} className="text-success" />
                      ) : (
                        <Icon size={24} className={meta.color} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-medium text-ink">
                        {meta.label}
                      </p>
                      <p className="text-xs text-ink-faded">
                        {progress.completed
                          ? `Completed — ${avgScore}/100`
                          : progress.currentStep > 0
                            ? `${progress.currentStep}/${count} done`
                            : `${count} exercises`}
                      </p>
                    </div>
                    {!progress.completed && (
                      <ArrowRight size={18} className="text-ink-faded" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          (() => {
            const exercises = sectionExercises[activeSection];
            const progress = sectionProgress[activeSection];
            const current = exercises[progress.currentStep];
            if (!current) return null;

            return (
              <div key={`${activeSection}-${progress.currentStep}`}>
                {current.type === "spelling" && (
                  <SpellingBee
                    word={current.data.word}
                    definition={current.data.definition}
                    phonetic={current.data.phonetic}
                    syllables={current.data.syllables}
                    onComplete={(score) => {
                      if (user) {
                        const item = current.data as SpellingItem;
                        saveExerciseResult(
                          user.id,
                          missionId,
                          "spelling",
                          item.word,
                          score
                        ).catch(console.error);
                        upsertVocabulary(
                          user.id,
                          item.word,
                          item.definition,
                          item.phonetic,
                          item.syllables,
                          score
                        ).catch(console.error);
                      }
                      advanceToNext(score);
                    }}
                  />
                )}
                {current.type === "dictation" && (
                  <Dictation
                    sentence={current.data.text}
                    hint={current.data.hint}
                    onComplete={(score) => {
                      if (user) {
                        saveExerciseResult(
                          user.id,
                          missionId,
                          "dictation",
                          current.data.text,
                          score
                        ).catch(console.error);
                      }
                      advanceToNext(score);
                    }}
                  />
                )}
                {current.type === "listening" && (
                  <ListeningComprehension
                    item={current.data}
                    onComplete={(score, questionResults) => {
                      if (user) {
                        for (const qr of questionResults) {
                          saveExerciseResult(
                            user.id,
                            missionId,
                            "listening",
                            qr.key,
                            qr.score
                          ).catch(console.error);
                        }
                      }
                      advanceToNext(score);
                    }}
                  />
                )}
                {current.type === "speaking" && (
                  <Speaking
                    targetSentence={current.data.text}
                    onComplete={(score) => {
                      if (user) {
                        saveExerciseResult(
                          user.id,
                          missionId,
                          "speaking",
                          current.data.text,
                          score
                        ).catch(console.error);
                      }
                      advanceToNext(score);
                    }}
                  />
                )}
              </div>
            );
          })()
        )}
      </div>
    </main>
  );
}
