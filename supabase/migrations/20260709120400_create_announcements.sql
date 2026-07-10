-- ============================================================
-- Anúncios internos + Histórico de Avisos.
--
-- Composição (admin, aba "Anúncios" em Settings) grava em
-- `announcements`. Todos os usuários veem o feed em /avisos e
-- marcam leitura por linha em `announcement_reads` (contagem de
-- não lidos = anúncios ativos sem linha correspondente do
-- usuário atual).
-- ============================================================

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.announcement_reads (
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX idx_announcements_is_active ON public.announcements(is_active, created_at DESC);
CREATE INDEX idx_announcement_reads_user_id ON public.announcement_reads(user_id);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage announcement_reads"
  ON public.announcement_reads FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
