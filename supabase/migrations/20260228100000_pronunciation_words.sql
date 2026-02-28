-- Pronunciation Word Bank: stores words users mispronounced during Speaking exercises
CREATE TABLE public.pronunciation_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  phonetic TEXT,
  best_score INT DEFAULT 0,
  last_score INT DEFAULT 0,
  times_practiced INT DEFAULT 0,
  phonemes_json JSONB,
  source_mission_id UUID REFERENCES public.missions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_practiced_at TIMESTAMPTZ,
  UNIQUE(user_id, word)
);

CREATE INDEX idx_pronunciation_words_user
  ON public.pronunciation_words (user_id, last_practiced_at DESC);

ALTER TABLE public.pronunciation_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pronunciation words"
  ON public.pronunciation_words FOR ALL
  USING (auth.uid() = user_id);
