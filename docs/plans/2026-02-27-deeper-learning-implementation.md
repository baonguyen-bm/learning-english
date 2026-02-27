# Deeper Learning & Analytics — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add spaced repetition, listening comprehension, adaptive difficulty, and vocabulary notebook to the existing English learning PWA.

**Brainstorm:** `docs/brainstorms/2026-02-27-deeper-learning-and-analytics-brainstorm.md`

**Key constraints:**
- Zero-cost runtime (no paid APIs). All content pre-generated.
- Supabase free tier. Browser TTS/STT only.
- Dev mode is being removed — all data through Supabase.

---

## Phase 1: Foundation

### Task 0: Remove Dev Mode & Initialize Git

**Files:**
- Modify: `src/lib/progress.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `.env.local` (remove `NEXT_PUBLIC_DEV_MODE`)

**Why:** Dev mode doubles every data function with localStorage branches. Removing it first prevents writing new code that would also need dual paths.

**Step 1: Initialize git repo**
Run `git init && git add -A && git commit -m "chore: initial commit before deeper learning features"`

**Step 2: Clean `AuthContext.tsx`**
Remove `DEV_MODE` constant, `MOCK_USER` object, and all `if (DEV_MODE)` branches in `signIn`, `signUp`, `signOut`, and the `useEffect`. The provider becomes Supabase-only:
- `useState<User | null>(null)` (not conditional)
- `useState(true)` for loading (not conditional)
- `useEffect` always runs Supabase session check

**Step 3: Clean `progress.ts`**
Remove:
- `DEV_MODE` constant
- `import missionsJson` from data/missions.json
- `STORAGE_KEY` constant
- `getDevMissions()`, `readDevProgress()`, `writeDevProgress()` functions
- All `if (DEV_MODE)` branches in every exported function

Each function keeps only its Supabase implementation.

**Step 4: Clean `.env.local`**
Remove the `NEXT_PUBLIC_DEV_MODE=true` line. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

**Step 5: Verify build**
Run `npm run build` to confirm no broken imports or references to removed code.

**Step 6: Commit**
`git add -A && git commit -m "refactor: remove dev mode, all data through Supabase"`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260227_deeper_learning.sql`

**Why:** All subsequent tasks depend on the new tables and schema changes.

**Step 1: Write migration SQL**

```sql
-- 1. New tables

create table public.exercise_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  mission_id uuid references public.missions,  -- nullable for review sessions
  exercise_type text check (exercise_type in ('spelling', 'dictation', 'speaking', 'listening')),
  item_key text not null,
  score int not null,
  attempted_at timestamp with time zone default now()
);

create index idx_exercise_results_user on public.exercise_results (user_id, attempted_at desc);
create index idx_exercise_results_user_type on public.exercise_results (user_id, exercise_type);

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
  created_at timestamp with time zone default now(),
  last_practiced_at timestamp with time zone default now(),
  unique(user_id, word)
);

create index idx_vocabulary_review on public.vocabulary (user_id, next_review_at);

-- 2. Schema changes to existing tables

alter table public.profiles add column difficulty_preference int default 2;

alter table public.missions drop constraint missions_day_number_key;
alter table public.missions add column difficulty int default 2;
alter table public.missions add constraint missions_day_difficulty_unique unique (day_number, difficulty);

-- 3. RLS policies for new tables

alter table public.exercise_results enable row level security;
alter table public.vocabulary enable row level security;

create policy "Users can view their own exercise results."
  on public.exercise_results for select using (auth.uid() = user_id);
create policy "Users can insert their own exercise results."
  on public.exercise_results for insert with check (auth.uid() = user_id);

create policy "Users can view their own vocabulary."
  on public.vocabulary for select using (auth.uid() = user_id);
create policy "Users can insert their own vocabulary."
  on public.vocabulary for insert with check (auth.uid() = user_id);
create policy "Users can update their own vocabulary."
  on public.vocabulary for update using (auth.uid() = user_id);

-- 4. Missing DELETE policy for user_progress (needed by switchDifficulty)

create policy "Users can delete their own progress."
  on public.user_progress for delete using (auth.uid() = user_id);

-- 5. Vocabulary upsert function (atomic increment + conditional update)

create or replace function public.upsert_vocabulary(
  p_user_id uuid,
  p_word text,
  p_definition text,
  p_phonetic text,
  p_syllables text,
  p_score int
) returns void as $$
begin
  insert into public.vocabulary (user_id, word, definition, phonetic, syllables, times_practiced, best_score, last_practiced_at, next_review_at, srs_interval)
  values (p_user_id, p_word, p_definition, p_phonetic, p_syllables, 1, p_score, now(),
    case when p_score < 75 then now() + interval '1 day' else null end, 1)
  on conflict (user_id, word) do update set
    times_practiced = vocabulary.times_practiced + 1,
    best_score = greatest(vocabulary.best_score, excluded.best_score),
    last_practiced_at = now(),
    definition = coalesce(excluded.definition, vocabulary.definition),
    phonetic = coalesce(excluded.phonetic, vocabulary.phonetic),
    syllables = coalesce(excluded.syllables, vocabulary.syllables),
    next_review_at = case
      when excluded.best_score < 75 and vocabulary.next_review_at is null
      then now() + interval '1 day'
      else vocabulary.next_review_at
    end,
    srs_interval = case
      when excluded.best_score < 75 and vocabulary.next_review_at is null then 1
      else vocabulary.srs_interval
    end;
end;
$$ language plpgsql security definer;
```

**Step 2: Apply migration**
Run the migration against the Supabase project via the dashboard SQL editor or `psql`.

**Step 3: Commit**
`git add supabase/ && git commit -m "feat: add exercise_results, vocabulary tables, difficulty columns, and upsert function"`

---

### Task 2: Type System Refactor & Seed Script Update

**Files:**
- Modify: `src/lib/progress.ts` (Mission interface)
- Create: `src/types/exercises.ts`
- Modify: `src/app/(protected)/mission/[id]/page.tsx` (Exercise type)
- Modify: `scripts/seedData.ts`

**Why:** The existing `Exercise` interface uses `Record<string, string>` which cannot hold listening comprehension data. The seed script must also be updated now (before content changes) because Task 1 changed the unique constraint.

**Step 1: Create shared exercise types**
Create `src/types/exercises.ts`:

```typescript
export interface SpellingItem {
  word: string;
  definition: string;
  phonetic?: string;
  syllables?: string;
}

export interface DictationItem {
  text: string;
  hint?: string;
}

export interface SpeakingItem {
  text: string;
}

export interface ListeningDialogLine {
  speaker: string;
  text: string;
}

export interface ListeningQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface ListeningItem {
  title: string;
  dialog: ListeningDialogLine[];
  questions: ListeningQuestion[];
}

export type Exercise =
  | { type: "spelling"; data: SpellingItem }
  | { type: "dictation"; data: DictationItem }
  | { type: "speaking"; data: SpeakingItem }
  | { type: "listening"; data: ListeningItem };
```

**Step 2: Update Mission interface**
In `src/lib/progress.ts`, update the `Mission` interface to use shared types and add optional `listening`:

```typescript
import type { SpellingItem, DictationItem, SpeakingItem, ListeningItem } from '@/types/exercises';

export interface Mission {
  id: string;
  day_number: number;
  title: string;
  description: string;
  difficulty: number;
  content: {
    spelling: SpellingItem[];
    dictation: DictationItem[];
    speaking: SpeakingItem[];
    listening?: ListeningItem[];
  };
}
```

**Step 3: Update mission runner**
In `src/app/(protected)/mission/[id]/page.tsx`:
- Remove the local `Exercise` interface
- Import `Exercise` from `@/types/exercises`
- Remove the `as Exercise` type casts when building the exercises array
- Add listening exercises to the array (if present):
  ```typescript
  ...(data.content.listening || []).map(l => ({ type: "listening" as const, data: l })),
  ```
- Update section label logic to include a "Listening" section
- Exercise order: spelling → dictation → listening → speaking

**Step 4: Update SpellingBee, Dictation, Speaking component prop types**
Import types from `@/types/exercises` instead of defining inline interfaces. This is a non-breaking rename — the shapes are identical to what exists. Do NOT change the `onComplete` callback signatures — these components keep `onComplete: (score: number) => void`.

**Step 5: Update seed script**
In `scripts/seedData.ts`, change `onConflict: 'day_number'` to `onConflict: 'day_number,difficulty'`. Add logic to default `difficulty` to 2 if missing from a mission object.

**Step 6: Verify build and seed**
Run `npm run build` then `npm run seed` to confirm both pass.

**Step 7: Commit**
`git add -A && git commit -m "refactor: discriminated union Exercise type, updated seed script"`

---

## Phase 2: Data Layer

Tasks 3, 4, 5, and 6 are independent and can be built in parallel.

### Task 3: Exercise Results Service

**Files:**
- Create: `src/lib/exerciseResults.ts`

**Why:** Per-item result tracking is the foundation for vocabulary collection, SRS, and adaptive difficulty.

**Step 1: Create exercise results service**
Create `src/lib/exerciseResults.ts`:

```typescript
import { supabase } from './supabaseClient';

export async function saveExerciseResult(
  userId: string,
  missionId: string | null,
  exerciseType: 'spelling' | 'dictation' | 'speaking' | 'listening',
  itemKey: string,
  score: number
) {
  const { error } = await supabase
    .from('exercise_results')
    .insert({
      user_id: userId,
      mission_id: missionId,
      exercise_type: exerciseType,
      item_key: itemKey,
      score,
    });
  if (error) throw error;
}

export async function getResultsForMission(userId: string, missionId: string) {
  const { data, error } = await supabase
    .from('exercise_results')
    .select('*')
    .eq('user_id', userId)
    .eq('mission_id', missionId)
    .order('attempted_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getResultsByType(userId: string, exerciseType: string) {
  const { data, error } = await supabase
    .from('exercise_results')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_type', exerciseType)
    .order('attempted_at', { ascending: false });
  if (error) throw error;
  return data;
}
```

Note: `missionId` is `string | null` — null for review sessions (Task 10).

**Step 2: Commit**
`git add src/lib/exerciseResults.ts && git commit -m "feat: add exercise results data service"`

---

### Task 4: Vocabulary Service

**Files:**
- Create: `src/lib/vocabulary.ts`

**Why:** Supports vocabulary notebook (B4) and SRS entry (B1). Must exist before the mission runner can auto-collect words.

**Step 1: Create vocabulary service**
Create `src/lib/vocabulary.ts` with functions:

- `upsertVocabulary(userId, word, definition, phonetic, syllables, score)`:
  - Calls the `upsert_vocabulary` Postgres function created in Task 1 via `supabase.rpc('upsert_vocabulary', { ... })`
  - Atomic: increments `times_practiced`, updates `best_score`, conditionally enrolls in SRS

- `getUserVocabulary(userId, filter?, sortBy?)`:
  - Returns all vocabulary for user
  - Optional filter: `'needs_practice'` (best_score < 75), `'mastered'` (best_score = 100), `'starred'`
  - Sort by `word` (alphabetical) or `last_practiced_at` (recency)

- `toggleStar(userId, word)`:
  - Fetch current `starred` and `next_review_at` values
  - Toggle `starred` boolean
  - If starring and `next_review_at` is null, set it to tomorrow (enroll in SRS)

- `getVocabularyCount(userId)`:
  - Returns `{ total, needsPractice, mastered }` counts

**Step 2: Commit**
`git add src/lib/vocabulary.ts && git commit -m "feat: add vocabulary data service with RPC upsert and filtering"`

---

### Task 5: SRS Service

**Files:**
- Create: `src/lib/srs.ts`

**Why:** Handles SRS query and interval update logic for the review page.

**Step 1: Create SRS service**
Create `src/lib/srs.ts` with functions:

- `getDueReviewItems(userId, limit = 15)`:
  - Query: vocabulary rows where `next_review_at <= now()`, ordered by `next_review_at ASC`, limited
  - Returns vocabulary rows with all metadata needed for SpellingBee component

- `getDueReviewCount(userId)`:
  - Returns count of vocabulary rows where `next_review_at <= now()`
  - Used by dashboard to show "X items to review"

- `updateSRSAfterReview(userId, word, score)`:
  - Fetch current `srs_interval` for the word
  - Implements simplified SM-2:
    - score >= 75: double `srs_interval` (cap at 30 days)
    - score 50-74: keep `srs_interval`
    - score < 50: reset `srs_interval` to 1
  - Update `next_review_at = now() + new_interval days`
  - Also update `best_score`, increment `times_practiced`, set `last_practiced_at`

**Step 2: Commit**
`git add src/lib/srs.ts && git commit -m "feat: add SRS service with SM-2 interval logic"`

---

### Task 6: Difficulty-Aware Progress

**Files:**
- Modify: `src/lib/progress.ts`
- Create: `src/lib/difficulty.ts`

**Why:** Progress initialization and queries must filter by user's difficulty preference. Switching difficulty resets progression.

**Step 1: Create difficulty service**
Create `src/lib/difficulty.ts`:

- `getUserDifficulty(userId)`:
  - Query `profiles.difficulty_preference` for the user
  - Returns number (1, 2, or 3). Defaults to 2 if null.

- `getRollingAverageScore(userId, lastN = 3)`:
  - Query latest N completed `user_progress` rows ordered by `completed_at desc`
  - Return average score (or null if fewer than N missions completed)

- `switchDifficulty(userId, newDifficulty)`:
  1. Update `profiles.difficulty_preference`
  2. Delete all `user_progress` rows for the user (DELETE policy added in Task 1)
  3. Call `ensureProgressInitialized(userId, newDifficulty)` to create fresh rows
  - Note: this resets streak (streak is derived from `user_progress.completed_at`). The UI should warn the user with a confirmation dialog before switching.

- `getDifficultySuggestion(userId)`:
  - Calls `getUserDifficulty` and `getRollingAverageScore`
  - If avg >= 85 and current difficulty < 3: return `{ type: 'suggest_harder', current: N, suggested: N+1 }`
  - If avg <= 50 and current difficulty > 1: return `{ type: 'suggest_easier', current: N, suggested: N-1 }`
  - Otherwise: return `null`

**Step 2: Update `progress.ts` to be difficulty-aware**
Modify `ensureProgressInitialized(userId, difficulty)`:
- Accept `difficulty` parameter
- Filter missions query: `.eq('difficulty', difficulty)`
- Only create progress rows for missions matching the user's difficulty level

Modify `getUserProgress`:
- The query naturally filters via initialized rows (only rows for the current difficulty exist)

Modify `getMissions`:
- Accept optional `difficulty` parameter to filter

**Step 3: Update `UserProgress` interface**
Add `difficulty` to the `Mission` type embedded in `UserProgress` (it comes from the JOIN).

**Step 4: Commit**
`git add src/lib/difficulty.ts src/lib/progress.ts && git commit -m "feat: difficulty-aware progress with switching support"`

---

## Phase 3: Components & Pages

### Task 7: Listening Comprehension Component

**Files:**
- Create: `src/components/modules/ListeningComprehension.tsx`

**Why:** New exercise type. Must exist before the mission runner can render listening exercises.

**Step 1: Build the component**
Create `src/components/modules/ListeningComprehension.tsx`:

Props:
```typescript
interface QuestionResult {
  key: string;  // e.g. "project-timeline-discussion:q0"
  score: number; // 0 or 100
}

interface ListeningComprehensionProps {
  item: ListeningItem;
  onComplete: (score: number, questionResults: QuestionResult[]) => void;
}
```

State machine with two phases:

**Phase 1: Listen to Dialog**
- Display speaker labels vertically
- "Play Dialog" button plays each line sequentially via TTS with a 500ms pause between speakers
- Listen for `voiceschanged` event and cache available voices. Use distinct en-US voices for different speakers if available. If only one voice, show speaker name labels prominently before each line with visual differentiation (e.g., indentation or color).
- "Replay" button to hear the dialog again
- "Slow Replay" button at 0.6x rate
- "Ready to Answer" button advances to Phase 2

**Phase 2: Answer Questions**
- Show questions one at a time
- Each question has 3-4 options as tappable cards (min 44px height)
- On selection, immediately show correct/incorrect feedback (green/red border)
- Track score per question: correct = 100, wrong = 0
- Build `questionResults` array: `{ key: "${item.title}:q${index}", score }`
- After all questions answered, show overall score and "Next" button
- Call `onComplete(averageScore, questionResults)`

Use existing UI components: `Card`, `Button`, `ScoreDisplay`.
Follow Manuscript theme colors for feedback (success/error border flashes).

**Step 2: Commit**
`git add src/components/modules/ListeningComprehension.tsx && git commit -m "feat: add listening comprehension exercise component"`

---

### Task 8: Mission Runner Refactor

**Files:**
- Modify: `src/app/(protected)/mission/[id]/page.tsx`

**Why:** The mission runner must (a) render listening exercises, (b) save per-item exercise results, (c) auto-collect vocabulary from spelling exercises.

**Step 1: Import new dependencies**
Add imports:
- `ListeningComprehension` from components
- `saveExerciseResult` from `@/lib/exerciseResults`
- `upsertVocabulary` from `@/lib/vocabulary`
- `Exercise` type from `@/types/exercises`

**Step 2: Update exercise array construction**
Insert listening exercises between dictation and speaking:
```typescript
const allExercises: Exercise[] = [
  ...data.content.spelling.map(s => ({ type: "spelling" as const, data: s })),
  ...data.content.dictation.map(d => ({ type: "dictation" as const, data: d })),
  ...(data.content.listening || []).map(l => ({ type: "listening" as const, data: l })),
  ...data.content.speaking.map(s => ({ type: "speaking" as const, data: s })),
];
```

**Step 3: Extend `handleComplete` to save exercise results**
The internal `handleComplete` function wraps each component's `onComplete`. Existing components keep their `(score: number) => void` signature — the mission runner adds context from the current exercise:

```typescript
// For spelling:
<SpellingBee
  {...props}
  onComplete={(score) => {
    const item = current.data as SpellingItem;
    saveExerciseResult(user.id, missionId, 'spelling', item.word, score).catch(console.error);
    upsertVocabulary(user.id, item.word, item.definition, item.phonetic, item.syllables, score).catch(console.error);
    advanceToNext(score);
  }}
/>

// For dictation:
<Dictation
  {...props}
  onComplete={(score) => {
    saveExerciseResult(user.id, missionId, 'dictation', current.data.text, score).catch(console.error);
    advanceToNext(score);
  }}
/>

// For speaking:
<Speaking
  {...props}
  onComplete={(score) => {
    saveExerciseResult(user.id, missionId, 'speaking', current.data.text, score).catch(console.error);
    advanceToNext(score);
  }}
/>

// For listening:
<ListeningComprehension
  item={current.data}
  onComplete={(score, questionResults) => {
    for (const qr of questionResults) {
      saveExerciseResult(user.id, missionId, 'listening', qr.key, qr.score).catch(console.error);
    }
    advanceToNext(score);
  }}
/>
```

Extract the common score-tracking logic (add to scores array, advance step or show summary) into an `advanceToNext(score)` helper.

**Step 4: Update section labels and score breakdown**
Add `"Listening"` section between dictation and speaking in the section label logic. Update index calculations:

```typescript
const spLen = mission.content.spelling.length;
const diLen = mission.content.dictation.length;
const liLen = (mission.content.listening || []).length;
const spkLen = mission.content.speaking.length;
```

Update the summary screen score breakdown to include a "Listening" row:
```typescript
const spellingScores = scores.slice(0, spLen);
const dictationScores = scores.slice(spLen, spLen + diLen);
const listeningScores = scores.slice(spLen + diLen, spLen + diLen + liLen);
const speakingScores = scores.slice(spLen + diLen + liLen);
```

Add `{ label: "Listening", score: avg(listeningScores) }` to the breakdown (only if liLen > 0).

**Step 5: Verify build**
Run `npm run build`.

**Step 6: Commit**
`git add src/app/ && git commit -m "feat: mission runner saves exercise results and collects vocabulary"`

---

### Task 9: Vocabulary Notebook Page

**Files:**
- Create: `src/app/(protected)/vocabulary/page.tsx`

**Why:** Dedicated page for users to browse, filter, and star their collected vocabulary.

**Step 1: Build the page**

Layout:
- Header with back button, "My Vocabulary" title, word count stats (e.g., "42 words · 8 to practice · 20 mastered")
- Search bar (client-side filter by word)
- Filter tabs: "All" | "Needs Practice" | "Mastered" | "Starred"
- Sort toggle: "A-Z" | "Recent"
- Word list: expandable cards

Word card (collapsed): word, best score badge (color-coded), star button
Word card (expanded): + definition, phonetic, syllables, "Hear it" button (TTS), times practiced, best score

Star button: calls `toggleStar()` from vocabulary service. If word is now starred and not in SRS, enrolls it.

Use existing UI components: `Card`, `Button`, `Badge`, `Input` (for search).
Mobile-first layout, 44px touch targets.

**Step 2: Add navigation link**
Add a "Vocabulary" nav link to the dashboard (e.g., in the header or as a card below the mission list). Use `BookOpen` icon from lucide-react.

**Step 3: Commit**
`git add src/app/ && git commit -m "feat: add vocabulary notebook page with filtering and starring"`

---

### Task 10: Review Page (SRS)

**Files:**
- Create: `src/app/(protected)/review/page.tsx`

**Why:** Standalone page for spaced repetition review sessions.

**Step 1: Build the review page**

Load due items via `getDueReviewItems(user.id)`.

**Empty state** (no items due): Encouraging message — "Nothing to review right now — great work!" with a link back to dashboard.

**Review session** (items due):
- Progress bar at top: "Review 1/X"
- Reuse `SpellingBee` component for each word (pass word, definition, phonetic, syllables from vocabulary row)
- After each answer:
  - Call `updateSRSAfterReview(user.id, word, score)` to update SRS interval
  - Call `saveExerciseResult(user.id, null, 'spelling', word, score)` — `null` mission_id for review sessions (column is nullable per Task 1)

**Summary screen** (all items reviewed):
- Total items reviewed, average score
- "Return to Dashboard" button

**Step 2: Commit**
`git add src/app/ && git commit -m "feat: add SRS review page with spaced repetition"`

---

### Task 11: Dashboard Updates

**Files:**
- Modify: `src/app/(protected)/page.tsx`

**Why:** Dashboard needs review card, difficulty display, difficulty suggestion banner, and vocabulary link.

**Step 1: Fetch new data on load**
Add to the dashboard's `useEffect`:
- `getDueReviewCount(user.id)` → `reviewCount` state
- `getUserDifficulty(user.id)` → `difficulty` state (pass to `ensureProgressInitialized`)
- `getDifficultySuggestion(user.id)` → `suggestion` state

**Step 2: Add review card**
Below "Today's Mission" card, show a "Review" card if `reviewCount > 0`:
- Show: "X words to review" with a "Start Review" button linking to `/review`
- Style similar to Today's Mission card but with amber/accent color
- Hide if count is 0

**Step 3: Add difficulty display**
In the dashboard header, next to the streak counter, show current difficulty level:
- Display as a subtle label: "Beginner" / "Intermediate" / "Advanced"

**Step 4: Add difficulty suggestion banner**
If `suggestion` is not null, show a card:
- `'suggest_harder'`: "You're doing great! Ready for harder missions?" + Accept/Dismiss buttons
- `'suggest_easier'`: "Want to try easier missions to build confidence?" + Accept/Dismiss buttons
- On Accept: show confirmation dialog ("This will reset your mission progress and streak. Continue?"). On confirm, call `switchDifficulty(user.id, suggestion.suggested)`, then reload the page.
- On Dismiss: hide the card (store dismissal in `sessionStorage` so it doesn't reappear until next session)

**Step 5: Add vocabulary link**
Add a "My Vocabulary" card or nav button linking to `/vocabulary`. Use `BookOpen` icon from lucide-react.

**Step 6: Commit**
`git add src/app/ && git commit -m "feat: dashboard with review card, difficulty display, and suggestions"`

---

## Phase 4: Content

### Task 12: Listening Content for Existing Missions

**Files:**
- Modify: `data/missions.json`

**Why:** Add listening comprehension exercises to the existing 7 intermediate missions.

**Step 1: Author listening content**
For each of the 7 existing missions, add a `listening` array with 1 dialog and 2-3 questions. Themes match the mission:

| Day | Theme | Dialog Topic |
|-----|-------|-------------|
| 1 | Daily Standup | Dev explains blocker to manager |
| 2 | Email Communication | Clarifying an email request |
| 3 | Team Meeting | Discussing agenda priorities |
| 4 | Code Review | Reviewing a pull request |
| 5 | Client Communication | Scope change discussion |
| 6 | Presentations | Preparing a demo |
| 7 | Problem Solving | Debugging a production issue |

Each dialog: 3-5 lines, 2 speakers, workplace vocabulary.
Each question set: 2-3 multiple-choice questions with 3 options each.

**Step 2: Add `difficulty: 2` field**
Add `"difficulty": 2` to each existing mission object.

**Step 3: Commit**
`git add data/missions.json && git commit -m "feat: add listening content and difficulty tags to existing missions"`

---

### Task 13a: Beginner Content (Difficulty 1)

**Files:**
- Modify: `data/missions.json`

**Why:** 10 beginner missions for users who need simpler content.

**Step 1: Author beginner missions**
10 missions with simpler workplace themes:
- Shorter sentences (5-8 words for dictation)
- Common vocabulary (no jargon)
- 3 spelling words, 2 dictation sentences, 1 speaking sentence, 1 listening dialog per mission
- All with `"difficulty": 1`
- Topics: Greetings, Asking for Help, Lunch Break, Simple Instructions, Thank You Emails, Office Supplies, Calendar, Directions, Phone Calls, Introductions

**Step 2: Commit**
`git add data/missions.json && git commit -m "feat: add 10 beginner missions (difficulty 1)"`

---

### Task 13b: Advanced Content (Difficulty 3)

**Files:**
- Modify: `data/missions.json`

**Why:** 10 advanced missions for users who need more challenge.

**Step 1: Author advanced missions**
10 missions with complex workplace themes:
- Longer sentences (12-20 words for dictation)
- Professional jargon and idioms
- 5 spelling words, 3 dictation sentences, 2 speaking sentences, 1 listening dialog per mission
- All with `"difficulty": 3`
- Topics: Negotiation, Conflict Resolution, Performance Review, Technical Architecture, Board Presentation, Crisis Management, Cross-Cultural Communication, Strategic Planning, Stakeholder Management, Leadership Communication

**Step 2: Commit**
`git add data/missions.json && git commit -m "feat: add 10 advanced missions (difficulty 3)"`

---

### Task 13c: Expand Intermediate to 10

**Files:**
- Modify: `data/missions.json`

**Why:** Expand from 7 to 10 intermediate missions for consistency across difficulty levels.

**Step 1: Author 3 additional intermediate missions**
Add days 8-10, following the same structure as existing ones:
- Day 8: Onboarding & Training
- Day 9: Remote Collaboration
- Day 10: Project Retrospective
- All with `"difficulty": 2`, including listening content

**Step 2: Commit**
`git add data/missions.json && git commit -m "feat: expand intermediate to 10 missions"`

---

### Task 14: Seed & Verify

**Files:**
- None (seed script already updated in Task 2)

**Step 1: Run seed**
Run `npm run seed` and verify all 30 missions are inserted correctly.

**Step 2: Verify in Supabase**
Check the missions table: 10 rows with difficulty=1, 10 with difficulty=2, 10 with difficulty=3.

---

## Phase 5: Integration

### Task 15: Final Integration Testing

**Files:**
- Various

**Step 1: End-to-end flow test**
Verify the complete flow:
1. Sign up → lands on dashboard with Day 1 open (intermediate by default)
2. Start mission → complete spelling (verify vocabulary auto-collected) → dictation → listening → speaking → summary with all 4 sections in breakdown
3. Return to dashboard → see score, next mission unlocked
4. Check `/vocabulary` → see collected words, sort by recent
5. Star a word → see it in "Starred" filter
6. Go to `/review` → if items are due, complete a review session
7. Complete 3+ missions → check if difficulty suggestion appears
8. Accept difficulty change → confirm dialog → verify progression resets to Day 1 at new level

**Step 2: Error handling**
- Mission without listening content → listening phase skipped gracefully
- TTS failure → error message shown, exercise still usable
- Network error on save → error toast, exercise data not lost
- Empty vocabulary → notebook shows empty state

**Step 3: Mobile responsiveness**
- Test on 375px viewport width
- Verify 44px touch targets on all interactive elements
- Listening question options should be easily tappable
- Vocabulary word cards should be expandable on mobile

**Step 4: Commit**
`git add -A && git commit -m "polish: integration fixes, error handling, mobile responsiveness"`

---

## Dependency Graph

```
Task 0 (remove dev mode + git init)
  └→ Task 1 (migration — all tables, policies, functions)
       ├→ Task 2 (type refactor + seed script update)
       ├→ Task 3 (exercise results service) ─────────┐
       ├→ Task 4 (vocabulary service) → Task 9 (vocab page)
       ├→ Task 5 (SRS service) → Task 10 (review page)  ├→ Task 8 (mission runner)
       └→ Task 6 (difficulty service) → Task 11 (dashboard)
            Task 2 → Task 7 (listening component) ───┘

Content (independent of code, can be parallel):
  Task 12 (listening for existing) ──┐
  Task 13a (beginner) ───────────────┤
  Task 13b (advanced) ───────────────├→ Task 14 (seed & verify)
  Task 13c (expand intermediate) ────┘

  Task 8 + Task 9 + Task 10 + Task 11 + Task 14 → Task 15 (integration testing)
```

**Parallelizable groups:**
- Tasks 3, 4, 5, 6 (data services) — all independent after Task 1
- Tasks 7, 9, 10 (new component/pages) — independent of each other
- Tasks 12, 13a, 13b, 13c (content authoring) — fully independent of code tasks

## Estimated Effort

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1: Foundation | 0, 1, 2 | Small — cleanup, migration, refactoring |
| Phase 2: Data Layer | 3, 4, 5, 6 | Medium — 4 service files |
| Phase 3: Components | 7, 8, 9, 10, 11 | Large — 1 new component, 3 new pages, 1 major refactor |
| Phase 4: Content | 12, 13a-c, 14 | Large — 30 missions of authored content |
| Phase 5: Integration | 15 | Small — testing and fixes |
