
-- Fix the FK constraint on deals.owner_id to SET NULL on delete
-- This prevents the error when deleting a team_member that is referenced in deals
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_owner_id_fkey;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.team_members(id) ON DELETE SET NULL;
