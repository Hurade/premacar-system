-- ============================================================
-- Schema Espelho para RDS PostgreSQL (Backup do Lovable Cloud)
-- Execute este script no seu banco RDS para criar as tabelas
-- ============================================================

-- Tabela de log de sincronizacao
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    records_synced INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running',
    error_message TEXT
);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY,
    phone_number TEXT NOT NULL,
    whatsapp_id TEXT,
    name TEXT,
    call_name TEXT,
    email TEXT,
    profile_picture_url TEXT,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    oficina TEXT,
    is_business BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    blocked_at TIMESTAMPTZ,
    blocked_reason TEXT,
    client_memory JSONB,
    disparo_enabled BOOLEAN DEFAULT false,
    folder_id UUID,
    user_id UUID,
    first_contact_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_updated ON contacts(updated_at);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    contact_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'nina',
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_team TEXT,
    assigned_user_id UUID,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    nina_context JSONB DEFAULT '{}',
    api_source TEXT DEFAULT 'evolution',
    dispatch_sent_at TIMESTAMPTZ,
    user_id UUID,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    whatsapp_message_id TEXT,
    content TEXT,
    type TEXT NOT NULL DEFAULT 'text',
    from_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    media_url TEXT,
    media_type TEXT,
    reply_to_id UUID,
    processed_by_nina BOOLEAN DEFAULT false,
    nina_response_time INTEGER,
    metadata JSONB DEFAULT '{}',
    api_source TEXT DEFAULT 'evolution',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT,
    value NUMERIC DEFAULT 0,
    stage TEXT DEFAULT 'new',
    stage_id UUID NOT NULL,
    priority TEXT DEFAULT 'medium',
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    due_date DATE,
    contact_id UUID,
    owner_id UUID,
    user_id UUID,
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    lost_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);

-- ============================================================
-- DEAL ACTIVITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_activities (
    id UUID PRIMARY KEY,
    deal_id UUID NOT NULL,
    type TEXT NOT NULL DEFAULT 'note',
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON deal_activities(deal_id);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    duration INTEGER NOT NULL DEFAULT 60,
    type TEXT NOT NULL DEFAULT 'meeting',
    description TEXT,
    attendees TEXT[] DEFAULT '{}',
    contact_id UUID,
    user_id UUID,
    meeting_url TEXT,
    status TEXT DEFAULT 'scheduled',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    user_id UUID,
    template_id UUID,
    meta_template_id UUID,
    api_source TEXT DEFAULT 'meta',
    daily_limit INTEGER NOT NULL DEFAULT 100,
    interval_min INTEGER NOT NULL DEFAULT 60,
    interval_max INTEGER NOT NULL DEFAULT 180,
    interval_type TEXT NOT NULL DEFAULT 'random',
    business_hours_enabled BOOLEAN NOT NULL DEFAULT true,
    business_hours_start TIME DEFAULT '09:00',
    business_hours_end TIME DEFAULT '18:00',
    business_days INTEGER[] DEFAULT '{1,2,3,4,5}',
    anti_ban_enabled BOOLEAN NOT NULL DEFAULT true,
    pause_after_count INTEGER DEFAULT 50,
    pause_duration_minutes INTEGER DEFAULT 15,
    scheduled_start TIMESTAMPTZ,
    paused_until TIMESTAMPTZ,
    tag_on_delivered TEXT,
    tag_on_no_whatsapp TEXT,
    total_leads INTEGER DEFAULT 0,
    sent_today INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_read INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ============================================================
-- CAMPAIGN LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_leads (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL,
    phone TEXT NOT NULL,
    name TEXT,
    company TEXT,
    city TEXT,
    product TEXT,
    custom1 TEXT,
    custom2 TEXT,
    custom3 TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    variation_used INTEGER,
    error_message TEXT,
    whatsapp_message_id TEXT,
    attempts INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);

-- ============================================================
-- NINA SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS nina_settings (
    id UUID PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT true,
    auto_response_enabled BOOLEAN NOT NULL DEFAULT true,
    adaptive_response_enabled BOOLEAN NOT NULL DEFAULT true,
    message_breaking_enabled BOOLEAN NOT NULL DEFAULT true,
    message_grouping_enabled BOOLEAN DEFAULT true,
    message_grouping_delay INTEGER DEFAULT 20000,
    response_delay_min INTEGER NOT NULL DEFAULT 1000,
    response_delay_max INTEGER NOT NULL DEFAULT 3000,
    business_hours_start TIME NOT NULL DEFAULT '09:00',
    business_hours_end TIME NOT NULL DEFAULT '18:00',
    business_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    company_name TEXT,
    sdr_name TEXT,
    ai_model_mode TEXT DEFAULT 'flash',
    ai_scheduling_enabled BOOLEAN DEFAULT true,
    ai_activation_delay_minutes INTEGER DEFAULT 5,
    async_booking_enabled BOOLEAN DEFAULT false,
    audio_response_enabled BOOLEAN DEFAULT false,
    route_all_to_receiver_enabled BOOLEAN NOT NULL DEFAULT false,
    system_prompt_override TEXT,
    test_system_prompt TEXT,
    test_phone_numbers JSONB,
    user_id UUID,
    -- WhatsApp / Meta
    whatsapp_access_token TEXT,
    whatsapp_phone_number_id TEXT,
    whatsapp_verify_token TEXT,
    whatsapp_business_account_id TEXT,
    meta_api_enabled BOOLEAN DEFAULT false,
    meta_phone_number_id TEXT,
    meta_access_token TEXT,
    meta_business_account_id TEXT,
    meta_app_secret TEXT,
    -- Evolution
    evolution_api_enabled BOOLEAN DEFAULT true,
    evolution_api_url TEXT,
    evolution_api_key TEXT,
    evolution_instance_name TEXT,
    -- ElevenLabs
    elevenlabs_api_key TEXT,
    elevenlabs_voice_id TEXT DEFAULT '33B4UnXyTNbgLmdEDh5P',
    elevenlabs_model TEXT DEFAULT 'eleven_turbo_v2_5',
    elevenlabs_stability NUMERIC DEFAULT 0.75,
    elevenlabs_similarity_boost NUMERIC DEFAULT 0.80,
    elevenlabs_style NUMERIC DEFAULT 0.30,
    elevenlabs_speaker_boost BOOLEAN DEFAULT true,
    elevenlabs_speed NUMERIC DEFAULT 1.0,
    -- Scheduling
    scheduling_available_days INTEGER[] DEFAULT '{1,2,3,4}',
    scheduling_start_time TIME DEFAULT '09:00',
    scheduling_end_time TIME DEFAULT '12:00',
    scheduling_slot_duration INTEGER DEFAULT 30,
    scheduling_buffer_between INTEGER DEFAULT 0,
    google_calendar_url TEXT,
    --
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

-- ============================================================
-- PIPELINE STAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'border-slate-500',
    position INTEGER NOT NULL DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_ai_managed BOOLEAN DEFAULT false,
    ai_trigger_criteria TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_position ON pipeline_stages(position);

-- ============================================================
-- TAG DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS tag_definitions (
    id UUID PRIMARY KEY,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    category TEXT NOT NULL DEFAULT 'custom',
    is_active BOOLEAN NOT NULL DEFAULT true,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT true,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TEAM FUNCTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS team_functions (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    status TEXT NOT NULL DEFAULT 'invited',
    avatar TEXT,
    team_id UUID,
    function_id UUID,
    weight INTEGER DEFAULT 1,
    last_active TIMESTAMPTZ,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
-- Apos executar este script, configure o secret RDS_DATABASE_URL
-- no Lovable Cloud com a string de conexao do seu RDS.
-- Ex: postgresql://usuario:senha@host-rds.amazonaws.com:5432/nome_do_banco
