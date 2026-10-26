-- Run this once if your database was made from an older schema.sql.
-- It stops users from giving themselves a better plan or resetting their daily draft limit.

-- 1. users can only READ their draft count (the generate-proposal function writes it)
drop policy if exists "own usage" on proposal_usage;
create policy "own usage" on proposal_usage for select using (auth.uid() = user_id);

-- 2. users can edit their own profile, but not plan or stripe_customer_id
revoke insert, update on profiles from anon, authenticated;
grant insert (id, org_name, org_type, ein) on profiles to authenticated;
grant update (id, org_name, org_type, ein) on profiles to authenticated;
