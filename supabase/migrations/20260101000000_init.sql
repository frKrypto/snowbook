-- Snowbook — core schema
-- Clients, projects, tasks, invoices and invoice line items, plus the
-- profiles table that links Supabase auth users to a role (and, for clients,
-- to the client record they are allowed to see).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'client');
create type public.client_status as enum ('lead', 'active', 'past');
create type public.project_status as enum (
  'inquiry', 'booked', 'in_progress', 'delivered', 'completed'
);
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  email text not null check (position('@' in email) > 1),
  phone text,
  company text,
  status public.client_status not null default 'lead',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index clients_email_key on public.clients (lower(email));
create index clients_status_idx on public.clients (status);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  client_id uuid references public.clients (id) on delete set null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An admin is never scoped to a single client; a client must be.
  constraint profiles_role_scope check (
    (role = 'admin' and client_id is null) or (role = 'client')
  )
);

create index profiles_client_id_idx on public.profiles (client_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- New auth users get a profile automatically. Role and client linkage come
-- from the metadata the admin passes when inviting, defaulting to 'client'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_client_id uuid;
begin
  begin
    v_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::public.user_role, 'client'
    );
  exception when others then
    v_role := 'client';
  end;

  begin
    v_client_id := nullif(new.raw_user_meta_data ->> 'client_id', '')::uuid;
  exception when others then
    v_client_id := null;
  end;

  if v_role = 'admin' then
    v_client_id := null;
  end if;

  insert into public.profiles (id, role, client_id, full_name)
  values (
    new.id,
    v_role,
    v_client_id,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own display name but never their own role or client
-- linkage — that would be a privilege escalation straight past RLS.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.client_id is distinct from old.client_id then
    raise exception 'not allowed to change role or client assignment';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text,
  status public.project_status not null default 'inquiry',
  event_date date,
  delivery_due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_client_id_idx on public.projects (client_id);
create index projects_status_idx on public.projects (status);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  is_done boolean not null default false,
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index tasks_project_id_idx on public.tasks (project_id, position, created_at);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------

create sequence public.invoice_number_seq start 1001;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete cascade,
  invoice_number text not null unique
    default 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0'),
  title text,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  paypal_order_id text,
  paypal_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_project_id_idx on public.invoices (project_id);
create index invoices_status_idx on public.invoices (status);
create unique index invoices_paypal_transaction_id_key
  on public.invoices (paypal_transaction_id)
  where paypal_transaction_id is not null;

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- invoice_line_items
-- ---------------------------------------------------------------------------

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null check (length(btrim(description)) > 0),
  quantity numeric(12, 2) not null default 1 check (quantity >= 0),
  rate numeric(12, 2) not null default 0 check (rate >= 0),
  amount numeric(12, 2) generated always as (round(quantity * rate, 2)) stored,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index invoice_line_items_invoice_id_idx
  on public.invoice_line_items (invoice_id, position, created_at);

-- Totals are derived, never trusted from the client. The BEFORE trigger on
-- invoices recomputes tax/total from whatever subtotal is being written, and
-- the line-item trigger keeps that subtotal in sync with the line items.
create or replace function public.invoices_apply_totals()
returns trigger
language plpgsql
as $$
begin
  new.subtotal := coalesce(new.subtotal, 0);
  new.tax := round(new.subtotal * coalesce(new.tax_rate, 0) / 100, 2);
  new.total := new.subtotal + new.tax;
  return new;
end;
$$;

create trigger invoices_apply_totals
  before insert or update on public.invoices
  for each row execute function public.invoices_apply_totals();

create or replace function public.sync_invoice_subtotal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices
  set subtotal = (
    select coalesce(sum(amount), 0)
    from public.invoice_line_items
    where invoice_id = v_invoice_id
  )
  where id = v_invoice_id;

  return null;
end;
$$;

create trigger invoice_line_items_sync_subtotal
  after insert or update or delete on public.invoice_line_items
  for each row execute function public.sync_invoice_subtotal();

-- Sweeps sent invoices past their due date into 'overdue'. The UI also derives
-- this for display; this function exists so it can be scheduled (pg_cron) later.
create or replace function public.mark_overdue_invoices()
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.invoices
    set status = 'overdue'
    where status = 'sent'
      and due_date is not null
      and due_date < current_date
    returning 1
  )
  select count(*)::integer from updated;
$$;
