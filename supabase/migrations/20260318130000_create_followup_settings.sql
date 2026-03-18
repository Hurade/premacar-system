-- ================================================================
-- PARTE 1: Tabela de configuração de follow-up automático
-- ================================================================
create table followup_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  is_active boolean default false,
  message text not null default '',
  delay_hours integer not null default 20,
  tag_name text not null default 'FOLLOW-UP',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One config per user
create unique index followup_settings_user_id_idx on followup_settings(user_id);

-- RLS: each user sees/edits only their own config
alter table followup_settings enable row level security;

create policy "Users can manage their own followup settings" on followup_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_followup_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger followup_settings_updated_at
  before update on followup_settings
  for each row execute function update_followup_settings_updated_at();

-- ================================================================
-- PARTE 3: Remoção da tag de follow-up quando a janela expira
-- (Não existe status 'closed' — usamos window_status = 'expired')
-- ================================================================
create or replace function remove_followup_tag_on_window_expire()
returns trigger as $$
declare
  tag_to_remove text;
begin
  -- Only act when window_status changes TO 'expired'
  if new.window_status = 'expired' and (old.window_status is distinct from 'expired') then
    -- Iterate over all active followup tag_names and remove from contact's tags
    for tag_to_remove in
      select fs.tag_name from followup_settings fs where fs.is_active = true
    loop
      update contacts
      set tags = array_remove(tags, tag_to_remove)
      where id = new.contact_id
        and tags @> array[tag_to_remove];
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_remove_followup_tag_on_expire
  after update of window_status on conversations
  for each row execute function remove_followup_tag_on_window_expire();
