-- Snowbook — file delivery
--
-- Finished films and stills handed over to the client. Files live in a private
-- Storage bucket; this table is the index over them.
--
-- Objects are stored under a path beginning with the project id:
--   <project_id>/<random>-<filename>
-- The storage policies below read that first path segment to decide who may
-- see the object, which is what keeps one client's delivery out of another's.

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text,
  file_name text not null check (length(btrim(file_name)) > 0),
  storage_path text not null unique,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now()
);

create index deliverables_project_id_idx
  on public.deliverables (project_id, created_at desc);

alter table public.deliverables enable row level security;

create policy "deliverables: admin full access"
  on public.deliverables for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "deliverables: client reads own project deliverables"
  on public.deliverables for select
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = deliverables.project_id
        and p.client_id = public.auth_client_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Private bucket: every download goes through a short-lived signed URL that is
-- only issued after the caller's own session passes the policies below.
insert into storage.buckets (id, name, public, file_size_limit)
values ('deliverables', 'deliverables', false, 5368709120)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "deliverables bucket: admin manages files" on storage.objects;
create policy "deliverables bucket: admin manages files"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'deliverables' and public.is_admin())
  with check (bucket_id = 'deliverables' and public.is_admin());

drop policy if exists "deliverables bucket: client reads own files" on storage.objects;
create policy "deliverables bucket: client reads own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'deliverables'
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.client_id = public.auth_client_id()
    )
  );
