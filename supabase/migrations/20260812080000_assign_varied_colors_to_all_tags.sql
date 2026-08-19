-- ============================================================
-- A correção anterior (20260812070000) só trocou 'border-slate-500'
-- por um cinza único fixo. Só que apareceu, em paralelo, um outro lote
-- de ~90 tags (provavelmente de outra sincronização rodada por outra
-- pessoa no mesmo dia) — várias delas também com esse valor quebrado.
--
-- Em vez de um cinza plano pra todo mundo, distribui cores da MESMA
-- paleta que TagManager/AgentSettings já usam no resto do app, uma por
-- tag em ordem estável (por created_at, id) — assim tags diferentes
-- ficam visualmente diferentes.
-- ============================================================

WITH palette AS (
  SELECT color, ord - 1 AS idx
  FROM unnest(ARRAY['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'])
       WITH ORDINALITY AS t(color, ord)
),
to_fix AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) - 1 AS rn
  FROM public.tag_definitions
  WHERE color !~ '^#[0-9a-fA-F]{6}$'
)
UPDATE public.tag_definitions td
SET color = p.color
FROM to_fix f
JOIN palette p ON p.idx = f.rn % 8
WHERE td.id = f.id;

-- Mesma paleta pro trigger, escolhendo por hash do texto da tag (em vez
-- de gray fixo) — assim tags novas criadas automaticamente daqui pra
-- frente também saem com cor variada.
CREATE OR REPLACE FUNCTION public.sync_tag_definitions_from_contact_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tag TEXT;
  v_key TEXT;
  v_palette TEXT[] := ARRAY['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
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
    VALUES (v_key, v_tag, v_palette[(abs(hashtext(v_tag)) % 8) + 1], 'custom', true);
  END LOOP;

  RETURN NEW;
END;
$function$;
