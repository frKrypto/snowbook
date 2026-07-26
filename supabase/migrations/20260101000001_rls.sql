-- Snowbook — row level security
--
-- The rule this file enforces: an authenticated client can only ever read rows
-- that belong to the single client record their profile points at, and can
-- never write anything. Admins get full access. Everything else is denied by
-- default, including anon.
--
-- Both helpers are SECURITY DEFINER so that reading public.profiles inside a
-- policy does not re-enter the policy on public.profiles (infinite recursion).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.auth_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.client_id
  from public.profiles p
  where p.id = auth.uid()
    and p.role = 'client';
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.auth_client_id() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.auth_client_id() to authenticated;

-- Now that is_admin() exists, attach the profile privilege guard.
drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;

-- Force RLS so even a table owner connecting through PostgREST is filtered.
-- (The service_role key bypasses RLS entirely and is only used server-side.)

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "profiles: read own or admin reads all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- Row is restricted to the caller's own profile; the guard trigger blocks any
-- attempt to change role or client_id.
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create policy "clients: admin full access"
  on public.clients for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "clients: client reads own record"
  on public.clients for select
  to authenticated
  using (id = public.auth_client_id());

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create policy "projects: admin full access"
  on public.projects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "projects: client reads own projects"
  on public.projects for select
  to authenticated
  using (client_id = public.auth_client_id());

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create policy "tasks: admin full access"
  on public.tasks for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "tasks: client reads tasks on own projects"
  on public.tasks for select
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = tasks.project_id
        and p.client_id = public.auth_client_id()
    )
  );

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------

create policy "invoices: admin full access"
  on public.invoices for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Drafts stay invisible until the admin marks the invoice as sent. Clients get
-- no write policy at all: payment status is written server-side with the
-- service role after PayPal confirms the capture.
create policy "invoices: client reads own sent invoices"
  on public.invoices for select
  to authenticated
  using (
    client_id = public.auth_client_id()
    and status <> 'draft'
  );

-- ---------------------------------------------------------------------------
-- invoice_line_items
-- ---------------------------------------------------------------------------

create policy "invoice_line_items: admin full access"
  on public.invoice_line_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "invoice_line_items: client reads items on visible invoices"
  on public.invoice_line_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_line_items.invoice_id
        and i.client_id = public.auth_client_id()
        and i.status <> 'draft'
    )
  );
