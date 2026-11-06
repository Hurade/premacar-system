-- Quando o nome de um contato é editado, propaga para o título dos deals
-- dele — mas só os que ainda tiverem o título "padrão" (igual ao nome
-- antigo do contato), pra nunca sobrescrever um título que alguém
-- customizou de verdade pra algo diferente do nome do contato.
CREATE OR REPLACE FUNCTION public.sync_deal_title_on_contact_rename()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.deals
    SET title = NEW.name, updated_at = now()
    WHERE contact_id = NEW.id AND title = OLD.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_deal_title_on_contact_rename ON public.contacts;
CREATE TRIGGER trg_sync_deal_title_on_contact_rename
  AFTER UPDATE OF name ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_deal_title_on_contact_rename();
