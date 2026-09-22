
-- 1. Criar trigger que dispara handle_new_user ao cadastrar novo usuário
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Inserir usuários que já existem no auth mas não em team_members
-- (correção pontual para dois usuários reais do projeto original — os
-- user_id só existem lá; num projeto novo sem esses auth.users ainda
-- migrados, o INSERT é pulado em vez de falhar por FK. A tabela
-- team_members em si é migrada com os dados reais depois, junto do
-- restante do banco.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '5cac5d8b-bc3d-463f-99b6-fd8aed671a4e')
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = '819be9cf-1d27-46d2-9bca-8f4eaa4a89d0') THEN
    INSERT INTO public.team_members (name, email, role, status, user_id)
    VALUES
      ('Tamires', 'tamires@premacar.com', 'agent', 'active', '5cac5d8b-bc3d-463f-99b6-fd8aed671a4e'),
      ('Tamiris', 'tamiriscardoso86@gmail.com', 'agent', 'active', '819be9cf-1d27-46d2-9bca-8f4eaa4a89d0')
    ON CONFLICT (email) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          status = 'active'::member_status,
          updated_at = now();
  END IF;
END $$;
