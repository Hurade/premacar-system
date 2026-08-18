-- ============================================================
-- Tags como "Trafego Pago" e "nutrir prema 5.4" (vindas da importação
-- do Whaticket) e outras aplicadas por código (ex: TRANSFERIDO-<FILA>,
-- BOT-SUSPEITO) nunca passaram por Configurações > Tags — só existem
-- como texto solto em contacts.tags, sem linha correspondente em
-- tag_definitions. Por isso não aparecem lá pra gerenciar.
--
-- PARTE 1: backfill — cria a definição pra toda tag já em uso que
-- ainda não tem uma (comparação por label, sem diferenciar
-- maiúsculas/minúsculas, já que é isso que o app mostra/compara hoje).
--
-- PARTE 2: trigger — a partir de agora, toda vez que uma tag nova
-- aparecer em contacts.tags (import, IA, uso manual, o que for), ganha
-- uma linha automática em tag_definitions, pra nunca mais precisar
-- deste backfill de novo.
-- ============================================================

DO $$
DECLARE
  v_tag TEXT;
  v_key TEXT;
BEGIN
  FOR v_tag IN
    SELECT DISTINCT t
    FROM public.contacts, unnest(tags) AS t
    WHERE t IS NOT NULL AND btrim(t) <> ''
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.tag_definitions td
      WHERE lower(td.label) = lower(v_tag) OR lower(td.key) = lower(v_tag)
    ) THEN
      CONTINUE;
    END IF;

    v_key := lower(regexp_replace(v_tag, '[^a-zA-Z0-9]+', '_', 'g'));
    v_key := trim(both '_' from v_key);
    IF v_key = '' THEN
      v_key := 'tag_' || substr(md5(v_tag), 1, 8);
    END IF;

    -- Sem ON CONFLICT: a constraint UNIQUE em tag_definitions.key que os
    -- arquivos de migration deste repo assumem não existe de fato no banco
    -- de produção (esquema divergiu em algum ponto) — o EXISTS acima já
    -- evita duplicata dentro deste laço.
    INSERT INTO public.tag_definitions (key, label, color, category, is_active)
    VALUES (v_key, v_tag, 'border-slate-500', 'custom', true);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sync_tag_definitions_from_contact_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tag TEXT;
  v_key TEXT;
BEGIN
  IF NEW.tags IS NULL OR array_length(NEW.tags, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_tag IN ARRAY NEW.tags LOOP
    IF v_tag IS NULL OR btrim(v_tag) = '' THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.tag_definitions td
      WHERE lower(td.label) = lower(v_tag) OR lower(td.key) = lower(v_tag)
    ) THEN
      CONTINUE;
    END IF;

    v_key := lower(regexp_replace(v_tag, '[^a-zA-Z0-9]+', '_', 'g'));
    v_key := trim(both '_' from v_key);
    IF v_key = '' THEN
      v_key := 'tag_' || substr(md5(v_tag), 1, 8);
    END IF;

    INSERT INTO public.tag_definitions (key, label, color, category, is_active)
    VALUES (v_key, v_tag, 'border-slate-500', 'custom', true);
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_tag_definitions_from_contact_tags ON public.contacts;
CREATE TRIGGER trg_sync_tag_definitions_from_contact_tags
AFTER INSERT OR UPDATE OF tags ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_tag_definitions_from_contact_tags();
