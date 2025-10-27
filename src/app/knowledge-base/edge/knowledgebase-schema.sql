-- Knowledgebase core tables
create table if not exists public.kb_folders (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  colour text,
  icon text,
  parent_id uuid references public.kb_folders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_articles (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  folder_id uuid not null references public.kb_folders(id) on delete cascade,
  slug text unique not null,
  title text not null,
  excerpt text,
  body text not null,
  hero_image text,
  estimated_read_mins int default 10,
  status text not null default 'draft' check (status in ('draft','pending_review','scheduled','published','archived')),
  sequence_index int,
  release_requires_articles uuid[] default '{}',
  release_requires_quizzes uuid[] default '{}',
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_article_tags (
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  tag text not null,
  primary key(article_id, tag)
);

create table if not exists public.kb_article_attachments (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  name text not null,
  url text not null,
  type text not null check (type in ('file','image','link')),
  size_bytes bigint,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.kb_article_checklist (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  label text not null,
  position int not null default 0
);

create table if not exists public.kb_comments (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  parent_id uuid references public.kb_comments(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  mentions text[] default '{}',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_article_favourites (
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(article_id, user_id),
  created_at timestamptz not null default now()
);

create table if not exists public.kb_article_acknowledgements (
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key(article_id, user_id)
);

create table if not exists public.kb_user_article_progress (
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(article_id, user_id)
);

create table if not exists public.kb_quizzes (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references public.kb_articles(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  summary text,
  passing_score numeric not null default 80
);

create table if not exists public.kb_quiz_questions (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references public.kb_quizzes(id) on delete cascade,
  prompt text not null,
  type text not null check (type in ('single','multi','true_false','short_text')),
  max_selections int,
  position int default 0
);

create table if not exists public.kb_quiz_question_options (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.kb_quiz_questions(id) on delete cascade,
  label text not null,
  correct boolean default false,
  explanation text
);

create table if not exists public.kb_quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references public.kb_quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score numeric not null,
  passed boolean not null,
  responses jsonb not null,
  submitted_at timestamptz not null default now()
);

create table if not exists public.kb_training_modules (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  description text,
  colour text,
  due_date date,
  estimated_minutes int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_training_module_articles (
  module_id uuid not null references public.kb_training_modules(id) on delete cascade,
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  position int not null default 0,
  primary key(module_id, article_id)
);

create table if not exists public.kb_training_module_quizzes (
  module_id uuid not null references public.kb_training_modules(id) on delete cascade,
  quiz_id uuid not null references public.kb_quizzes(id) on delete cascade,
  position int not null default 0,
  primary key(module_id, quiz_id)
);

create table if not exists public.kb_article_releases (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  user_ids uuid[] default '{}',
  team_ids uuid[] default '{}',
  released_by uuid not null references auth.users(id),
  released_at timestamptz not null default now()
);

create or replace view public.v_kb_articles_with_meta as
select
  a.id,
  a.slug,
  a.folder_id,
  a.title,
  a.excerpt,
  a.body,
  a.hero_image,
  a.estimated_read_mins,
  a.status,
  a.sequence_index,
  a.release_requires_articles,
  a.release_requires_quizzes,
  a.created_at,
  a.updated_at,
  a.created_by,
  a.updated_by,
  a.organisation_id,
  coalesce(array_agg(distinct t.tag) filter (where t.tag is not null), '{}') as tags,
  count(distinct fav.user_id) > 0 as is_favourite
from public.kb_articles a
left join public.kb_article_tags t on t.article_id = a.id
left join public.kb_article_favourites fav on fav.article_id = a.id and fav.user_id = auth.uid()
where a.organisation_id = uuid(auth.jwt() ->> 'organisation_id')
group by a.id;

alter table public.kb_articles enable row level security;
alter table public.kb_article_tags enable row level security;
alter table public.kb_article_attachments enable row level security;
alter table public.kb_comments enable row level security;
alter table public.kb_article_favourites enable row level security;
alter table public.kb_article_acknowledgements enable row level security;
alter table public.kb_user_article_progress enable row level security;
alter table public.kb_quizzes enable row level security;
alter table public.kb_quiz_questions enable row level security;
alter table public.kb_quiz_question_options enable row level security;
alter table public.kb_quiz_attempts enable row level security;
alter table public.kb_training_modules enable row level security;
alter table public.kb_training_module_articles enable row level security;
alter table public.kb_training_module_quizzes enable row level security;

create policy "org members read folders" on public.kb_folders for select using (
  organisation_id = uuid(auth.jwt() ->> 'organisation_id')
);

create policy "org members manage folders" on public.kb_folders
for all using (organisation_id = uuid(auth.jwt() ->> 'organisation_id'))
with check (organisation_id = uuid(auth.jwt() ->> 'organisation_id'));

create policy "org members manage articles" on public.kb_articles
for all using (organisation_id = uuid(auth.jwt() ->> 'organisation_id'))
with check (organisation_id = uuid(auth.jwt() ->> 'organisation_id'));

create policy "org members manage attachments" on public.kb_article_attachments
for all using (true) with check (true);

create policy "org members manage comments" on public.kb_comments
for all using (true) with check (true);

create policy "org members manage quiz attempts" on public.kb_quiz_attempts
for select using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "org members manage favourites" on public.kb_article_favourites
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "org members manage acknowledgements" on public.kb_article_acknowledgements
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "org members manage progress" on public.kb_user_article_progress
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.search_kb_articles(search_term text)
returns setof public.v_kb_articles_with_meta
language sql
security definer
set search_path = public
as $$
  select *
  from public.v_kb_articles_with_meta
  where organisation_id = uuid(auth.jwt() ->> 'organisation_id')
    and (
      coalesce(title, '') ilike '%' || search_term || '%'
      or coalesce(excerpt, '') ilike '%' || search_term || '%'
      or array_to_string(tags, ' ') ilike '%' || search_term || '%'
    )
  order by updated_at desc
  limit 40;
$$;
