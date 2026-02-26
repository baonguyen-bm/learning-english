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

create policy "Public profiles are viewable by everyone."
  on public.profiles for select using (true);
create policy "Users can insert their own profile."
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile."
  on public.profiles for update using (auth.uid() = id);

create policy "Missions are viewable by everyone."
  on public.missions for select using (true);

create policy "Users can view their own progress."
  on public.user_progress for select using (auth.uid() = user_id);
create policy "Users can update their own progress."
  on public.user_progress for update using (auth.uid() = user_id);
create policy "Users can insert their own progress."
  on public.user_progress for insert with check (auth.uid() = user_id);
