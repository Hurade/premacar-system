-- deals tinha índice em owner_id e stage_id, mas não em contact_id — usado
-- em merge_contacts() (UPDATE deals SET contact_id=... WHERE contact_id=...)
-- e em qualquer busca futura de "deals deste contato". Com 7700+ linhas na
-- tabela, essas operações caíam em sequential scan.
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals USING btree (contact_id);
