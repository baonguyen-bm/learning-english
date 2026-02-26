# Personalized English Learning App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a "Daily Mission" based English learning PWA where the user practices listening, spelling, and speaking.

**Architecture:** Next.js 14+ (App Router), Tailwind CSS, Supabase (Auth + DB). No external AI APIs at runtime; content is pre-generated and seeded.

**Tech Stack:** Next.js, React, Tailwind CSS, Supabase, Web Speech API (TTS/STT).

---

### Task 0: Design Foundation

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Card.tsx`
- Create: `components/ui/Input.tsx`
- Create: `components/ui/ProgressRing.tsx`
- Create: `components/ui/ScoreDisplay.tsx`
- Create: `components/ui/Badge.tsx`

**Why:** Every subsequent task depends on these design tokens and base components. Without this foundation, components default to generic Tailwind patterns.

**Step 1: Configure Design Tokens in Tailwind**
Extend `tailwind.config.ts` with the full color palette, typography scale, and animation tokens from the design document (Section 2.5). Use CSS custom properties for theme-aware colors.

**Step 2: Set Up Typography**
In `app/layout.tsx`, import fonts via `next/font/google`:
- `Instrument_Serif` for display/headings
- `Plus_Jakarta_Sans` for body/UI
- `JetBrains_Mono` for answer/code text

Apply font CSS variables to the `<html>` element.

**Step 3: Create Global Styles**
In `app/globals.css`:
- Define all CSS custom properties (light + dark via `@media (prefers-color-scheme: dark)`)
- Add subtle paper grain texture overlay
- Define keyframes: `fadeIn`, `slideUp`, `scaleIn`, `scoreCount`, `shake`, `confettiBurst`
- Style scrollbars, selection color, and focus rings to match Manuscript theme

**Step 4: Build Base UI Components**
Create reusable components in `components/ui/`:
- **Button**: Variants (primary, secondary, ghost). Sizes (sm, md, lg). Min 44px touch target. `active:scale-[0.98]` press feedback.
- **Card**: Warm surface with subtle border. Hover lift. Optional header/footer.
- **Input**: Ruled-line bottom border (notebook aesthetic). Animated focus state.
- **ProgressRing**: SVG circular progress with animated stroke-dashoffset.
- **ScoreDisplay**: Counter that animates from 0 to target over 1.2s.
- **Badge**: Status indicators — locked (muted), open (primary pulse), completed (success + checkmark).

**Step 5: Commit**
Run: `git add . && git commit -m "feat: design system foundation with Manuscript theme"`

---

### Task 1: Project Initialization & Supabase Setup

**Files:**
- Create: `supabase/migrations/20260226_initial_schema.sql`
- Create: `lib/supabaseClient.ts`
- Modify: `.env.local`

**Step 1: Initialize Next.js Project**
Run: `npx create-next-app@latest . --typescript --tailwind --eslint`
Expected: Success message, project created in current directory.

**Step 2: Install Dependencies**
Run: `npm install @supabase/supabase-js @supabase/auth-helpers-nextjs lucide-react clsx tailwind-merge`
Expected: Packages installed.

**Step 3: Define Database Schema (SQL)**
Create `supabase/migrations/20260226_initial_schema.sql`:
```sql
create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone
);

create table public.missions (
  id uuid default uuid_generate_v4() primary key,
  day_number int not null unique,
  title text not null,
  description text,
  content jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.user_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  mission_id uuid references public.missions not null,
  status text check (status in ('locked', 'open', 'completed')) default 'locked',
  score int default 0,
  completed_at timestamp with time zone,
  unique(user_id, mission_id)
);

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.user_progress enable row level security;

create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile." on public.profiles for update using (auth.uid() = id);
create policy "Missions are viewable by everyone." on public.missions for select using (true);
create policy "Users can view their own progress." on public.user_progress for select using (auth.uid() = user_id);
create policy "Users can update their own progress." on public.user_progress for update using (auth.uid() = user_id);
create policy "Users can insert their own progress." on public.user_progress for insert with check (auth.uid() = user_id);
```

**Step 4: Create Supabase Client**
Create `lib/supabaseClient.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Step 5: Commit**
Run: `git add . && git commit -m "feat: init project and supabase schema"`

---

### Task 2: Scoring Utility (Levenshtein Distance)

**Files:**
- Create: `lib/scoring.ts`

**Why:** Multiple modules need fuzzy text comparison. Build this first so modules can use it.

**Step 1: Create Scoring Utility**
Create `lib/scoring.ts`:
```typescript
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function scoreSpelling(input: string, target: string): number {
  const distance = levenshteinDistance(
    input.trim().toLowerCase(),
    target.trim().toLowerCase()
  );
  if (distance === 0) return 100;
  if (distance === 1) return 75;
  if (distance === 2) return 50;
  return 0;
}

// Note: this uses positional matching (word i vs word i). If the user inserts
// or skips a word, all subsequent positions shift and score poorly. Acceptable
// for MVP; a future improvement would use longest-common-subsequence alignment.
export function scoreDictation(input: string, target: string): number {
  const inputWords = input.trim().toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const targetWords = target.trim().toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);

  if (targetWords.length === 0) return 0;

  let correctCount = 0;
  const maxLen = Math.max(inputWords.length, targetWords.length);

  for (let i = 0; i < targetWords.length; i++) {
    if (i < inputWords.length) {
      const distance = levenshteinDistance(inputWords[i], targetWords[i]);
      if (distance === 0) correctCount += 1;
      else if (distance === 1) correctCount += 0.75;
      else if (distance === 2) correctCount += 0.5;
    }
  }

  const lengthPenalty = maxLen > targetWords.length
    ? targetWords.length / maxLen
    : 1;

  return Math.round((correctCount / targetWords.length) * 100 * lengthPenalty);
}

export type WordDiffResult = {
  word: string;
  expected: string;
  status: 'correct' | 'close' | 'wrong' | 'missing';
};

export function diffWords(input: string, target: string): WordDiffResult[] {
  const inputWords = input.trim().toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const targetWords = target.trim().toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

  return targetWords.map((expected, i) => {
    if (i >= inputWords.length) {
      return { word: '', expected, status: 'missing' as const };
    }
    const distance = levenshteinDistance(inputWords[i], expected);
    let status: WordDiffResult['status'];
    if (distance === 0) status = 'correct';
    else if (distance <= 2) status = 'close';
    else status = 'wrong';
    return { word: inputWords[i], expected, status };
  });
}

export function scoreSpeaking(transcript: string, target: string): number {
  const normalize = (s: string) =>
    s.trim().toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);

  const spokenWords = normalize(transcript);
  const targetWords = normalize(target);

  if (targetWords.length === 0) return 0;

  let matched = 0;
  for (const word of targetWords) {
    if (spokenWords.includes(word)) matched++;
  }

  return Math.round((matched / targetWords.length) * 100);
}
```

**Step 2: Commit**
Run: `git add lib/scoring.ts && git commit -m "feat: add scoring utilities with Levenshtein distance"`

---

### Task 3: Core Speech Utilities (TTS & STT Hooks)

**Files:**
- Create: `hooks/useTTS.ts`
- Create: `hooks/useSTT.ts`

**Step 1: Implement Text-to-Speech Hook**
Create `hooks/useTTS.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true);
    }
  }, []);

  const speak = useCallback((text: string, rate = 0.9) => {
    if (!supported) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const cancel = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [supported]);

  return { speak, cancel, isSpeaking, supported };
};
```

**Step 2: Implement Speech-to-Text Hook**

The STT hook must store the recognition instance in a ref so it can be stopped on demand. The hold-to-speak pattern from the original plan won't work because speech recognition takes time to initialize — by the time the user releases, nothing has been captured. Use a start/stop toggle instead.

Create `hooks/useSTT.ts`:
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

export const useSTT = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' &&
        ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setSupported(true);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!supported || isListening) return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex][0].transcript;
      setTranscript(result);
    };
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    setTranscript('');
    recognition.start();
  }, [supported, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    startListening,
    stopListening,
    resetTranscript,
    isListening,
    transcript,
    supported,
  };
};
```

**Step 3: Commit**
Run: `git add hooks/ && git commit -m "feat: add TTS and STT hooks with start/stop control"`

---

### Task 4: Dictation Module Component

**Files:**
- Create: `components/modules/Dictation.tsx`

**Step 1: Create Dictation Component**

Uses `scoreDictation` for word-level partial credit. Shows a "Next" button after submission so the user controls pacing.

Create `components/modules/Dictation.tsx`:
```typescript
'use client';

import React, { useState } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { scoreDictation, diffWords } from '@/lib/scoring';
import { WordDiff } from '@/components/ui/WordDiff';

interface DictationProps {
  sentence: string;
  hint?: string;
  onComplete: (score: number) => void;
}

export const Dictation: React.FC<DictationProps> = ({ sentence, hint, onComplete }) => {
  const { speak, isSpeaking } = useTTS();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const handleSubmit = () => {
    const result = scoreDictation(input, sentence);
    setScore(result);
    setSubmitted(true);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border rounded-xl shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => speak(sentence)}
          disabled={isSpeaking}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
        >
          {isSpeaking ? 'Playing...' : '▶ Play Audio'}
        </button>
        <button
          onClick={() => speak(sentence, 0.6)}
          disabled={isSpeaking}
          className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 text-sm"
        >
          🐢 Slow
        </button>
      </div>

      {hint && <p className="text-sm text-blue-500">Hint: {hint}</p>}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={submitted}
        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        placeholder="Type what you hear..."
        rows={3}
      />

      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
        >
          Check Answer
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{score}</span>
            <span className="text-gray-500">/ 100</span>
          </div>
          <WordDiff results={diffWords(input, sentence)} />
          <button
            onClick={() => onComplete(score)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
```

**Step 2: Commit**
Run: `git add components/modules/Dictation.tsx && git commit -m "feat: add dictation component with partial scoring"`

---

### Task 4b: WordDiff UI Component

**Files:**
- Create: `components/ui/WordDiff.tsx`

**Why:** The Dictation component (and potentially Speaking) needs to render word-level visual feedback. This is a shared presentational component.

**Step 1: Create WordDiff Component**
Create `components/ui/WordDiff.tsx`:
```typescript
'use client';

import React from 'react';
import type { WordDiffResult } from '@/lib/scoring';

interface WordDiffProps {
  results: WordDiffResult[];
}

const statusColors = {
  correct: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  close: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  wrong: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  missing: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
};

export const WordDiff: React.FC<WordDiffProps> = ({ results }) => {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-500">Word-by-word breakdown:</p>
      <div className="flex flex-wrap gap-1.5">
        {results.map((r, i) => (
          <span
            key={i}
            className={`px-2 py-1 rounded text-sm font-mono ${statusColors[r.status]}`}
            title={r.status === 'correct' ? r.expected : `Expected: "${r.expected}"`}
          >
            {r.status === 'missing' ? `_${r.expected}_` : r.word}
          </span>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-gray-400 mt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 inline-block" /> Correct</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 inline-block" /> Close</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 inline-block" /> Wrong</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-800 inline-block" /> Missing</span>
      </div>
    </div>
  );
};
```

**Step 2: Commit**
Run: `git add components/ui/WordDiff.tsx && git commit -m "feat: add WordDiff visual feedback component"`

---

### Task 5: Spelling Bee Module Component

**Files:**
- Create: `components/modules/SpellingBee.tsx`

**Step 1: Create Spelling Bee Component**

Definition is hidden until after submission. Uses `scoreSpelling` for partial credit.

Create `components/modules/SpellingBee.tsx`:
```typescript
'use client';

import React, { useState } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { scoreSpelling } from '@/lib/scoring';

interface SpellingBeeProps {
  word: string;
  definition?: string;
  onComplete: (score: number) => void;
}

export const SpellingBee: React.FC<SpellingBeeProps> = ({ word, definition, onComplete }) => {
  const { speak, isSpeaking } = useTTS();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const handleSubmit = () => {
    const result = scoreSpelling(input, word);
    setScore(result);
    setSubmitted(true);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border rounded-xl shadow-sm space-y-4">
      <button
        onClick={() => speak(word)}
        disabled={isSpeaking}
        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
      >
        {isSpeaking ? 'Speaking...' : '▶ Hear Word'}
      </button>

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={submitted}
        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        placeholder="Spell the word..."
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onKeyDown={(e) => e.key === 'Enter' && !submitted && input.trim() && handleSubmit()}
      />

      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
        >
          Check Spelling
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{score}</span>
            <span className="text-gray-500">/ 100</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Correct spelling:</p>
            <p className="text-green-600 dark:text-green-400 text-xl tracking-wide">{word}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Your answer:</p>
            <p className={`text-xl tracking-wide ${score === 100 ? 'text-green-600' : 'text-orange-500'}`}>
              {input}
            </p>
          </div>
          {definition && (
            <p className="text-sm text-gray-500 italic">Definition: {definition}</p>
          )}
          <button
            onClick={() => onComplete(score)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
```

**Step 2: Commit**
Run: `git add components/modules/SpellingBee.tsx && git commit -m "feat: add spelling bee component with partial scoring"`

---

### Task 6: Speaking Module Component

**Files:**
- Create: `components/modules/Speaking.tsx`

**Step 1: Create Speaking Component**

Changed from hold-to-speak (broken: recognition initializes too slowly) to a start/stop toggle. Uses `scoreSpeaking` for word-overlap scoring.

Create `components/modules/Speaking.tsx`:
```typescript
'use client';

import React, { useState } from 'react';
import { useSTT } from '@/hooks/useSTT';
import { scoreSpeaking } from '@/lib/scoring';

interface SpeakingProps {
  targetSentence: string;
  onComplete: (score: number) => void;
}

export const Speaking: React.FC<SpeakingProps> = ({ targetSentence, onComplete }) => {
  const { startListening, stopListening, isListening, transcript, supported } = useSTT();
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  if (!supported) {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-xl">
        <p className="text-yellow-800 dark:text-yellow-200">
          Speech recognition is not supported in this browser. Please use Chrome or Edge for the speaking module.
        </p>
        <button
          onClick={() => onComplete(0)}
          className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg"
        >
          Skip →
        </button>
      </div>
    );
  }

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = () => {
    if (isListening) stopListening();
    const result = scoreSpeaking(transcript, targetSentence);
    setScore(result);
    setSubmitted(true);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border rounded-xl shadow-sm space-y-4">
      <p className="text-xl font-medium text-center py-4">
        &ldquo;{targetSentence}&rdquo;
      </p>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={submitted}
          className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl transition-all
            ${isListening ? 'bg-red-500 animate-pulse scale-110' : 'bg-blue-500 hover:bg-blue-600'}
            disabled:opacity-50`}
        >
          {isListening ? '⏹' : '🎤'}
        </button>
        <p className="text-sm text-gray-500">
          {isListening ? 'Listening... tap to stop' : 'Tap to start recording'}
        </p>
      </div>

      {transcript && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm font-medium text-gray-500">You said:</p>
          <p className="text-lg">&ldquo;{transcript}&rdquo;</p>
        </div>
      )}

      {!submitted && transcript && (
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Submit
          </button>
          <button
            onClick={() => { startListening(); }}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Try Again
          </button>
        </div>
      )}

      {submitted && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{score}</span>
            <span className="text-gray-500">/ 100</span>
          </div>
          <button
            onClick={() => onComplete(score)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
```

**Step 2: Commit**
Run: `git add components/modules/Speaking.tsx && git commit -m "feat: add speaking component with start/stop toggle"`

---

### Task 7: Seed Data (7 Days of Content)

**Files:**
- Create: `scripts/seedData.ts`
- Create: `data/missions.json`

**Step 1: Create Mission Content File**

Create `data/missions.json` with at least 7 days of workplace-themed content. Each day should have:
- 3 dictation sentences
- 5 spelling words
- 2 speaking sentences

Themes: Day 1 (Project Management), Day 2 (Email Etiquette), Day 3 (Meeting Participation), Day 4 (Code Review), Day 5 (Client Communication), Day 6 (Presentations), Day 7 (Problem Solving).

Generate content using the AI assistant during development. Store as a JSON file for version control, then seed into Supabase.

**Step 2: Create Seed Script**
Create `scripts/seedData.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import missions from '../data/missions.json';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log(`Seeding ${missions.length} missions...`);

  for (const mission of missions) {
    const { error } = await supabase
      .from('missions')
      .upsert(mission, { onConflict: 'day_number' });

    if (error) {
      console.error(`Error seeding Day ${mission.day_number}:`, error.message);
    } else {
      console.log(`✓ Day ${mission.day_number}: ${mission.title}`);
    }
  }

  console.log('Done.');
}

seed();
```

Add a script to `package.json`:
```json
{
  "scripts": {
    "seed": "npx tsx scripts/seedData.ts"
  }
}
```

**Step 3: Commit**
Run: `git add data/ scripts/ package.json && git commit -m "chore: add 7-day seed data and seed script"`

---

### Task 8: Authentication (Supabase Auth)

**Files:**
- Create: `app/login/page.tsx`
- Create: `components/AuthGuard.tsx`
- Create: `hooks/useAuth.ts`
- Modify: `app/layout.tsx`

**Step 1: Create Auth Hook**
Create `hooks/useAuth.ts`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string) => {
    return supabase.auth.signUp({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return { user, loading, signIn, signUp, signOut };
}
```

**Step 2: Create Login Page**
Create `app/login/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">English Daily Practice</h1>
          <p className="text-gray-500 mt-2">{isSignUp ? 'Create an account' : 'Sign in to continue'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-blue-500 hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
```

**Step 3: Create Auth Guard**
Create `components/AuthGuard.tsx`:
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
```

**Step 4: Update Layout**
Modify `app/layout.tsx` to wrap `{children}` with `<AuthGuard>` for all routes except `/login`. The login page should be accessible without authentication, so use a conditional wrapper or route groups:
- Move authenticated pages into `app/(protected)/` route group with a layout that includes `<AuthGuard>`.
- Keep `app/login/page.tsx` outside the group so it's accessible without auth.

Alternatively, keep the flat structure and have the AuthGuard skip the redirect if the current path is `/login`.

**Step 5: Commit**
Run: `git add . && git commit -m "feat: add Supabase authentication"`

---

### Task 9: Progress Persistence

**Files:**
- Create: `lib/progress.ts`

**Why this comes before Dashboard:** The dashboard and mission runner both depend on progress functions. Build the data layer first.

**Step 1: Create Progress Service**
Create `lib/progress.ts` with functions:

```typescript
import { supabase } from './supabaseClient';

export async function getUserProgress(userId: string) {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*, missions(*)')
    .eq('user_id', userId)
    .order('missions(day_number)', { ascending: true });

  if (error) throw error;
  return data;
}

export async function ensureProgressInitialized(userId: string) {
  const { data: missions } = await supabase
    .from('missions')
    .select('id, day_number')
    .order('day_number', { ascending: true });

  if (!missions || missions.length === 0) return;

  const { data: existing } = await supabase
    .from('user_progress')
    .select('mission_id')
    .eq('user_id', userId);

  const existingIds = new Set((existing || []).map(p => p.mission_id));
  const toInsert = missions
    .filter(m => !existingIds.has(m.id))
    .map(m => ({
      user_id: userId,
      mission_id: m.id,
      status: m.day_number === 1 ? 'open' : 'locked',
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('user_progress')
      .insert(toInsert);
    if (error) throw error;
  }
}

export async function completeMission(
  userId: string,
  missionId: string,
  score: number,
  nextMissionId?: string
) {
  // On redo, keep the higher score
  const { data: existing } = await supabase
    .from('user_progress')
    .select('score')
    .eq('user_id', userId)
    .eq('mission_id', missionId)
    .single();

  const finalScore = existing ? Math.max(existing.score, score) : score;

  const { error: updateError } = await supabase
    .from('user_progress')
    .update({
      status: 'completed',
      score: finalScore,
      completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('mission_id', missionId);

  if (updateError) throw updateError;

  if (nextMissionId) {
    const { error: unlockError } = await supabase
      .from('user_progress')
      .update({ status: 'open' })
      .eq('user_id', userId)
      .eq('mission_id', nextMissionId)
      .eq('status', 'locked');

    if (unlockError) throw unlockError;
  }
}

export async function calculateStreak(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  if (error || !data || data.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedDates = data
    .map(p => {
      const d = new Date(p.completed_at!);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => b - a);

  const oneDayMs = 86400000;
  let expectedDate = today.getTime();

  for (const date of completedDates) {
    if (date === expectedDate || date === expectedDate - oneDayMs) {
      streak++;
      expectedDate = date - oneDayMs;
    } else {
      break;
    }
  }

  return streak;
}
```

**Step 2: Commit**
Run: `git add lib/progress.ts && git commit -m "feat: add progress persistence and streak calculation"`

---

### Task 10: Dashboard & Mission Flow

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/mission/[id]/page.tsx`

**Step 1: Improve Dashboard**
Update `app/page.tsx`:
- On first load, call `ensureProgressInitialized(user.id)` to create progress rows for any missions the user doesn't have rows for yet. This handles both new users and when new missions are added.
- Show user greeting and sign-out button.
- Fetch user's progress via `getUserProgress(user.id)`.
- Highlight "Today's Mission" (next open mission) at the top.
- Show all missions with status badges (locked 🔒, open 🟢, completed ✅) and scores.
- Show streak counter via `calculateStreak(user.id)`.

**Step 2: Improve Mission Runner**
Update `app/mission/[id]/page.tsx`:
- Add a progress bar at the top (e.g., "Step 2/10" with a visual bar).
- Reorder exercises: Spelling first (warm-up), then Dictation (focus), then Speaking (action).
- Replace `alert()` completion with a proper Summary screen showing score breakdown by module.
- On completion, call `completeMission(user.id, missionId, score, nextMissionId)` to save progress and unlock next day.
- Add a "Return to Dashboard" button on the summary screen.

**Step 3: Commit**
Run: `git add app/ && git commit -m "feat: dashboard with progress tracking and improved mission flow"`

---

### Task 11: PWA Configuration

**Files:**
- Create: `public/manifest.json`
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`

**Step 1: Install PWA package**
Run: `npm install @ducanh2912/next-pwa`
Note: The original `next-pwa` is unmaintained and incompatible with Next.js 14+. This is the actively maintained fork.

**Step 2: Create Web App Manifest**
Create `public/manifest.json`:
```json
{
  "name": "English Daily Practice",
  "short_name": "EnglishPWA",
  "description": "Daily English learning missions",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 3: Configure next-pwa**
Update `next.config.ts`:
```typescript
import withPWA from '@ducanh2912/next-pwa';

const nextConfig = {
  // existing config
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})(nextConfig);
```

**Step 4: Add manifest link to layout**
Add `<link rel="manifest" href="/manifest.json" />` to `app/layout.tsx` head.

**Step 5: Generate app icons**
Create 192x192 and 512x512 PNG icons for the PWA.

**Step 6: Commit**
Run: `git add . && git commit -m "feat: add PWA manifest and service worker"`

---

### Task 12: Polish & Final Testing

**Files:**
- Various component and page files.

**Step 1: Loading States**
Add skeleton loaders or spinners to the dashboard and mission pages while data is being fetched.

**Step 2: Error States**
Add error boundaries and user-friendly error messages when Supabase calls fail or content is malformed.

**Step 3: Mobile Responsiveness**
- Ensure all buttons are at least 44px touch targets.
- Test on mobile viewports (375px, 414px widths).
- Adjust padding from `p-24` to responsive values (`p-4 md:p-8 lg:p-24`).

**Step 4: Keyboard Accessibility**
- All interactive elements focusable.
- Enter key submits answers.
- Tab order is logical.

**Step 5: Final Commit**
Run: `git add . && git commit -m "polish: loading states, error handling, mobile responsiveness"`

---

### Architectural Amendments

> Apply these cross-cutting changes to the tasks above during implementation.

#### A. Auth Provider Pattern (replaces Task 8 approach)
Replace the standalone `useAuth` hook with an `AuthProvider` React context. Create `contexts/AuthContext.tsx` wrapping the app in `app/layout.tsx`. All components consume auth via `useContext(AuthContext)` — one Supabase subscription, not one per component.

#### B. LCS-Based Dictation Scoring (replaces Task 2 `scoreDictation`)
Replace positional word matching with longest-common-subsequence alignment. Positional matching fails when users skip a single word (e.g., omitting "the"), cascading errors through all subsequent positions. LCS alignment produces fair scores and accurate word-level diffs.

#### C. Responsive-First (applies to Tasks 4–6, 10)
Design all components mobile-first (375px base). Use `md:` for tablet, `lg:` for desktop. Minimum 44px touch targets. Use responsive padding (`p-4 md:p-6 lg:p-8`), not fixed values.

#### D. Animation & Feedback (applies to Tasks 4–6)
Every exercise component must include:
- Animated score counter (`ScoreDisplay` from Task 0)
- Border color transition on submit (green/amber/red)
- Smooth slide transition between exercise steps
- Optional sound feedback via Web Audio API (behind a settings toggle)

#### E. Inline Error Handling (applies to Tasks 3–6, 9–10)
Handle errors in each component, not deferred to Task 12:
- TTS failure → text fallback with "Audio unavailable" message
- STT failure → "Could not hear you" with retry button
- Supabase errors → toast notification with retry
- Malformed content → skip with "Content unavailable" message
