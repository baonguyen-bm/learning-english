-- ==========================================================================
-- Deeper Learning & Analytics Migration
-- Adds: exercise_results, vocabulary, difficulty support, SRS, upsert fn
-- ==========================================================================

-- 1. New tables

create table public.exercise_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  mission_id uuid references public.missions,
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

-- 4. DELETE policy for user_progress (needed by switchDifficulty)

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
  insert into public.vocabulary (
    user_id, word, definition, phonetic, syllables,
    times_practiced, best_score, last_practiced_at,
    next_review_at, srs_interval
  )
  values (
    p_user_id, p_word, p_definition, p_phonetic, p_syllables,
    1, p_score, now(),
    case when p_score < 75 then now() + interval '1 day' else null end,
    1
  )
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
