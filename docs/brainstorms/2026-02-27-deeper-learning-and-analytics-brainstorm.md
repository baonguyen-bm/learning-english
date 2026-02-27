---
date: 2026-02-27
topic: deeper-learning-and-analytics
---

# Deeper Learning & Analytics

## What We're Building

Four interconnected features that create a **learning loop**: the app tracks per-item results from every exercise, feeds weak vocabulary into a spaced repetition review system, builds a personal vocabulary notebook, adjusts difficulty based on performance, and adds a new listening comprehension exercise type.

These features turn the app from a linear "do missions in order" experience into an adaptive, personalized learning platform.

## Why These Features

The current app has solid exercise mechanics (spelling, dictation, speaking) but lacks:
- **Retention mechanisms** — users practice once and move on, with no review of weak areas
- **Visibility into progress** — only a per-mission score, no insight into which words or skills need work
- **Variety** — three exercise types can feel repetitive over 7+ days
- **Adaptation** — all users get the same content regardless of skill level

## Foundation: Per-Item Result Tracking

All four features depend on recording what the user got right/wrong at the individual word and sentence level. Currently, the app only stores a single `score` per mission in `user_progress`.

### New Database Tables

```sql
-- Per-item results: keeps full history (multiple rows per item allowed)
-- Used for analytics, improvement tracking, and feeding adaptive difficulty
create table public.exercise_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  mission_id uuid references public.missions not null,
  exercise_type text check (exercise_type in ('spelling', 'dictation', 'speaking', 'listening')),
  item_key text not null,
  score int not null,
  attempted_at timestamp with time zone default now()
);

-- item_key values by exercise type:
--   spelling:  the word itself, e.g. "milestone"
--   dictation: the full target sentence
--   speaking:  the full target sentence
--   listening: "dialog-title:q0", "dialog-title:q1", etc.

-- Indexes for common query patterns
create index idx_exercise_results_user on public.exercise_results (user_id, attempted_at desc);
create index idx_exercise_results_user_type on public.exercise_results (user_id, exercise_type);

-- Vocabulary notebook + SRS scheduling (words only)
create table public.vocabulary (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  word text not null,
  definition text,
  phonetic text,
  syllables text,
  times_practiced int default 0,
  best_score int default 0,
  starred boolean default false,
  next_review_at timestamp with time zone,
  srs_interval int default 1,
  unique(user_id, word)
);

create index idx_vocabulary_review on public.vocabulary (user_id, next_review_at);
```

### History Strategy

`exercise_results` keeps all attempts (no upsert). This enables:
- "How did I improve on this word over time?" analytics
- Adaptive difficulty calculations from recent attempts

When SRS or other features need the "latest result for item X," they query with `ORDER BY attempted_at DESC LIMIT 1`.

On the Supabase free tier (500MB), this is acceptable for individual learners. If storage becomes a concern, old results (> 90 days) can be pruned.

### Schema Changes to Existing Tables

```sql
-- Add difficulty preference to profiles
alter table public.profiles add column difficulty_preference int default 2;

-- Add difficulty to missions, change uniqueness
alter table public.missions drop constraint missions_day_number_key;
alter table public.missions add column difficulty int default 2;
alter table public.missions add constraint missions_day_difficulty_unique unique (day_number, difficulty);
```

RLS policies for new tables follow the same pattern: users can only read/write their own rows.

## Feature B1: Spaced Repetition Review Mode

### Scope: Words Only

SRS tracks **vocabulary words** only (from spelling exercises). Dictation, speaking, and listening results are stored in `exercise_results` for analytics but do not feed into SRS review. Rationale: words are self-contained review units; sentences and dialog questions require contextual replay that doesn't suit isolated review.

### Approach: Standalone Review Page

A dedicated `/review` page accessible from the dashboard. When items are due for review, a "Review" card appears on the dashboard (similar to "Today's Mission").

Rejected alternative: injecting review items into daily missions. This would make missions feel inconsistent and is harder to implement. Standalone keeps concerns separated.

### SRS Algorithm (Simplified SM-2)

Interval mechanics (applied during review sessions):
- On success (score >= 75): interval doubles (1 → 2 → 4 → 8 → 16 days)
- On partial success (score 50-74): interval stays the same
- On failure (score < 50): interval resets to 1
- `next_review_at = now() + srs_interval days`

### Entry Criteria

Words enter the SRS queue when:
- Spelling score < 75 on any attempt (auto-enrolled with `srs_interval = 1`)
- User stars a word in the vocabulary notebook (B4)

### Review Session Flow

1. Dashboard shows "X items to review" card (query: `SELECT count(*) FROM vocabulary WHERE user_id = ? AND next_review_at <= now()`)
2. User taps → enters review session (spelling exercise format)
3. Each word is presented as a spelling exercise (hear word → type it)
4. After each answer, SRS interval updates on the `vocabulary` row
5. Session ends when all due items are reviewed (max 15 per session)

### Availability

The review page is accessible at any time, but only populates after the user has completed at least one mission. If no items are due, it shows an encouraging empty state ("Nothing to review — great work!").

### Data Access for Review

Review items come from the `vocabulary` table, which stores all metadata (word, definition, phonetic, syllables). No JOIN with `exercise_results` needed — the vocabulary row has everything the spelling exercise component requires.

## Feature B2: Listening Comprehension

### Exercise Design

A multi-sentence workplace dialog played via TTS, followed by 2-3 multiple-choice comprehension questions.

### Content Structure (extends mission JSON)

```json
"listening": [
  {
    "title": "Project Timeline Discussion",
    "dialog": [
      { "speaker": "Manager", "text": "The client wants the feature by Friday." },
      { "speaker": "Developer", "text": "That timeline is tight. Can we negotiate?" },
      { "speaker": "Manager", "text": "I will check with the client and get back to you." }
    ],
    "questions": [
      {
        "question": "What does the client want?",
        "options": ["A bug fix by Monday", "A new feature by Friday", "A meeting this week"],
        "correct": 1
      },
      {
        "question": "How does the developer feel about the timeline?",
        "options": ["Confident", "Concerned it is too tight", "Indifferent"],
        "correct": 1
      }
    ]
  }
]
```

### TypeScript Interface

The `Mission.content` type adds `listening` as optional (existing missions without listening content still type-check):

```typescript
content: {
  spelling: SpellingItem[];
  dictation: DictationItem[];
  speaking: SpeakingItem[];
  listening?: ListeningItem[];
};
```

### Mission Runner Refactor

The current `Exercise` interface uses `Record<string, string>` which cannot hold nested listening data. Refactor to a discriminated union:

```typescript
type Exercise =
  | { type: "spelling"; data: SpellingItem }
  | { type: "dictation"; data: DictationItem }
  | { type: "speaking"; data: SpeakingItem }
  | { type: "listening"; data: ListeningItem };
```

This is a prerequisite refactor that also fixes the existing `as Exercise` type casts.

### Integration into Mission Runner

Listening comprehension slots in as the 4th exercise phase: Spelling → Dictation → Listening → Speaking. If `content.listening` is absent or empty, the phase is skipped — the mission runner gracefully handles this.

### Scoring

Each question is worth equal points. Correct = 100, wrong = 0. The listening exercise score is the average across questions.

### Result Tracking

One `exercise_results` row per question (not per dialog). The `item_key` encodes both dialog and question index — e.g., `"project-timeline-discussion:q0"`, `"project-timeline-discussion:q1"`. Listening results are tracked for analytics but do not feed into SRS (dialog questions require full context to review).

### Multi-Speaker TTS

Use distinct voices from `speechSynthesis.getVoices()` if multiple en-US voices are available. If only one voice is available, fall back to visual speaker indicators (name label displayed before each line + brief pause between speakers).

### UI Components

- `ListeningComprehension.tsx` — plays dialog line by line via TTS with speaker labels, then shows questions one at a time as multiple-choice cards
- Replay button to hear the dialog again (with optional slow replay at 0.6x)
- No time limit

## Feature B3: Adaptive Difficulty

### Approach: Data-Driven Learning Path

Missions are tagged with a difficulty level (1 = beginner, 2 = intermediate, 3 = advanced). The system uses the user's exercise history to suggest appropriate difficulty, and switching difficulty resets progression to build a fresh learning plan at the new level.

Rejected alternative: per-item dynamic mixing. More complex to implement, requires a large tagged content pool. Per-mission levels are appropriate for the current scale, with room to evolve toward dynamic content selection later.

### How Difficulty Adjusts

- Track user's rolling average score across last 3 completed missions (query: latest 3 rows from `user_progress` with `status = 'completed'`, ordered by `completed_at desc`)
- If average >= 85: a banner card appears on the dashboard — "You're doing great! Try harder missions?" with Accept/Dismiss buttons. On accept, the user's `difficulty_preference` updates in `profiles` and progression resets.
- If average <= 50: a similar suggestion card — "Want to try easier missions to build confidence?" Same Accept/Dismiss flow.
- Display current difficulty level on dashboard header ("Level: Intermediate")

### Switching Difficulty

When a user switches difficulty:
1. Update `profiles.difficulty_preference` to the new level
2. Delete existing `user_progress` rows for the user (clean slate)
3. Re-run `ensureProgressInitialized` which creates fresh progress rows filtered to missions matching the new difficulty
4. User starts from Day 1 at the new level
5. Exercise history in `exercise_results` and vocabulary in `vocabulary` are preserved — only mission progression resets

### Progress Initialization (Difficulty-Aware)

`ensureProgressInitialized` must filter missions by the user's `difficulty_preference`:

```typescript
const { data: missions } = await supabase
  .from("missions")
  .select("id, day_number")
  .eq("difficulty", userDifficultyPreference)
  .order("day_number", { ascending: true });
```

The dashboard query (`getUserProgress`) also filters by difficulty via the JOIN.

### Seed Script Update

The seed script must change `onConflict` to `"day_number,difficulty"` and mission JSON objects need a `difficulty` field. Existing 7 missions default to `difficulty: 2`.

### Content Implications

- Existing 7 missions become "Intermediate" (level 2)
- Create 10 Beginner (level 1) and 10 Advanced (level 3) missions initially
- Beginner: shorter sentences, common words, slower TTS rate (0.8x)
- Advanced: longer sentences, professional jargon, normal TTS rate (1.0x)

## Feature B4: Vocabulary Notebook

### Dedicated Page: `/vocabulary`

A personal dictionary page showing every word the user has encountered in spelling exercises, automatically collected.

### Features

- **Browse**: All words listed alphabetically or by recency
- **Filter**: "Needs Practice" (best score < 75) | "Mastered" (score = 100) | "Starred"
- **Word Card**: Tap to expand — shows definition, phonetic, syllables, play pronunciation button, practice count, best score
- **Star**: Mark words for focused review (enrolls in SRS via B1)
- **Search**: Filter words by typing

### Data Collection

Words are auto-collected during spelling exercises. The mission runner's `handleComplete` callback is extended to pass item metadata alongside the score:

```typescript
onExerciseComplete: (score: number, itemData: { type: string; key: string; metadata?: object }) => void
```

For spelling exercises, `metadata` carries `{ word, definition, phonetic, syllables }`. The mission runner calls a `upsertVocabulary` function that:
1. Upserts into `vocabulary` (insert or update on conflict `(user_id, word)`)
2. Increments `times_practiced`
3. Updates `best_score` if the new score is higher
4. If score < 75, sets `next_review_at` to tomorrow and `srs_interval` to 1 (auto-enroll in SRS)

## Key Decisions

- **Remove dev mode** — eliminates localStorage duplication across all data functions. Local development uses Supabase free tier directly.
- **SRS covers words only** — dictation/speaking/listening results tracked for analytics but not reviewed. Words are self-contained units suited to isolated review.
- **Keep full exercise history** — `exercise_results` allows multiple rows per item for analytics. Latest result queried with `ORDER BY attempted_at DESC LIMIT 1`.
- **Difficulty switch resets progression** — user starts from Day 1 at new level. Exercise history and vocabulary are preserved.
- **Standalone review page** over injected-into-missions: simpler, cleaner separation of concerns
- **Per-mission difficulty** over per-item: appropriate for current content scale (7 missions)
- **Multiple-choice for listening** over free-text answers: easier to grade, lower friction, tests comprehension not production
- **Auto-collect vocabulary** over manual-only: reduces friction, ensures the notebook is populated
- **Composite unique `(day_number, difficulty)`** over single `day_number` unique: allows multiple difficulty variants per day
- **One `exercise_results` row per question** for listening (not per dialog): enables granular tracking
- **Discriminated union for Exercise type** — replaces `Record<string, string>` to properly type all exercise variants including listening

## Simplification: Remove Dev Mode

The existing codebase has a `DEV_MODE` flag that duplicates every data function with a localStorage fallback. This doubles implementation effort for every new feature and will not scale with four new data-intensive features.

**Decision: Remove dev mode entirely.** All data operations go through Supabase only.

### What to remove (existing code)
- `NEXT_PUBLIC_DEV_MODE` env variable and all `DEV_MODE` checks in `progress.ts`
- localStorage helpers (`readDevProgress`, `writeDevProgress`, `getDevMissions`, `STORAGE_KEY`)
- Dev-mode branches in: `getMissions`, `getMissionById`, `ensureProgressInitialized`, `getUserProgress`, `completeMission`, `calculateStreak`
- Mock user logic in `AuthContext.tsx`

### For local development
Developers connect to a Supabase project (free tier). The seed script (`npm run seed`) populates missions. This is already the production path — dev mode was a convenience shortcut that has become a maintenance burden.

## Resolved Questions

- **How many missions per difficulty level?** 10 each for beginner and advanced (existing 7 intermediate missions will also expand to 10). Total: 30 missions across 3 levels.

## Next Steps

→ Create implementation plan with task breakdown, file changes, and build order
