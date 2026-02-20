
# Two Issues to Fix: Auto-Sync Users to Team + Admin Password Reset

## Problem 1: New Users Not Appearing in Team

When a new user signs up (e.g. `tamires@premacar.com`), the system creates an `auth.users` record and a `profiles` record — but **never creates a `team_members` record**. The Team screen only shows people who exist in `team_members`, so new users are invisible.

There are two parts to this fix:

**A) Auto-sync existing & future auth users to team_members**
A database trigger (`handle_new_user`) already runs on signup. We will update it to also create a `team_members` record if none exists with that email. This means every new signup automatically appears in the Team list with status `invited` (or `active` if the admin has already pre-registered them by email).

**B) Link existing auth users who have no `team_members` record**
We'll run a one-time migration to insert `team_members` rows for auth users that don't have one yet (e.g. `tamires@premacar.com`).

**C) Auto-activate team member when user logs in for first time**
When a user logs in and their email matches a `team_members` record, the `user_id` should be linked and the status set to `active`. Currently the hook `useUserRole` already does a lookup by email — but it doesn't write back to `team_members`. We'll add logic so that when the `team_members` record has no `user_id`, and the logged-in user's email matches, it gets updated automatically via a database trigger or in the `useUserRole` hook.

The cleanest approach: update the `handle_new_user` trigger to also upsert into `team_members`, and add a separate trigger to link `user_id` + set status `active` on first login via an auth hook.

Since Supabase auth hooks for login events aren't directly available in triggers, the best approach is:
- Migration: insert missing `team_members` entries for all current auth users
- Trigger: on new user signup, auto-create `team_members` record  
- Frontend: in `useUserRole`, when user is logged in and team_member is found by email but `user_id` is null, update it to set `user_id` and `status = active`

## Problem 2: Admin Can Change Any User's Password

This requires an **Edge Function** using the `SUPABASE_SERVICE_ROLE_KEY` (already configured as a secret) to call `supabase.auth.admin.updateUserById()`. The frontend will add a "Change Password" button in the Edit Member modal, only visible to admins, that calls this function.

---

## Technical Plan

### Step 1: Database Migration
```sql
-- 1. Insert team_members for existing auth users who don't have one
INSERT INTO public.team_members (name, email, role, status, user_id)
SELECT 
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as name,
  u.email,
  'agent' as role,
  'active' as status,
  u.id as user_id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm WHERE tm.email = u.email
)
ON CONFLICT DO NOTHING;

-- 2. Link existing team_members where user_id is null but auth user exists with same email
UPDATE public.team_members tm
SET user_id = u.id, status = 'active'
FROM auth.users u
WHERE tm.email = u.email AND tm.user_id IS NULL;

-- 3. Update handle_new_user trigger to also create team_members entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  -- Assign app role
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  -- Upsert into team_members: if email already exists (pre-registered), link user_id
  -- otherwise create a new entry
  INSERT INTO public.team_members (name, email, role, status, user_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'agent',
    'active',
    NEW.id
  )
  ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id, status = 'active';
  
  RETURN NEW;
END;
$$;
```

Note: To support `ON CONFLICT (email)`, we need a unique constraint on `team_members.email`. We'll add that in the migration too:
```sql
ALTER TABLE public.team_members ADD CONSTRAINT team_members_email_unique UNIQUE (email);
```

### Step 2: New Edge Function — `admin-update-user`
File: `supabase/functions/admin-update-user/index.ts`

This function accepts a `user_id` and a new `password`. It uses the `SUPABASE_SERVICE_ROLE_KEY` (already set) to call the admin API.

- Validates that the caller is authenticated and has the `admin` app role
- Calls `supabase.auth.admin.updateUserById(userId, { password: newPassword })`
- Returns success/error

### Step 3: Frontend Changes in `Team.tsx`

In the **Edit Member Modal**, add a "Alterar Senha" section below the other fields. This section:
- Is only visible if `isAdmin` is true
- Has a password input field + confirmation field
- On form submit, if the password fields are filled, calls the `admin-update-user` edge function
- The member's `user_id` is needed to update their auth password — if `user_id` is null on the member (meaning they haven't signed in yet), we disable the password change and show a note "usuário ainda não acessou o sistema"

### Step 4: Fetch `user_id` for team members
Currently `api.fetchTeam()` already returns the `user_id` from `team_members`. The `TeamMember` type needs to include `user_id` as a field so the password change modal can use it.

---

## Summary of Files Changed

| File | Change |
|------|--------|
| Database migration | Add `UNIQUE` on `team_members.email`, backfill existing auth users, update `handle_new_user` trigger |
| `supabase/functions/admin-update-user/index.ts` | New edge function to change user password via admin API |
| `src/types.ts` | Add `user_id` field to `TeamMember` interface |
| `src/services/api.ts` | Include `user_id` in `fetchTeam` mapping |
| `src/components/Team.tsx` | Add "Alterar Senha" section to Edit Member modal |
