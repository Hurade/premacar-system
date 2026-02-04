-- Fix cascaded deletes for remaining FK constraints blocking contact deletion

-- send_queue FKs
ALTER TABLE public.send_queue
  DROP CONSTRAINT IF EXISTS send_queue_message_id_fkey,
  DROP CONSTRAINT IF EXISTS send_queue_conversation_id_fkey,
  DROP CONSTRAINT IF EXISTS send_queue_contact_id_fkey;

ALTER TABLE public.send_queue
  ADD CONSTRAINT send_queue_message_id_fkey
    FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE,
  ADD CONSTRAINT send_queue_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD CONSTRAINT send_queue_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

-- nina_processing_queue FKs
ALTER TABLE public.nina_processing_queue
  DROP CONSTRAINT IF EXISTS nina_processing_queue_message_id_fkey,
  DROP CONSTRAINT IF EXISTS nina_processing_queue_conversation_id_fkey,
  DROP CONSTRAINT IF EXISTS nina_processing_queue_contact_id_fkey;

ALTER TABLE public.nina_processing_queue
  ADD CONSTRAINT nina_processing_queue_message_id_fkey
    FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE,
  ADD CONSTRAINT nina_processing_queue_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD CONSTRAINT nina_processing_queue_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

-- conversation_states FK
ALTER TABLE public.conversation_states
  DROP CONSTRAINT IF EXISTS conversation_states_conversation_id_fkey;

ALTER TABLE public.conversation_states
  ADD CONSTRAINT conversation_states_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- messages self-reference (avoid delete ordering issues)
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_reply_to_id_fkey
    FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL;


-- Security: replace permissive queue RLS policies (true) with admin-only policies

ALTER TABLE public.message_grouping_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nina_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on message_grouping_queue" ON public.message_grouping_queue;
DROP POLICY IF EXISTS "Allow all operations on message_processing_queue" ON public.message_processing_queue;
DROP POLICY IF EXISTS "Allow all operations on nina_processing_queue" ON public.nina_processing_queue;
DROP POLICY IF EXISTS "Allow all operations on send_queue" ON public.send_queue;

CREATE POLICY "Admins can manage message_grouping_queue"
  ON public.message_grouping_queue
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage message_processing_queue"
  ON public.message_processing_queue
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage nina_processing_queue"
  ON public.nina_processing_queue
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage send_queue"
  ON public.send_queue
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));