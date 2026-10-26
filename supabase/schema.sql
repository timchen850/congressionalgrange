
create table profiles (
  id uuid primary key references auth.users(id),
  org_name text,
  org_type text,
  ein text,
  plan text default 'free',
  stripe_customer_id text,
  created_at timestamp default now()
);

-- survey answers, stored as one json blob
create table onboarding_answers (
  user_id uuid primary key references auth.users(id),
  answers jsonb,
  updated_at timestamp default now()
);

create table grants (
  id serial primary key,
  user_id uuid references auth.users(id),
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
  user_id uuid references auth.users(id),
  grant_title text,
  content text,
  created_at timestamp default now()
);

create table deadlines (
  id serial primary key,
  user_id uuid references auth.users(id),
  title text,
  due_date date,
  done boolean default false
);

-- daily draft limit
create table proposal_usage (
  user_id uuid references auth.users(id),
  day date default current_date,
  count int default 0,
  primary key (user_id, day)
);

-- past proposals split into chunks for style matching (384 = gte-small)
create extension if not exists vector;

create table document_chunks (
  id serial primary key,
  user_id uuid references auth.users(id),
  label text,
  content text,
  embedding vector(384)
);

create or replace function match_document_chunks(query_embedding vector(384), match_count int)
returns table (id int, content text, similarity float)
language sql
as $$
  select id, content, 1 - (embedding <=> query_embedding) as similarity
  from document_chunks
  where user_id = auth.uid()
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

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own answers" on onboarding_answers for all using (auth.uid() = user_id);
create policy "own grants" on grants for all using (auth.uid() = user_id);
create policy "own proposals" on proposals for all using (auth.uid() = user_id);
create policy "own deadlines" on deadlines for all using (auth.uid() = user_id);
create policy "own usage" on proposal_usage for all using (auth.uid() = user_id);
create policy "own chunks" on document_chunks for all using (auth.uid() = user_id);
