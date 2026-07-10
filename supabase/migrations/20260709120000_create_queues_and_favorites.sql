-- ============================================================
-- Filas de atendimento (roteamento/categorização de conversas) +
-- Favoritos em conversas.
--
-- Fila é só uma camada de categorização/filtro por cima da
-- atribuição individual existente (conversations.assigned_user_id,
-- já sincronizada com deals.owner_id via round-robin ponderado).
-- Não substitui nem altera essa lógica.
-- ============================================================

CREATE TABLE public.queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#652c90',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations
  ADD COLUMN queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_conversations_queue_id ON public.conversations(queue_id);
CREATE INDEX idx_conversations_is_favorite ON public.conversations(is_favorite) WHERE is_favorite = true;

ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage queues"
  ON public.queues FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Seed opcional de filas comuns, para o cliente já ver algo ao abrir a tela
INSERT INTO public.queues (name, color) VALUES
  ('Comercial', '#a4dd00'),
  ('Suporte', '#d33115'),
  ('Financeiro', '#1273de'),
  ('Pós-venda', '#7b64ff');
