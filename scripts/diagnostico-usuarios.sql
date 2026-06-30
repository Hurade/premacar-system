-- ============================================================
-- DIAGNÓSTICO DE ACESSO DE USUÁRIOS - SDR Prema
-- Execute no SQL Editor do Supabase (painel > SQL Editor)
-- ============================================================

-- PASSO 1: Ver todos os usuários e sua situação no sistema
SELECT
  u.id                             AS auth_id,
  u.email,
  u.created_at::date               AS cadastrado_em,
  COALESCE(ur.role::text, 'sem role') AS app_role,
  COALESCE(tm.name, '—')           AS nome_equipe,
  COALESCE(tm.role::text, '—')     AS role_equipe,
  COALESCE(tm.status::text, '—')   AS status_equipe,
  CASE
    WHEN tm.id IS NULL             THEN '❌ SEM REGISTRO EM EQUIPE'
    WHEN tm.user_id IS NULL        THEN '⚠️  EQUIPE SEM USER_ID'
    WHEN tm.user_id != u.id        THEN '⚠️  USER_ID INCORRETO'
    ELSE '✅ OK'
  END AS situacao
FROM auth.users u
LEFT JOIN public.user_roles    ur ON ur.user_id = u.id
LEFT JOIN public.team_members  tm ON tm.email   = u.email
ORDER BY u.created_at;


-- ============================================================
-- PASSO 2: CORREÇÃO — rodar após confirmar o diagnóstico
-- ============================================================

-- 2a. Vincular user_id nos registros de equipe que estão sem link
UPDATE public.team_members tm
SET
  user_id    = u.id,
  status     = 'active'::member_status,
  updated_at = now()
FROM auth.users u
WHERE tm.email = u.email
  AND tm.user_id IS NULL;

-- 2b. Criar registros de equipe para usuários que não têm nenhum
INSERT INTO public.team_members (name, email, role, status, user_id)
SELECT
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  )                AS name,
  u.email,
  'agent'          AS role,
  'active'         AS status,
  u.id             AS user_id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm WHERE tm.email = u.email
)
ON CONFLICT (email) DO UPDATE
  SET user_id    = EXCLUDED.user_id,
      status     = 'active'::member_status,
      updated_at = now();

-- 2c. Garantir que todos têm role em user_roles (admin ou user)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
)
ON CONFLICT DO NOTHING;


-- ============================================================
-- PASSO 3: Verificar resultado final
-- ============================================================
SELECT
  u.email,
  ur.role                        AS app_role,
  tm.name                        AS nome,
  tm.role                        AS role_equipe,
  tm.status                      AS status,
  CASE WHEN tm.user_id = u.id THEN '✅' ELSE '❌' END AS user_id_ok
FROM auth.users u
LEFT JOIN public.user_roles    ur ON ur.user_id = u.id
LEFT JOIN public.team_members  tm ON tm.email   = u.email
ORDER BY u.created_at;
