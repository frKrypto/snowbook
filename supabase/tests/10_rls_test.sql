-- Verifies the security properties the app depends on.

create or replace function public.assert_eq(actual bigint, expected bigint, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % — expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok: %', label;
end $$;

create or replace function public.assert_true(condition boolean, label text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'ok: %', label;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser, RLS bypassed)
-- ---------------------------------------------------------------------------

insert into public.clients (id, name, email, status) values
  ('11111111-1111-1111-1111-111111111111', 'Client A', 'a@example.com', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Client B', 'b@example.com', 'active');

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@studio.com',
   '{"role":"admin","full_name":"Owner"}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'a@example.com',
   '{"role":"client","client_id":"11111111-1111-1111-1111-111111111111"}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'b@example.com',
   '{"role":"client","client_id":"22222222-2222-2222-2222-222222222222"}'::jsonb);

-- The handle_new_user trigger should have built the profiles automatically.
select public.assert_eq(
  (select count(*) from public.profiles), 3, 'trigger created a profile per auth user');
select public.assert_true(
  (select role = 'admin' and client_id is null from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'admin profile has role=admin and no client scope');
select public.assert_true(
  (select client_id = '11111111-1111-1111-1111-111111111111'
   from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'client profile linked to its client record');

insert into public.projects (id, client_id, title, status) values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'A Project', 'booked'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'B Project', 'booked');

insert into public.tasks (project_id, name) values
  ('33333333-3333-3333-3333-333333333331', 'A task'),
  ('33333333-3333-3333-3333-333333333332', 'B task');

insert into public.invoices (id, client_id, project_id, status, due_date, tax_rate) values
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333331', 'sent', current_date + 10, 10),
  ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333331', 'draft', current_date + 10, 0),
  ('44444444-4444-4444-4444-444444444443', '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333332', 'sent', current_date + 10, 0);

insert into public.invoice_line_items (invoice_id, description, quantity, rate) values
  ('44444444-4444-4444-4444-444444444441', 'Coverage', 2, 100.00),
  ('44444444-4444-4444-4444-444444444441', 'Drone', 1, 50.00),
  ('44444444-4444-4444-4444-444444444442', 'Draft item', 1, 999.00),
  ('44444444-4444-4444-4444-444444444443', 'B item', 1, 500.00);

-- ---------------------------------------------------------------------------
-- Derived totals
-- ---------------------------------------------------------------------------

select public.assert_true(
  (select subtotal = 250.00 and tax = 25.00 and total = 275.00
   from public.invoices where id = '44444444-4444-4444-4444-444444444441'),
  'triggers computed subtotal 250, tax 25 (10%), total 275');

update public.invoice_line_items set rate = 200.00
where invoice_id = '44444444-4444-4444-4444-444444444441' and description = 'Coverage';

select public.assert_true(
  (select subtotal = 450.00 and total = 495.00
   from public.invoices where id = '44444444-4444-4444-4444-444444444441'),
  'totals recalculated after a line item changed');

delete from public.invoice_line_items
where invoice_id = '44444444-4444-4444-4444-444444444441' and description = 'Drone';

select public.assert_true(
  (select subtotal = 400.00 from public.invoices
   where id = '44444444-4444-4444-4444-444444444441'),
  'totals recalculated after a line item was deleted');

-- ---------------------------------------------------------------------------
-- Deliverables (fixtures)
-- ---------------------------------------------------------------------------

insert into public.deliverables (project_id, file_name, storage_path, size_bytes) values
  ('33333333-3333-3333-3333-333333333331', 'a-highlight.mp4',
   '33333333-3333-3333-3333-333333333331/abc-a-highlight.mp4', 1048576),
  ('33333333-3333-3333-3333-333333333332', 'b-highlight.mp4',
   '33333333-3333-3333-3333-333333333332/def-b-highlight.mp4', 2097152);

insert into storage.objects (bucket_id, name) values
  ('deliverables', '33333333-3333-3333-3333-333333333331/abc-a-highlight.mp4'),
  ('deliverables', '33333333-3333-3333-3333-333333333332/def-b-highlight.mp4');

select public.assert_true(
  (select not public from storage.buckets where id = 'deliverables'),
  'deliverables bucket exists and is private');

-- ---------------------------------------------------------------------------
-- Client A's view
-- ---------------------------------------------------------------------------

set role authenticated;
select set_config('test.user_id', 'aaaaaaaa-0000-0000-0000-000000000002', false);

select public.assert_eq((select count(*) from public.clients), 1,
  'client sees only their own client record');
select public.assert_true(
  (select id = '11111111-1111-1111-1111-111111111111' from public.clients),
  'and it is the right one');

select public.assert_eq((select count(*) from public.projects), 1,
  'client sees only their own projects');
select public.assert_eq((select count(*) from public.tasks), 1,
  'client sees only tasks on their own projects');

select public.assert_eq((select count(*) from public.invoices), 1,
  'client sees only their own non-draft invoices');
select public.assert_eq(
  (select count(*) from public.invoices where status = 'draft'), 0,
  'draft invoices are invisible to the client');
select public.assert_eq((select count(*) from public.invoice_line_items), 1,
  'client sees line items only for visible invoices');

select public.assert_eq((select count(*) from public.deliverables), 1,
  'client sees only deliverables on their own projects');
select public.assert_true(
  (select file_name = 'a-highlight.mp4' from public.deliverables),
  'and it is their own file, not the other client''s');
select public.assert_eq((select count(*) from storage.objects), 1,
  'client can reach only their own project''s storage objects');
select public.assert_true(
  (select name like '33333333-3333-3333-3333-333333333331/%'
   from storage.objects),
  'the reachable object is under their own project folder');

-- Writes must all fail.
do $$
begin
  begin
    update public.invoices set status = 'paid', amount_paid = 999
    where id = '44444444-4444-4444-4444-444444444441';
    if found then
      raise exception 'FAIL: client was able to mark an invoice paid';
    end if;
    raise notice 'ok: client cannot mark an invoice paid (no rows updated)';
  exception when insufficient_privilege then
    raise notice 'ok: client cannot mark an invoice paid (privilege denied)';
  end;

  begin
    insert into public.projects (client_id, title)
    values ('11111111-1111-1111-1111-111111111111', 'Sneaky project');
    raise exception 'FAIL: client was able to insert a project';
  exception when insufficient_privilege then
    raise notice 'ok: client cannot insert a project';
  end;

  begin
    insert into public.deliverables (project_id, file_name, storage_path)
    values (
      '33333333-3333-3333-3333-333333333331', 'sneaky.mp4',
      '33333333-3333-3333-3333-333333333331/sneaky.mp4'
    );
    raise exception 'FAIL: client was able to add a deliverable';
  exception when insufficient_privilege then
    raise notice 'ok: client cannot add a deliverable';
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values ('deliverables', '33333333-3333-3333-3333-333333333331/sneaky.mp4');
    raise exception 'FAIL: client was able to upload to storage';
  exception when insufficient_privilege then
    raise notice 'ok: client cannot upload to storage';
  end;

  begin
    update public.clients set name = 'Renamed'
    where id = '11111111-1111-1111-1111-111111111111';
    if found then
      raise exception 'FAIL: client was able to edit their client record';
    end if;
    raise notice 'ok: client cannot edit their client record';
  exception when insufficient_privilege then
    raise notice 'ok: client cannot edit their client record';
  end;

  -- The escalation that would defeat every other policy.
  begin
    update public.profiles set role = 'admin'
    where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    raise exception 'FAIL: client escalated themselves to admin';
  exception
    when raise_exception then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'ok: client cannot promote themselves to admin';
    when insufficient_privilege then
      raise notice 'ok: client cannot promote themselves to admin';
  end;

  begin
    update public.profiles set client_id = '22222222-2222-2222-2222-222222222222'
    where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    raise exception 'FAIL: client repointed themselves at another client';
  exception
    when raise_exception then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'ok: client cannot repoint themselves at another client';
    when insufficient_privilege then
      raise notice 'ok: client cannot repoint themselves at another client';
  end;
end $$;

-- Renaming themselves is allowed.
update public.profiles set full_name = 'Client A'
where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.assert_true(
  (select full_name = 'Client A' from public.profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'client can still update their own display name');

-- ---------------------------------------------------------------------------
-- Client B sees a completely different slice
-- ---------------------------------------------------------------------------

select set_config('test.user_id', 'aaaaaaaa-0000-0000-0000-000000000003', false);

select public.assert_true(
  (select id = '22222222-2222-2222-2222-222222222222' from public.clients),
  'client B sees only client B');
select public.assert_eq(
  (select count(*) from public.invoices
   where client_id = '11111111-1111-1111-1111-111111111111'), 0,
  'client B cannot reach client A''s invoices');
select public.assert_eq(
  (select count(*) from public.deliverables
   where project_id = '33333333-3333-3333-3333-333333333331'), 0,
  'client B cannot reach client A''s deliverables');
select public.assert_eq(
  (select count(*) from storage.objects
   where name like '33333333-3333-3333-3333-333333333331/%'), 0,
  'client B cannot reach client A''s stored files');

-- ---------------------------------------------------------------------------
-- Admin sees everything
-- ---------------------------------------------------------------------------

select set_config('test.user_id', 'aaaaaaaa-0000-0000-0000-000000000001', false);

select public.assert_eq((select count(*) from public.clients), 2, 'admin sees all clients');
select public.assert_eq((select count(*) from public.projects), 2, 'admin sees all projects');
select public.assert_eq((select count(*) from public.invoices), 3,
  'admin sees all invoices including drafts');
select public.assert_eq((select count(*) from public.tasks), 2, 'admin sees all tasks');
select public.assert_eq((select count(*) from public.deliverables), 2,
  'admin sees all deliverables');
select public.assert_eq((select count(*) from storage.objects), 2,
  'admin sees all stored files');

insert into public.clients (name, email, status) values ('Admin Made', 'made@example.com', 'lead');
select public.assert_eq((select count(*) from public.clients), 3, 'admin can create clients');

update public.invoices set status = 'paid' where id = '44444444-4444-4444-4444-444444444441';
select public.assert_true(
  (select status = 'paid' from public.invoices where id = '44444444-4444-4444-4444-444444444441'),
  'admin can update invoices');

-- ---------------------------------------------------------------------------
-- Anonymous sees nothing
-- ---------------------------------------------------------------------------

reset role;
set role anon;
select set_config('test.user_id', '', false);

select public.assert_eq((select count(*) from public.clients), 0, 'anon sees no clients');
select public.assert_eq((select count(*) from public.invoices), 0, 'anon sees no invoices');
select public.assert_eq((select count(*) from public.projects), 0, 'anon sees no projects');
select public.assert_eq((select count(*) from public.deliverables), 0,
  'anon sees no deliverables');
select public.assert_eq((select count(*) from storage.objects), 0,
  'anon sees no stored files');

reset role;

-- ---------------------------------------------------------------------------
-- Overdue sweep
-- ---------------------------------------------------------------------------

update public.invoices set status = 'sent', due_date = current_date - 3
where id = '44444444-4444-4444-4444-444444444443';

select public.assert_eq(public.mark_overdue_invoices()::bigint, 1,
  'mark_overdue_invoices flips exactly the past-due sent invoice');
select public.assert_true(
  (select status = 'overdue' from public.invoices
   where id = '44444444-4444-4444-4444-444444444443'),
  'and that invoice is now overdue');

select '=== ALL RLS TESTS PASSED ===' as result;
