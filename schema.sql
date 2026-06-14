-- ============================================================
-- JARVIS / BENJI OS — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run: every table uses "create table if not exists".
-- ============================================================

-- 1. SETTINGS — generic key/value store for dashboard config
create table if not exists jarvis_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 2. KEY MANIFEST — which API keys are configured (NO raw secrets here,
--    only the service name + last 4 chars so every device knows what's set)
create table if not exists jarvis_key_manifest (
  service     text primary key,
  last4       text,
  is_set      boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- 3. NOTIFICATIONS — pipeline failures / alerts that surface in Jarvis
create table if not exists jarvis_notifications (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'info',      -- info | warning | error
  title       text not null,
  body        text,
  gate        text,                              -- which brand gate failed
  issues      jsonb,                             -- array of specific issues
  platform    text,                              -- instagram | tiktok | ...
  media_key   text,                              -- S3 key of held file
  media_type  text,                              -- image | video
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 4. DIRECTIVES — per-brand standing instructions
create table if not exists jarvis_directives (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null,
  text        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 5. RITUALS — recurring routines / scheduled habits
create table if not exists jarvis_rituals (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  schedule    text,                              -- cron or human text
  payload     jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 6. EVENTS — activity log / timeline
create table if not exists jarvis_events (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  data        jsonb,
  created_at  timestamptz not null default now()
);

-- 7. BRANDS — brand profiles (GotBeef, etc.)
create table if not exists jarvis_brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- 8. NOTES — free-form notes / scratchpad
create table if not exists jarvis_notes (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  body        text,
  tags        text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- REALTIME — let Jarvis subscribe to live notification inserts
-- ============================================================
alter publication supabase_realtime add table jarvis_notifications;

-- ============================================================
-- ROW LEVEL SECURITY
-- This setup turns RLS ON but allows the anon key full access, so
-- Jarvis works immediately with the anon key (no login required).
-- This is fine for a PRIVATE dashboard only you know the URL for.
-- If you later add Supabase Auth, replace these policies with ones
-- that check auth.uid() (see commented block at the bottom).
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'jarvis_settings','jarvis_key_manifest','jarvis_notifications',
    'jarvis_directives','jarvis_rituals','jarvis_events',
    'jarvis_brands','jarvis_notes'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "anon_all" on %I;', t);
    execute format(
      'create policy "anon_all" on %I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ============================================================
-- OPTIONAL (stricter) — require a logged-in user instead of open anon.
-- Only use this AFTER you enable Supabase Auth and create your login.
-- Uncomment, then re-run, to lock the tables down to authenticated users.
-- ------------------------------------------------------------
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'jarvis_settings','jarvis_key_manifest','jarvis_notifications',
--     'jarvis_directives','jarvis_rituals','jarvis_events',
--     'jarvis_brands','jarvis_notes'
--   ]
--   loop
--     execute format('drop policy if exists "anon_all" on %I;', t);
--     execute format('drop policy if exists "auth_all" on %I;', t);
--     execute format(
--       'create policy "auth_all" on %I for all to authenticated using (true) with check (true);',
--       t
--     );
--   end loop;
-- end $$;
-- ============================================================
