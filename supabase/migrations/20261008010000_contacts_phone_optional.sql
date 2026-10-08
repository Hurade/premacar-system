-- contacts.phone_number era NOT NULL, impedindo a existência de um contato
-- "só e-mail" (ex: leads antigos importados de uma lista só-e-mail, sem
-- WhatsApp conhecido). O unique index já trata múltiplos NULLs como
-- distintos no Postgres, então só precisa derrubar o NOT NULL — nada mais
-- muda no schema.
ALTER TABLE public.contacts ALTER COLUMN phone_number DROP NOT NULL;
