-- Tests Phase 1 (coaching) : adresse, nombre de chiens, tarif social, conditions acceptées, report.
begin;

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create function pg_temp.reset_role() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); end $$;
create function pg_temp.expect_error(p_sql text, p_message text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ÉCHEC : « % » aurait dû lever « % »', p_sql, p_message;
exception when others then
  if sqlerrm not like '%' || p_message || '%' then
    raise exception 'ÉCHEC : « % » a levé « % » au lieu de « % »', p_sql, sqlerrm, p_message;
  end if;
end $$;
create function pg_temp.assert(p_ok boolean, p_label text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'ÉCHEC : %', p_label; end if; end $$;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com'),
  ('33333333-3333-4333-8333-333333333333', 'admin@freepaws.be');
update public.profiles set role = 'admin' where id = '33333333-3333-4333-8333-333333333333';

-- Configuration de TEST (annulée en fin de transaction).
update public.services set requires_park_profile = false, booking_enabled = true, price_cents = 10000, min_notice_hours = 1,
  max_advance_days = 60, slot_step_minutes = 60, buffer_minutes = 0
where slug = 'bilan-cohabitation';
update public.services set booking_enabled = true, min_notice_hours = 1, max_advance_days = 60
where slug = 'park-session';
update public.resources set is_open = true;
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select r, d, '08:00', '20:00', date '2026-01-01'
from generate_series(1, 7) d,
     (values ('00000000-0000-4000-a000-000000000001'::uuid), ('00000000-0000-4000-a000-000000000002'::uuid)) v(r);

create temp table t as
with d as (select current_date + 5 as day)
select d.day,
       (d.day + time '10:00') at time zone 'Europe/Brussels' as ten,
       (select id from public.services where slug = 'bilan-cohabitation') as bilan,
       (select id from public.services where slug = 'park-session') as park
from d;
grant select on t to anon, authenticated;

-- 1. Valeurs du cahier des charges dans le seed
select pg_temp.assert((select bool_and(cancel_notice_hours = 48) from public.services), 'annulation 48 h partout');
select pg_temp.assert(
  (select duration_minutes = 45 and slot_step_minutes = 60 and max_dogs = 5 from public.services where slug = 'park-session'),
  'parc : 45 min + 15 min de battement, 5 chiens max');
select pg_temp.assert((select requires_address from public.services where slug = 'bilan-cohabitation'), 'adresse demandée pour le coaching');

-- 2. Adresse obligatoire et nombre de chiens
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error($$select public.book_slot((select bilan from t), (select ten from t))$$, 'address_required');
select pg_temp.expect_error(
  $$select public.book_slot((select park from t), (select ten from t), p_dogs_count => 6)$$, 'too_many_dogs');
select public.book_slot((select park from t), (select ten from t), p_dogs_count => 5, p_adults_count => 2, p_children_count => 1);
select pg_temp.reset_role();

-- 3. Tarif social : pourcentage, échéance, utilisations, plafond mensuel
insert into public.discount_codes (code, kind, value, max_uses) values ('SOCIAL-50', 'percent', 50, 2);
insert into public.discount_codes (code, kind, value, valid_until) values ('EXPIRE-1', 'amount', 1000, current_date - 1);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error($$select * from public.discount_codes$$, 'permission denied');
select pg_temp.assert((select discount_cents from public.check_discount_code((select bilan from t), 'social-50')) = 5000, 'aperçu du code');
select pg_temp.expect_error(
  $$select public.book_slot((select bilan from t), (select ten from t), p_visit_address => 'Rue X 1, Huy', p_discount_code => 'EXPIRE-1')$$,
  'discount_code_invalid');
select public.book_slot((select bilan from t), (select ten from t), p_visit_address => 'Rue X 1, Huy', p_discount_code => 'social-50');
select pg_temp.assert(
  (select price_cents = 5000 and discount_cents = 5000 from public.bookings where visit_address = 'Rue X 1, Huy'),
  'prix réduit de 50 % enregistré');
select pg_temp.reset_role();

update public.settings set social_monthly_cap = 1;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_error(
  $$select public.book_slot((select bilan from t), (select ten from t) + interval '2 hours', p_visit_address => 'Rue Y 2', p_discount_code => 'SOCIAL-50')$$,
  'discount_code_exhausted');
select pg_temp.reset_role();
update public.settings set social_monthly_cap = null;

-- 4. Conditions versionnées : acceptation obligatoire, preuve horodatée, nouvelle version à réaccepter
update public.services set required_document_kinds = '{conditions_coaching}' where slug = 'bilan-cohabitation';
insert into public.legal_documents (id, kind, version, title, body, published_at)
values ('dddddddd-0000-4000-8000-0000000000d1', 'conditions_coaching', 1, 'Conditions', 'Texte v1', now() - interval '1 day');

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_error(
  $$select public.book_slot((select bilan from t), (select ten from t) + interval '2 hours', p_visit_address => 'Rue Y 2')$$,
  'documents_not_accepted');
select public.book_slot((select bilan from t), (select ten from t) + interval '2 hours', p_visit_address => 'Rue Y 2',
  p_document_ids => array['dddddddd-0000-4000-8000-0000000000d1'::uuid]);
select pg_temp.assert(
  (select count(*) from public.document_acceptances where booking_id is not null) = 1,
  'acceptation enregistrée et liée à la réservation');
select pg_temp.assert(
  (select accepted from public.get_required_documents((select bilan from t))) = true, 'déjà acceptée : plus demandée');
select pg_temp.reset_role();

insert into public.legal_documents (id, kind, version, title, body, published_at)
values ('dddddddd-0000-4000-8000-0000000000d2', 'conditions_coaching', 2, 'Conditions', 'Texte v2', now() - interval '1 minute');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.assert(
  (select accepted = false and version = 2 from public.get_required_documents((select bilan from t))),
  'nouvelle version publiée : à réaccepter');
select pg_temp.expect_error($$insert into public.document_acceptances (user_id, document_id) values ('22222222-2222-4222-8222-222222222222', 'dddddddd-0000-4000-8000-0000000000d2')$$, 'row-level security');
select pg_temp.reset_role();

-- 5. Report en ligne
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.reschedule_booking(
  (select id from public.bookings where visit_address = 'Rue Y 2'),
  (select ten from t) + interval '1 day');
select pg_temp.assert(
  (select lower(a.period) = (select ten from t) + interval '1 day' and b.status = 'confirmed'
   from public.bookings b join public.appointments a on a.id = b.appointment_id where b.visit_address = 'Rue Y 2'),
  'réservation déplacée et toujours confirmée');
select pg_temp.assert(
  exists (select 1 from public.get_available_slots((select bilan from t), (select day from t), (select day from t)) s
          where s.starts_at = (select ten from t) + interval '2 hours'),
  'ancien créneau libéré');
select pg_temp.expect_error(
  $$select public.reschedule_booking((select id from public.bookings where visit_address = 'Rue Y 2'), (select ten from t))$$,
  'slot_unavailable');
select pg_temp.assert(
  (select b.status = 'confirmed' from public.bookings b where b.visit_address = 'Rue Y 2'),
  'un report refusé ne change rien');
select pg_temp.reset_role();

rollback;
