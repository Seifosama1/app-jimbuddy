-- Supabase Schema: Jim Buddy — Full Database Setup
-- Run this entire file in the Supabase SQL Editor once to set up all tables.

-- ══════════════════════════════════════════
-- 1. leaderboard table
--    Stores public profile + stats for each user.
--    user_id is stored as TEXT matching auth.uid()::text
--    so that the app can do simple equality checks without casting.
-- ══════════════════════════════════════════
create table if not exists leaderboard (
  user_id       text primary key,
  username      text not null,
  avatar        text,
  streak        integer default 0,
  pr_count      integer default 0,
  total_volume  integer default 0,
  top_pr_name   text,
  top_pr_weight integer default 0,
  weekly_split  jsonb,
  updated_at    timestamptz default now()
);

-- Add weekly_split column to existing leaderboard tables (safe to run multiple times)
alter table leaderboard add column if not exists weekly_split jsonb;

alter table leaderboard enable row level security;

-- Anyone (including anonymous) can read the leaderboard
create policy "anyone can read leaderboard" on leaderboard
  for select using (true);

-- Each authenticated user can only write their own row
create policy "users manage own leaderboard row" on leaderboard
  for all
  using  (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);


-- ══════════════════════════════════════════
-- 2. user_data table
--    Stores each user's full workout/profile data as JSONB.
--    One row per user, upserted on every cloud sync.
-- ══════════════════════════════════════════
create table if not exists user_data (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table user_data enable row level security;

-- Users can only read/write their own data
create policy "users can read own data" on user_data
  for select using (auth.uid() = user_id);

create policy "users can insert own data" on user_data
  for insert with check (auth.uid() = user_id);

create policy "users can update own data" on user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ══════════════════════════════════════════
-- Gymbros Social Update (Friends, Requests, Real-time Chat)
-- ══════════════════════════════════════════

-- 1. friend_requests table
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users not null,
  receiver_id uuid references auth.users not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (sender_id, receiver_id)
);

-- Enable RLS for friend_requests
alter table friend_requests enable row level security;

-- Policies for friend_requests
create policy "Users can select own requests" on friend_requests
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can insert own requests" on friend_requests
  for insert with check (auth.uid() = sender_id);

create policy "Users can update own requests" on friend_requests
  for update using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);


-- 2. friends table
create table if not exists friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  friend_id uuid references auth.users not null,
  created_at timestamptz default now(),
  unique (user_id, friend_id)
);

-- Enable RLS for friends
alter table friends enable row level security;

-- Policies for friends
create policy "Users can select own friendships" on friends
  for select using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can insert own friendships" on friends
  for insert with check (
    (auth.uid() = user_id or auth.uid() = friend_id)
    and exists (
      select 1 from friend_requests
      where (
        (sender_id = user_id and receiver_id = friend_id)
        or (sender_id = friend_id and receiver_id = user_id)
      )
      and status = 'accepted'
    )
  );


-- 3. chats table
create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid references auth.users not null,
  user2_id uuid references auth.users not null,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  constraint user1_less_than_user2 check (user1_id < user2_id),
  unique (user1_id, user2_id)
);

-- Enable RLS for chats
alter table chats enable row level security;

-- Policies for chats
create policy "Users can select own chats" on chats
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "Users can insert own chats" on chats
  for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "Users can update own chats" on chats
  for update using (auth.uid() = user1_id or auth.uid() = user2_id)
  with check (auth.uid() = user1_id or auth.uid() = user2_id);


-- 4. messages table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats(id) on delete cascade not null,
  sender_id uuid references auth.users not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS for messages
alter table messages enable row level security;

-- Policies for messages
create policy "Users can select messages in own chats" on messages
  for select using (
    exists (
      select 1 from chats 
      where chats.id = messages.chat_id 
      and (auth.uid() = chats.user1_id or auth.uid() = chats.user2_id)
    )
  );

create policy "Users can insert messages in own chats" on messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from chats 
      where chats.id = messages.chat_id 
      and (auth.uid() = chats.user1_id or auth.uid() = chats.user2_id)
    )
  );

create policy "Users can delete own messages" on messages
  for delete using (
    auth.uid() = sender_id
  );

create policy "Users can update messages in own chats" on messages
  for update using (
    exists (
      select 1 from chats 
      where chats.id = messages.chat_id 
      and (auth.uid() = chats.user1_id or auth.uid() = chats.user2_id)
    )
  ) with check (
    exists (
      select 1 from chats 
      where chats.id = messages.chat_id 
      and (auth.uid() = chats.user1_id or auth.uid() = chats.user2_id)
    )
  );


-- 5. user_status table
create table if not exists user_status (
  user_id uuid primary key references auth.users on delete cascade,
  is_online boolean default false,
  last_seen timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS for user_status
alter table user_status enable row level security;

-- Policies for user_status
create policy "Anyone can select statuses" on user_status
  for select using (true);

create policy "Users can insert own status" on user_status
  for insert with check (auth.uid() = user_id);

create policy "Users can update own status" on user_status
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 6. Enable Realtime (create publication if needed, and add tables)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table messages;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table user_status;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table leaderboard;
  exception
    when duplicate_object then null;
  end;
end $$;
