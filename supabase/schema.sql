
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_name text,
  org_type text,
  ein text,
  plan text default 'free',
  stripe_customer_id text,
  created_at timestamp default now()
);

-- survey answers, stored as one json blob
create table onboarding_answers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb,
  updated_at timestamp default now()
);

create table grants (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  funder text,
  amount numeric,
  deadline date,
  match_score int,
  status text default 'saved',
  created_at timestamp default now()
);

create table proposals (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  grant_title text,
  content text,
  created_at timestamp default now()
);

create table deadlines (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  due_date date,
  done boolean default false
);

-- daily draft limit
create table proposal_usage (
  user_id uuid references auth.users(id) on delete cascade,
  day date default current_date,
  count int default 0,
  primary key (user_id, day)
);

-- past proposals split into chunks for style matching (384 = gte-small)
create extension if not exists vector;

create table document_chunks (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text,
  content text,
  embedding vector(384)
);

-- finds the user's own chunks that are close to the query
-- min_similarity throws away chunks that are not really about the same thing
create or replace function match_document_chunks(query_embedding vector(384), match_count int, min_similarity float default 0.72)
returns table (id int, content text, similarity float)
language sql
as $$
  select id, content, 1 - (embedding <=> query_embedding) as similarity
  from document_chunks
  where user_id = auth.uid()
    and 1 - (embedding <=> query_embedding) >= min_similarity
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- example proposals we are allowed to learn from (same for every user)
create table exemplar_chunks (
  id serial primary key,
  title text,
  funder_type text,
  source_url text,
  license text,                       -- how we are allowed to use it
  usage text default 'learn_from',    -- 'learn_from' or 'reference_only'
  content text,
  embedding vector(384)
);

-- reference_only examples are never sent to the AI
-- 0.82 is higher than the 0.72 above because proposals all sound alike, see generate-proposal
create or replace function match_exemplar_chunks(query_embedding vector(384), match_count int, min_similarity float default 0.82)
returns table (id int, title text, content text, similarity float)
language sql
as $$
  select id, title, content, 1 - (embedding <=> query_embedding) as similarity
  from exemplar_chunks
  where usage = 'learn_from'
    and 1 - (embedding <=> query_embedding) >= min_similarity
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- everyone can only see their own rows
alter table profiles enable row level security;
alter table onboarding_answers enable row level security;
alter table grants enable row level security;
alter table proposals enable row level security;
alter table deadlines enable row level security;
alter table proposal_usage enable row level security;
alter table document_chunks enable row level security;
alter table exemplar_chunks enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own answers" on onboarding_answers for all using (auth.uid() = user_id);
create policy "own grants" on grants for all using (auth.uid() = user_id);
create policy "own proposals" on proposals for all using (auth.uid() = user_id);
create policy "own deadlines" on deadlines for all using (auth.uid() = user_id);
-- users can only READ their draft count. The generate-proposal function adds to it
-- with the service role key. If they could change it, they could reset their own limit.
create policy "own usage" on proposal_usage for select using (auth.uid() = user_id);
create policy "own chunks" on document_chunks for all using (auth.uid() = user_id);
create policy "logged in users can read examples" on exemplar_chunks for select using (auth.role() = 'authenticated');

-- Users can edit their own profile, but they must NOT be able to change their plan.
-- Without this, anyone logged in could set plan = 'pro' from the browser.
-- Only the stripe webhook changes plan and stripe_customer_id (it uses the service role key).
-- If you already ran this file once, run supabase/fix_plan_security.sql instead.
revoke insert, update on profiles from anon, authenticated;
grant insert (id, org_name, org_type, ein) on profiles to authenticated;
grant update (id, org_name, org_type, ein) on profiles to authenticated;
