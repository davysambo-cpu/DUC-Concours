-- Schema Supabase for DUC CONCOURS.
-- Execute this file in the Supabase SQL editor before enabling cloud sync.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(150) unique not null,
  nom_complet varchar(100) not null,
  role varchar(20) not null default 'etudiant'
    check (role in ('etudiant', 'admin')),
  est_autorise boolean not null default false,
  date_inscription timestamptz not null default now()
);

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_session_id varchar(64) not null,
  mode varchar(50) not null check (mode in ('standard', 'unidisciplinaire')),
  matiere varchar(50),
  score_total integer not null check (score_total >= 0),
  total_questions integer not null check (total_questions > 0),
  duree_secondes integer not null check (duree_secondes >= 0),
  date_passage timestamptz not null,
  date_synchronisation timestamptz not null default now(),
  constraint unique_user_local_session unique (user_id, local_session_id)
);

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id varchar(32) not null,
  commentaire text,
  statut varchar(20) not null default 'nouveau'
    check (statut in ('nouveau', 'corrige', 'rejete')),
  date_signalement timestamptz not null default now()
);

create index if not exists question_reports_user_id_idx
  on public.question_reports (user_id);

create or replace function public.creer_profil_nouvel_utilisateur()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nom_complet)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'nom_complet', ''), 'Candidat 2027')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.gerer_nouvel_utilisateur();

drop trigger if exists apres_creation_utilisateur on auth.users;
create trigger apres_creation_utilisateur
  after insert on auth.users
  for each row execute procedure public.creer_profil_nouvel_utilisateur();

revoke execute on function public.creer_profil_nouvel_utilisateur() from public, anon, authenticated;

create or replace function public.est_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.est_admin() from public, anon;

alter table public.profiles enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.question_reports enable row level security;

drop policy if exists "Les utilisateurs lisent leur propre profil" on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select
  using (id = (select auth.uid()) or (select public.est_admin()));

drop policy if exists "Les utilisateurs modifient leur propre profil" on public.profiles;
revoke update on public.profiles from anon, authenticated;

drop policy if exists "Les etudiants lisent leurs propres sessions" on public.exam_sessions;
drop policy if exists "Les etudiants creent leurs propres sessions" on public.exam_sessions;
drop policy if exists exam_sessions_select_own_or_admin on public.exam_sessions;
create policy exam_sessions_select_own_or_admin
  on public.exam_sessions for select
  using (user_id = (select auth.uid()) or (select public.est_admin()));

drop policy if exists exam_sessions_insert_own on public.exam_sessions;
create policy exam_sessions_insert_own
  on public.exam_sessions for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "Les utilisateurs lisent leurs propres signalements" on public.question_reports;
drop policy if exists "Les utilisateurs creent des signalements" on public.question_reports;
drop policy if exists question_reports_insert_own on public.question_reports;
create policy question_reports_insert_own
  on public.question_reports for insert
  with check (user_id = (select auth.uid()));

drop policy if exists question_reports_select_admin on public.question_reports;
create policy question_reports_select_admin
  on public.question_reports for select
  using ((select public.est_admin()));

drop policy if exists question_reports_update_admin on public.question_reports;
create policy question_reports_update_admin
  on public.question_reports for update
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

grant select on public.profiles, public.exam_sessions, public.question_reports to authenticated;
grant insert on public.exam_sessions, public.question_reports to authenticated;
grant update on public.question_reports to authenticated;
