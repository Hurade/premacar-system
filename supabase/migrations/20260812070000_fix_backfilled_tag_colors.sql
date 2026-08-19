-- O backfill anterior (20260812060000) gravou 'border-slate-500' como cor
-- padrão nas tags criadas automaticamente — um nome de classe Tailwind, não
-- um hex. tag_definitions.color é sempre usado como valor CSS de verdade
-- (ex: `${tag.color}20` pra opacidade), então essa string inválida quebrava
-- silenciosamente e a tag caía no visual genérico em vez da cor própria.
-- Troca pelo hex equivalente (slate-500) só nas linhas que ainda têm o
-- valor quebrado — quem já tinha cor própria (ex: "Cliente") não é tocado.
UPDATE public.tag_definitions
SET color = '#64748b'
WHERE color = 'border-slate-500';

-- Mesma correção na função do trigger, pra não voltar a criar tags com
-- cor quebrada daqui pra frente.
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
    VALUES (v_key, v_tag, '#64748b', 'custom', true);
  END LOOP;

  RETURN NEW;
END;
$function$;
