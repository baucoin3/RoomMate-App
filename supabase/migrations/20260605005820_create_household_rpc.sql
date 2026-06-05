-- Atomically create household + creator member (bypasses RLS chicken-and-egg on INSERT RETURNING)
CREATE OR REPLACE FUNCTION public.create_household(p_name text, p_nickname text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id          uuid;
  v_invite_code text;
  v_created_at  timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.households (name)
  VALUES (trim(p_name))
  RETURNING id, invite_code, created_at
    INTO v_id, v_invite_code, v_created_at;

  INSERT INTO public.household_members (household_id, user_id, is_rent_owner, nickname)
  VALUES (v_id, auth.uid(), true, nullif(trim(p_nickname), ''));

  RETURN json_build_object(
    'id',          v_id,
    'name',        trim(p_name),
    'invite_code', v_invite_code,
    'created_at',  v_created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_household(text, text) TO authenticated;
