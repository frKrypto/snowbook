-- Snowbook — archiving, and protecting paid invoices from cascade deletes
--
-- Deleting a paid invoice directly was already refused, on the grounds that it
-- is part of the financial record. But deleting a *client* cascaded through the
-- foreign keys and took their paid invoices with it, which contradicted that.
--
-- The guard below closes the gap in the database rather than in the app, so it
-- holds regardless of which client or key the delete arrives through. Archiving
-- is the intended way to clear a finished client out of the working list.

alter table public.clients
  add column if not exists archived_at timestamptz;

create index if not exists clients_archived_at_idx
  on public.clients (archived_at);

create or replace function public.prevent_delete_client_with_paid_invoices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid integer;
begin
  select count(*)
  into v_paid
  from public.invoices i
  where i.client_id = old.id
    and (i.status = 'paid' or i.amount_paid > 0);

  if v_paid > 0 then
    raise exception
      'Cannot delete % — they have % paid invoice(s), which are part of your financial records. Archive them instead.',
      old.name, v_paid
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists clients_protect_paid_invoices on public.clients;
create trigger clients_protect_paid_invoices
  before delete on public.clients
  for each row execute function public.prevent_delete_client_with_paid_invoices();

-- Same reasoning one level down: a paid invoice is never deletable, even if the
-- app-layer check is bypassed. No exemption is needed for the client-cascade
-- path — the trigger above only lets a cascade through when the client has no
-- paid invoices, so this can never fire spuriously during one.
create or replace function public.prevent_delete_paid_invoice()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'paid' or old.amount_paid > 0 then
    raise exception
      'Invoice % has been paid and cannot be deleted.', old.invoice_number
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists invoices_protect_paid on public.invoices;
create trigger invoices_protect_paid
  before delete on public.invoices
  for each row execute function public.prevent_delete_paid_invoice();
