
-- 1. Add UNIQUE constraint on team_members.email (needed for ON CONFLICT)
ALTER TABLE public.team_members 
ADD CONSTRAINT team_members_email_unique UNIQUE (email);

-- 2. Backfill: insert team_members for existing auth users who don't have one
INSERT INTO public.team_members (name, email, role, status, user_id)
SELECT 
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as name,
  u.email,
  'agent'::member_role as role,
  'active'::member_status as status,
  u.id as user_id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm WHERE tm.email = u.email
);

-- 3. Update existing team_members where user_id is null but auth user exists with same email
UPDATE public.team_members tm
SET user_id = u.id, status = 'active'::member_status, updated_at = now()
FROM auth.users u
WHERE tm.email = u.email AND tm.user_id IS NULL;

-- 4. Update handle_new_user trigger to also create team_members entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign app role: first user gets admin, others get user
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Upsert into team_members: if email already exists (pre-registered by admin), link user_id
  -- otherwise create a new entry automatically
  INSERT INTO public.team_members (name, email, role, status, user_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'agent'::member_role,
    'active'::member_status,
    NEW.id
  )
  ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id, 
        status = 'active'::member_status,
        updated_at = now();
  
  RETURN NEW;
END;
$$;
