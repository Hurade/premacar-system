-- Respostas rápidas podem ser globais (visíveis/editáveis por toda a
-- equipe) ou individuais (só quem criou vê/edita) — distinção que o
-- próprio usuário já usa na prática (ex: saudação pessoal "aqui é o
-- Marco" vs. dado de acesso genérico pra qualquer atendente usar).
ALTER TABLE public.quick_replies
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'individual'));

DROP POLICY IF EXISTS "Authenticated users can access quick_replies" ON public.quick_replies;

CREATE POLICY "View global or own individual quick_replies"
  ON public.quick_replies FOR SELECT
  USING (scope = 'global' OR created_by = auth.uid());

CREATE POLICY "Insert own quick_replies"
  ON public.quick_replies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Update global or own individual quick_replies"
  ON public.quick_replies FOR UPDATE
  USING (scope = 'global' OR created_by = auth.uid())
  WITH CHECK (scope = 'global' OR created_by = auth.uid());

CREATE POLICY "Delete global or own individual quick_replies"
  ON public.quick_replies FOR DELETE
  USING (scope = 'global' OR created_by = auth.uid());
