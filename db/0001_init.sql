-- First schema: profiles and workout sessions, so a phone's localStorage can be
-- pushed to the server and read back on another device.

-- One row per signed-in user, keyed on the provider subject from the Auth.js JWT
-- ("sub"). Google's sub never changes; the email and display name can, so neither
-- is the key and neither is unique here.
create table if not exists profiles (
  id text primary key,
  email text not null,
  name text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A finished workout. The json is the whole client-side `Session`, because its
-- shape still changes often and the app always reads it whole; the columns beside
-- it exist only so the counting queries never have to open the json.
create table if not exists workout_sessions (
  -- Client-generated on the phone, so it is only unique per user: the id is paired
  -- with user_id in the key, which also stops one user overwriting another's row.
  id text not null,
  user_id text not null references profiles (id) on delete cascade,

  -- The instant the workout started, for ordering and for showing a time of day.
  started_at timestamptz not null,

  -- The calendar day the phone showed when the workout started, as the client
  -- computed it (see dayKey in src/lib/heatmap.ts). The heatmap groups by the
  -- user's local day, and the server cannot recover that from the instant alone:
  -- a 7am Malaysia workout is the previous day in UTC, and the offset changes
  -- when the user travels or a zone shifts its clocks. Storing the day the user
  -- actually saw keeps the server's counts identical to the phone's, and makes
  -- the grouping a plain column read instead of per-row timezone maths.
  started_on date not null,

  -- Kept so started_on can be audited or recomputed if a client ever sends a
  -- wrong day. Minutes east of UTC, e.g. +480 for Malaysia.
  started_offset_minutes smallint,

  ended_at timestamptz,
  routine_name text not null,

  -- isPlainRestDay(session) in src/lib/plans.ts: a rest day with nothing ticked.
  -- It is a column because such sessions must not count towards a day's tally.
  plain_rest_day boolean not null default false,

  -- The full `Session` from src/lib/types.ts.
  data jsonb not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, id)
);

-- Serves both counting queries, and only them:
--   one user's year of daily counts (heatmap):
--     select started_on, count(*) from workout_sessions
--     where user_id = $1 and not plain_rest_day and started_on >= $2
--     group by started_on
--   several users at once (the future leaderboard): same, with user_id = any($1).
-- Rest days never count, so they are left out of the index entirely; both queries
-- read only indexed columns, so neither has to touch the table or the json.
create index if not exists workout_sessions_user_day_idx
  on workout_sessions (user_id, started_on)
  where not plain_rest_day;

-- Serves the history list ("my sessions, newest first"), which the primary key
-- cannot: it is ordered by the client's random id, not by time.
create index if not exists workout_sessions_user_started_at_idx
  on workout_sessions (user_id, started_at desc);
