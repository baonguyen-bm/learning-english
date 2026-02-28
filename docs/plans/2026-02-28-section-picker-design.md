# Section Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to choose which exercise section (Spelling, Dictation, Listening, Speaking) to start first within a mission, instead of forcing a fixed linear order.

**Architecture:** Replace the single linear `currentStep` index with a section-based state model. When entering a mission, show a Section Picker screen. User selects a section, completes all exercises within it sequentially, then returns to the picker. Mission completes when all sections are done.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS.

---

## Task 1: Update `MissionProgress` for Section-Based Tracking

**Files:**
- Modify: `src/lib/missionProgress.ts`

**Step 1: Update the progress interface and persistence functions**

Replace the linear `currentStep`/`scores` with per-section tracking. Keep backward compatibility — if old format is detected, clear it (user restarts mission).

```typescript
// src/lib/missionProgress.ts

const PREFIX = "learning-english:mission-progress:";

export type SectionType = "spelling" | "dictation" | "listening" | "speaking";

export interface SectionProgress {
  currentStep: number;
  scores: number[];
  completed: boolean;
}

export interface MissionProgress {
  sections: Partial<Record<SectionType, SectionProgress>>;
  activeSection: SectionType | null;
}

export function getMissionProgress(
  userId: string,
  missionId: string
): MissionProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const key = `${PREFIX}${userId}:${missionId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Validate new format
    if (parsed?.sections && typeof parsed.sections === "object") {
      return parsed as MissionProgress;
    }
    // Old format detected — discard
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  return null;
}

export function setMissionProgress(
  userId: string,
  missionId: string,
  progress: MissionProgress
) {
  if (typeof window === "undefined") return;
  try {
    const key = `${PREFIX}${userId}:${missionId}`;
    localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function clearMissionProgress(userId: string, missionId: string) {
  if (typeof window === "undefined") return;
  try {
    const key = `${PREFIX}${userId}:${missionId}`;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/missionProgress.ts
git commit -m "refactor: update MissionProgress to section-based tracking"
```

---

## Task 2: Refactor Mission Page State Management

**Files:**
- Modify: `src/app/(protected)/mission/[id]/page.tsx`

**Step 1: Replace linear state with section-based state**

Replace `currentStep`, `scores`, `exercises` flat array with section-based model. The key state changes:

- `activeSection: SectionType | null` — null = showing picker
- `sectionExercises: Record<SectionType, Exercise[]>` — exercises grouped by type
- `sectionProgress: Record<SectionType, SectionProgress>` — per-section step/scores
- Remove: `exercises` flat array, `currentStep`, `scores`

```typescript
// At the top of MissionPage component, replace state declarations:
// Import types from missionProgress.ts (do NOT redefine them):
import {
  getMissionProgress,
  setMissionProgress,
  clearMissionProgress,
  type SectionType,
  type SectionProgress,
} from "@/lib/missionProgress";

// Old:
// const [exercises, setExercises] = useState<Exercise[]>([]);
// const [currentStep, setCurrentStep] = useState(0);
// const [scores, setScores] = useState<number[]>([]);

// New:
const DEFAULT_SECTION_PROGRESS: Record<SectionType, SectionProgress> = {
  spelling: { currentStep: 0, scores: [], completed: false },
  dictation: { currentStep: 0, scores: [], completed: false },
  listening: { currentStep: 0, scores: [], completed: false },
  speaking: { currentStep: 0, scores: [], completed: false },
};

const [sectionExercises, setSectionExercises] = useState<
  Record<SectionType, Exercise[]>
>({ spelling: [], dictation: [], listening: [], speaking: [] });

const [sectionProgress, setSectionProgress] = useState<
  Record<SectionType, SectionProgress>
>({ ...DEFAULT_SECTION_PROGRESS });

const [activeSection, setActiveSection] = useState<SectionType | null>(null);
```

**Step 2: Update the `useEffect` data loading**

```typescript
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

    // Restore saved progress (use fresh defaults, not stale state ref)
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
```

**Step 3: Update `advanceToNext` for section-based progression**

```typescript
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
      // Check if all sections are complete
      const availableSections = getAvailableSections();
      const allDone = availableSections.every(
        (s) => s === activeSection
          ? true // just completed this one
          : updatedProgress[s].completed
      );

      if (allDone) {
        // Mission complete
        setShowSummary(true);
        setActiveSection(null);
        if (user) clearMissionProgress(user.id, missionId);

        const allScores = availableSections.flatMap(
          (s) => s === activeSection ? updatedScores : updatedProgress[s].scores
        );
        const avg = Math.round(
          allScores.reduce((a, b) => a + b, 0) / allScores.length
        );
        await saveMissionCompletion(avg);
      } else {
        // Return to picker
        setActiveSection(null);
        if (user) {
          setMissionProgress(user.id, missionId, {
            sections: updatedProgress,
            activeSection: null,
          });
        }
      }
    } else {
      // Continue within section
      if (user) {
        setMissionProgress(user.id, missionId, {
          sections: updatedProgress,
          activeSection,
        });
      }
    }
  },
  [activeSection, sectionProgress, sectionExercises, user, missionId, saveMissionCompletion]
);
```

**Step 4: Add helper to get available sections (non-empty ones)**

```typescript
const getAvailableSections = useCallback((): SectionType[] => {
  return (["spelling", "dictation", "listening", "speaking"] as SectionType[])
    .filter((s) => sectionExercises[s].length > 0);
}, [sectionExercises]);
```

**Step 5: Commit**

```bash
git add src/app/\(protected\)/mission/\[id\]/page.tsx
git commit -m "refactor: mission page state to section-based model"
```

---

## Task 3: Build Section Picker UI

**Files:**
- Modify: `src/app/(protected)/mission/[id]/page.tsx`

**Step 1: Add section picker view**

Add this between the header and exercise rendering. Show when `activeSection === null && !showSummary`:

```tsx
// Section icon mapping
import { BookOpen, PenLine, Headphones, Mic } from "lucide-react";

const SECTION_META: Record<SectionType, {
  label: string;
  icon: typeof BookOpen;
  color: string;
}> = {
  spelling: { label: "Spelling", icon: BookOpen, color: "text-primary" },
  dictation: { label: "Dictation", icon: PenLine, color: "text-accent" },
  listening: { label: "Listening", icon: Headphones, color: "text-warning" },
  speaking: { label: "Speaking", icon: Mic, color: "text-success" },
};

// Inside the render, when activeSection is null and not summary:
{!activeSection && !showSummary && (
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
)}
```

**Step 2: Add `CheckCircle2` to the imports**

```typescript
import { ArrowLeft, ArrowRight, Trophy, BookOpen, PenLine, Headphones, Mic, CheckCircle2 } from "lucide-react";
```

**Step 3: Commit**

```bash
git add src/app/\(protected\)/mission/\[id\]/page.tsx
git commit -m "feat: add section picker UI for mission exercises"
```

---

## Task 4: Update Header & Exercise Rendering for Active Section

**Files:**
- Modify: `src/app/(protected)/mission/[id]/page.tsx`

**Step 1: Update header to show section context**

When in picker mode, show mission title. When in a section, show section label + progress within that section only.

```tsx
// Replace the header content computation.
// When activeSection is set:
const activeSectionLabel = activeSection ? SECTION_META[activeSection].label : "";
const activeSectionStep = activeSection
  ? sectionProgress[activeSection].currentStep + 1
  : 0;
const activeSectionTotal = activeSection
  ? sectionExercises[activeSection].length
  : 0;
const totalExercises = getAvailableSections().reduce(
  (sum, s) => sum + sectionExercises[s].length, 0
);
const totalCompleted = getAvailableSections().reduce(
  (sum, s) => sum + sectionProgress[s].scores.length, 0
);
const barPercent = showSummary
  ? 100
  : totalExercises > 0
    ? (totalCompleted / totalExercises) * 100
    : 0;
```

Update the header JSX:

```tsx
<header className="border-b border-rule bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
  <div className="max-w-2xl mx-auto px-4 md:px-8 py-3 flex items-center gap-4">
    <button
      onClick={() => {
        if (activeSection) {
          // Go back to picker (save progress)
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
```

**Step 2: Update exercise rendering to use active section**

Replace the exercise rendering block to use section-based data:

```tsx
{activeSection && !showSummary && (() => {
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
              saveExerciseResult(user.id, missionId, "spelling", item.word, score).catch(console.error);
              upsertVocabulary(user.id, item.word, item.definition, item.phonetic, item.syllables, score).catch(console.error);
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
              saveExerciseResult(user.id, missionId, "dictation", current.data.text, score).catch(console.error);
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
                saveExerciseResult(user.id, missionId, "listening", qr.key, qr.score).catch(console.error);
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
              saveExerciseResult(user.id, missionId, "speaking", current.data.text, score).catch(console.error);
            }
            advanceToNext(score);
          }}
        />
      )}
    </div>
  );
})()}
```

**Step 3: Update summary score breakdown to use section progress**

```tsx
const avg = (arr: number[]) =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

const allScores = getAvailableSections().flatMap(
  (s) => sectionProgress[s].scores
);
const overallScore = avg(allScores);

const scoreBreakdown = getAvailableSections().map((s) => ({
  label: SECTION_META[s].label,
  score: avg(sectionProgress[s].scores),
}));
```

**Step 4: Remove old linear state variables and section label computation**

Delete the old `spLen`, `diLen`, `liLen`, `sectionLabel`, `sectionStep`, `sectionTotal` computation block (lines 152-191 of original file), as these are replaced by section-based logic.

**Step 5: Commit**

```bash
git add src/app/\(protected\)/mission/\[id\]/page.tsx
git commit -m "feat: wire section picker with header and exercise rendering"
```

---

## Task 5: Manual Testing & Edge Cases

**Step 1: Test basic flow**

Run: `npm run dev`

1. Navigate to a mission
2. Verify Section Picker appears with all available sections
3. Select "Dictation" first → exercises run sequentially
4. Complete all Dictation exercises → returns to picker with tick
5. Select "Spelling" → exercises run
6. Complete all sections → Summary appears with correct scores

**Step 2: Test resume capability**

1. Start a mission, complete 1 section, start another, stop mid-way
2. Navigate away and come back
3. Verify: completed section shows tick, in-progress section resumes at correct step

**Step 3: Test back button**

1. While in a section, press back arrow → returns to picker (not dashboard)
2. While in picker, press back arrow → returns to dashboard

**Step 4: Test edge cases**

- Mission with no Listening exercises → Listening section should not appear in picker
- Complete last section → Summary auto-shows with all scores
- Refresh page mid-section → progress preserved

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: section picker for mission exercises — choose your starting section"
```
