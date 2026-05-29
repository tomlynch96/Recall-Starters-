-- ============================================================
-- Recall Starters — Supabase Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- ── Static / reference tables (seeded from spreadsheet) ──────

create table if not exists lessons (
  lesson_id     text primary key,
  topic_id      text not null,
  topic_name    text not null,
  lesson_number text,
  lesson_title  text not null
);

create table if not exists questions (
  id            text primary key,
  lesson_id     text not null references lessons(lesson_id),
  topic_id      text not null,
  topic_name    text not null,
  lesson_number text,
  lesson_title  text not null,
  question      text not null,
  answer        text not null,
  scaffolded    text not null default ''
);

create table if not exists rotas (
  id           uuid primary key default gen_random_uuid(),
  rota_id      text not null,
  rota_name    text not null,
  lesson_id    text not null references lessons(lesson_id),
  lesson_order integer not null,
  unique (rota_id, lesson_order)
);

create table if not exists challenge_plus (
  lesson_id text primary key references lessons(lesson_id),
  question  text not null,
  answer    text
);

-- ── Live app tables ───────────────────────────────────────────

create table if not exists classes (
  id         uuid primary key default gen_random_uuid(),
  class_id   text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists teachers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  class_id   text references classes(class_id) on delete set null,
  rota_id    text,
  is_hod     boolean not null default false,
  created_at timestamptz default now()
);
-- Prevent duplicate class enrollments per user (nulls are excluded)
create unique index if not exists teachers_user_class
  on teachers(user_id, class_id) where class_id is not null;

create table if not exists question_log (
  id               uuid primary key default gen_random_uuid(),
  class_id         text not null references classes(class_id) on delete cascade,
  question_id      text not null references questions(id),
  times_seen       integer not null default 0,
  last_seen_lesson integer,
  next_due_lesson  integer not null default 0,
  flagged          boolean not null default false,
  flag_resolved    boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (class_id, question_id)
);

create table if not exists session_log (
  id           uuid primary key default gen_random_uuid(),
  class_id     text not null references classes(class_id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  teacher_email text not null,
  lesson_order integer not null,
  lesson_id    text references lessons(lesson_id),
  opened_at    timestamptz default now()
);

-- ── Useful indexes ────────────────────────────────────────────

create index if not exists question_log_class_id on question_log(class_id);
create index if not exists session_log_class_id  on session_log(class_id);
create index if not exists session_log_user_id   on session_log(user_id);
create index if not exists teachers_user_id      on teachers(user_id);

-- ── Helper functions (for RLS policies) ──────────────────────

create or replace function is_hod()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from teachers
    where user_id = auth.uid() and is_hod = true
  );
$$;

create or replace function my_class_ids()
returns setof text language sql security definer stable as $$
  select class_id from teachers
  where user_id = auth.uid() and class_id is not null;
$$;

-- ── Row-level security ────────────────────────────────────────

-- Static tables: authenticated users can read; no app writes
alter table lessons       enable row level security;
alter table questions     enable row level security;
alter table rotas         enable row level security;
alter table challenge_plus enable row level security;

create policy "authenticated read" on lessons        for select using (auth.role() = 'authenticated');
create policy "authenticated read" on questions      for select using (auth.role() = 'authenticated');
create policy "authenticated read" on rotas          for select using (auth.role() = 'authenticated');
create policy "authenticated read" on challenge_plus for select using (auth.role() = 'authenticated');

-- classes: any authenticated user reads; only HoD inserts/deletes
alter table classes enable row level security;
create policy "authenticated read" on classes for select using (auth.role() = 'authenticated');
create policy "hod insert"         on classes for insert with check (is_hod());
create policy "hod delete"         on classes for delete using (is_hod());

-- teachers: read own rows + HoD reads all; insert/update own rows
alter table teachers enable row level security;
create policy "read own or hod" on teachers for select
  using (user_id = auth.uid() or is_hod());
create policy "insert own"      on teachers for insert
  with check (user_id = auth.uid());
create policy "update own"      on teachers for update
  using (user_id = auth.uid());
create policy "delete own"      on teachers for delete
  using (user_id = auth.uid());

-- question_log: teachers enrolled in the class can read/write
alter table question_log enable row level security;
create policy "class member" on question_log for all
  using (class_id in (select my_class_ids()));

-- session_log: write own; read own or HoD
alter table session_log enable row level security;
create policy "insert own"      on session_log for insert
  with check (user_id = auth.uid());
create policy "read own or hod" on session_log for select
  using (user_id = auth.uid() or is_hod());
