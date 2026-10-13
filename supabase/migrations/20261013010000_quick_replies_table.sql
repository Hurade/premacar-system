-- Respostas Rápidas viviam só no localStorage do navegador
-- (chave 'prema_quick_replies') — nunca sincronizavam entre dispositivos
-- nem entre membros da equipe, e sumiam com qualquer limpeza de cache,
-- troca de navegador/computador ou aba anônima. Tabela de verdade,
-- compartilhada entre a equipe (mesmo padrão de acesso de
-- tag_definitions — recurso compartilhado, não por usuário).
CREATE TABLE public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL,
  text text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can access quick_replies"
  ON public.quick_replies FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_replies TO authenticated;
GRANT SELECT ON public.quick_replies TO anon;
