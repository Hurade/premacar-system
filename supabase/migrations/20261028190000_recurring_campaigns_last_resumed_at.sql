-- Sem isso, o auto-pause por taxa de erro olhava sempre as últimas N
-- entradas de system_logs (por created_at, sem limite de tempo) pra decidir
-- se repausa — incluindo envios de ANTES da campanha ter sido retomada
-- (ex: de uma causa já corrigida, como template com parâmetro errado).
-- Resultado: a campanha se auto-retomava e se auto-repausava de novo no
-- ciclo seguinte, antes de qualquer envio novo conseguir "lavar" a janela
-- de erro antiga — um drip-feed de 1 envio a cada hora em vez de voltar
-- a funcionar normalmente. Com last_resumed_at, a checagem de erro passa
-- a considerar só envios feitos depois do retomar mais recente.
ALTER TABLE public.recurring_campaigns
  ADD COLUMN IF NOT EXISTS last_resumed_at timestamptz;
