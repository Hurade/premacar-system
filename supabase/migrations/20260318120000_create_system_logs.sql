-- Create system_logs table for application monitoring
create table system_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  source text not null,
  level text not null check (level in ('info', 'error', 'warning')),
  message text not null,
  metadata jsonb,
  user_id uuid references auth.users(id)
);

-- Indexes for filtering performance
create index system_logs_created_at_idx on system_logs(created_at desc);
create index system_logs_source_idx on system_logs(source);
create index system_logs_level_idx on system_logs(level);

-- Enable RLS
alter table system_logs enable row level security;

-- Authenticated users see their own logs + system logs (user_id is null)
create policy "Authenticated users can view logs" on system_logs
  for select using (
    auth.role() = 'authenticated' and (user_id is null or auth.uid() = user_id)
  );

-- Allow authenticated users to insert their own logs
create policy "Authenticated users can insert their own logs" on system_logs
  for insert with check (
    auth.role() = 'authenticated' and (user_id is null or auth.uid() = user_id)
  );
