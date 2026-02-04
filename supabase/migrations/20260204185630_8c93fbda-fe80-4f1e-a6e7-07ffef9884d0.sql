-- Drop existing foreign key constraints and recreate with CASCADE
-- This will allow deleting contacts to cascade to conversations and all related data

-- First, let's handle the message_grouping_queue constraint
ALTER TABLE public.message_grouping_queue 
DROP CONSTRAINT IF EXISTS message_grouping_queue_message_id_fkey;

ALTER TABLE public.message_grouping_queue
ADD CONSTRAINT message_grouping_queue_message_id_fkey 
FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

-- Handle messages -> conversations constraint
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;

ALTER TABLE public.messages
ADD CONSTRAINT messages_conversation_id_fkey
FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Handle conversations -> contacts constraint
ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_contact_id_fkey;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_contact_id_fkey
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

-- Handle deals -> contacts constraint
ALTER TABLE public.deals
DROP CONSTRAINT IF EXISTS deals_contact_id_fkey;

ALTER TABLE public.deals
ADD CONSTRAINT deals_contact_id_fkey
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

-- Handle appointments -> contacts constraint
ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_contact_id_fkey;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_contact_id_fkey
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;