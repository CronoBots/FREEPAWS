-- Tests du module de réservation. Tout se déroule dans une transaction annulée à la fin.
begin;

-- Utilitaires de test -------------------------------------------------------
create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_uid is null then
    execute 'set local role anon';
  else
    execute 'set local role authenticated';
  end if;
end $$;

create function pg_temp.reset_role() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create function pg_temp.expect_error(p_sql text, p_message text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ÉCHEC : « % » aurait dû lever « % »', p_sql, p_message;
exception
  when others then
    if sqlerrm not like '%' || p_message || '%' then
      raise exception 'ÉCHEC : « % » a levé « % » au lieu de « % »', p_sql, sqlerrm, p_message;
    end if;
end $$;

create function pg_temp.assert(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'ÉCHEC : %', p_label;
  end if;
end $$;

-- Jeu de données -------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com', '{"full_name":"Alice"}'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'admin@freepaws.be', '{}');
update public.profiles set role = 'admin' where id = '33333333-3333-4333-8333-333333333333';
insert into public.dogs (id, owner_id, name) values
  ('dddddddd-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Nami'),
  ('dddddddd-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Sanji');

-- 0. Le seed ne contient que les infos du site : parc pas encore ouvert, aucun horaire,
--    aucune réservation en ligne ouverte.
select pg_temp.assert((select status from public.get_resource_status('park')) = 'not_open', 'parc pas encore ouvert');
select pg_temp.assert((select mode from public.camera_access('park')) = 'denied', 'pas de direct avant l''ouverture');
select pg_temp.assert(not exists (select 1 from public.availability_rules), 'aucun horaire inventé');
select pg_temp.assert(not exists (select 1 from public.services where booking_enabled), 'réservation en ligne fermée par défaut');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error(
  $$select public.book_slot('00000000-0000-4000-b000-000000000002', now() + interval '3 days')$$,
  'service_not_found');
select pg_temp.reset_role();

-- Configuration de TEST (annulée en fin de transaction) : ces valeurs servent uniquement à
-- vérifier les règles de réservation, ce ne sont pas des horaires ou tarifs FreePaws.
update public.resources set is_open = true where slug = 'park';
insert into public.services (id, slug, resource_id, mode, name, duration_minutes, slot_step_minutes,
  min_notice_hours, max_advance_days, cancel_notice_hours, booking_enabled)
values ('00000000-0000-4000-b000-000000000001', 'test-park', '00000000-0000-4000-a000-000000000001',
  'slot', 'Test parc', 60, 60, 1, 30, 12, true);
update public.services set booking_enabled = true, buffer_minutes = 30, slot_step_minutes = 30,
  min_notice_hours = 48, max_advance_days = 60, cancel_notice_hours = 48
where slug = 'bilan-cohabitation';
update public.services set booking_enabled = true, min_notice_hours = 24, max_advance_days = 90
where slug = 'atelier-collectif';
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000001', d, '08:00', '20:00', date '2026-01-01'
from generate_series(1, 7) as d;
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000002', w.d, w.s::time, w.e::time, date '2026-01-01'
from (
  select d, '09:00' as s, '12:00' as e from generate_series(1, 6) as d
  union all
  select d, '13:30', '18:00' from generate_series(1, 5) as d
) as w;

-- Jour de test : le premier mercredi à au moins 3 jours d'ici, 10h heure de Bruxelles
-- (jour ouvré pour le coaching, dans la fenêtre de réservation du parc).
create temp table t as
with d as (
  select current_date + 3 + ((3 - extract(isodow from current_date + 3)::int + 7) % 7) as day
)
select d.day,
       (d.day + time '10:00') at time zone 'Europe/Brussels' as ten,
       '00000000-0000-4000-b000-000000000001'::uuid as park,
       '00000000-0000-4000-b000-000000000002'::uuid as bilan,
       '00000000-0000-4000-b000-000000000005'::uuid as atelier
from d;
grant select on t to anon, authenticated;

-- 1. Profil créé automatiquement à l'inscription
select pg_temp.assert(
  (select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111') = 'Alice',
  'profil créé avec le nom');

-- 2. Créneaux visibles sans compte (configuration de test : 12 créneaux d'une heure)
select pg_temp.act_as(null);
select pg_temp.assert(
  (select count(*) from public.get_available_slots((select park from t), (select day from t), (select day from t))) = 12,
  'le parc propose 12 créneaux par jour');
select pg_temp.assert((select count(*) from public.services) = 5, 'le catalogue est lisible sans compte');
select pg_temp.assert((select count(*) from public.availability_rules) > 0, 'les horaires sont lisibles sans compte');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t))$$, 'permission denied');
select pg_temp.assert((select count(*) from public.bookings) = 0, 'anon ne voit aucune réservation');
select pg_temp.reset_role();

-- 3. Réservation d'Alice, puis le créneau disparaît et Bob ne peut plus le prendre
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_slot((select park from t), (select ten from t), 'dddddddd-0000-4000-8000-000000000001', 'Premier essai');
select pg_temp.assert(
  not exists (select 1 from public.get_available_slots((select park from t), (select day from t), (select day from t)) s where s.starts_at = (select ten from t)),
  'le créneau réservé n''est plus proposé');
select pg_temp.expect_error(
  $$select public.book_slot((select park from t), (select ten from t), 'dddddddd-0000-4000-8000-000000000002')$$,
  'dog_not_found');
select pg_temp.reset_role();

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t))$$, 'slot_unavailable');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t) + interval '15 minutes')$$, 'slot_unavailable');
select pg_temp.assert((select count(*) from public.bookings) = 0, 'Bob ne voit pas la réservation d''Alice');
select pg_temp.assert((select count(*) from public.dogs) = 1, 'Bob ne voit que son chien');
-- Pas d'écriture directe dans l'agenda
select pg_temp.expect_error(
  $$insert into public.appointments (resource_id, service_id, period) values ('00000000-0000-4000-a000-000000000001', (select park from t), tstzrange((select ten from t) + interval '2 hours', (select ten from t) + interval '3 hours'))$$,
  'row-level security');
-- Pas d'élévation de privilèges
select pg_temp.expect_error($$update public.profiles set role = 'admin' where id = '22222222-2222-4222-8222-222222222222'$$, 'permission denied');
update public.profiles set full_name = 'Bob' where id = '22222222-2222-4222-8222-222222222222';
select pg_temp.reset_role();
select pg_temp.assert(
  (select full_name from public.profiles where id = '22222222-2222-4222-8222-222222222222') = 'Bob',
  'un client peut modifier son nom');

-- 4. Contrainte d'exclusion : même l'admin ne peut pas créer de chevauchement
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.expect_error(
  $$insert into public.appointments (resource_id, service_id, period) values ('00000000-0000-4000-a000-000000000001', (select park from t), tstzrange((select ten from t) + interval '30 minutes', (select ten from t) + interval '90 minutes'))$$,
  'appointments_no_overlap');
select pg_temp.assert((select count(*) from public.bookings) = 1, 'l''admin voit toutes les réservations');
select pg_temp.reset_role();

-- 5. Buffer de trajet : un bilan à domicile bloque 30 min avant et après
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.book_slot((select bilan from t), (select ten from t));
select pg_temp.assert(
  not exists (
    select 1 from public.get_available_slots((select bilan from t), (select day from t), (select day from t)) s
    where s.starts_at < (select ten from t) + interval '150 minutes'
      and s.ends_at > (select ten from t) - interval '30 minutes'
  ),
  'aucun créneau coaching dans le buffer de trajet');
-- Le parc reste indépendant de l'agenda de la coach
select pg_temp.assert(
  (select count(*) from public.get_available_slots((select park from t), (select day from t), (select day from t))) = 11,
  'le parc garde ses autres créneaux');
select pg_temp.reset_role();

-- Une prestation désactivée reste visible dans l'historique du client
update public.services set active = false where id = (select bilan from t);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.assert(
  (select count(*) from public.bookings b join public.appointments a on a.id = b.appointment_id join public.services s on s.id = a.service_id) = 1,
  'la réservation d''une prestation désactivée reste lisible');
select pg_temp.expect_error($$select public.book_slot((select bilan from t), (select ten from t) + interval '1 day')$$, 'service_not_found');
select pg_temp.reset_role();
update public.services set active = true where id = (select bilan from t);

-- 6. Annulation : délai respecté → créneau libéré ; réservation d'autrui → refus
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_error(
  $$select public.cancel_booking((select id from public.bookings where client_id = '11111111-1111-4111-8111-111111111111' limit 1))$$,
  'booking_not_found');
select pg_temp.reset_role();

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.cancel_booking((select id from public.bookings where client_id = '11111111-1111-4111-8111-111111111111'));
select pg_temp.assert(
  exists (select 1 from public.get_available_slots((select park from t), (select day from t), (select day from t)) s where s.starts_at = (select ten from t)),
  'le créneau annulé redevient disponible');
select pg_temp.reset_role();

-- Annulation trop tardive
insert into public.appointments (id, resource_id, service_id, period, created_by)
values ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000001',
        '00000000-0000-4000-b000-000000000001',
        tstzrange(now() + interval '2 hours', now() + interval '3 hours'), null);
insert into public.bookings (id, appointment_id, client_id)
values ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error($$select public.cancel_booking('bbbbbbbb-0000-4000-8000-000000000001')$$, 'cancellation_too_late');
select pg_temp.reset_role();

-- 7. Atelier de groupe : capacité 4, pas de double inscription
insert into public.appointments (id, resource_id, service_id, period, capacity)
values ('aaaaaaaa-0000-4000-8000-000000000002', '00000000-0000-4000-a000-000000000002',
        '00000000-0000-4000-b000-000000000005',
        tstzrange((select ten from t) + interval '1 day', (select ten from t) + interval '1 day 2 hours'), 4);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_event('aaaaaaaa-0000-4000-8000-000000000002', null, null, 3);
select pg_temp.expect_error($$select public.book_event('aaaaaaaa-0000-4000-8000-000000000002')$$, 'already_booked');
select pg_temp.assert(
  (select remaining from public.get_available_slots((select atelier from t), (select day from t), (select day from t) + 2)) = 1,
  'il reste une place à l''atelier');
select pg_temp.reset_role();

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_error($$select public.book_event('aaaaaaaa-0000-4000-8000-000000000002', null, null, 2)$$, 'appointment_full');
select public.book_event('aaaaaaaa-0000-4000-8000-000000000002');
select pg_temp.assert(
  (select count(*) from public.get_available_slots((select atelier from t), (select day from t), (select day from t) + 2)) = 0,
  'un atelier complet n''est plus proposé');
select pg_temp.reset_role();

-- 8. Statut du parc et accès caméra
-- Hors réservation pendant les heures d'ouverture → libre, direct public.
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000001', extract(isodow from now() at time zone 'Europe/Brussels'), '00:00', '23:59:59', current_date - 1;
delete from public.appointments where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select pg_temp.act_as(null);
select pg_temp.assert((select status from public.get_resource_status('park')) = 'free', 'parc libre');
select pg_temp.assert((select mode from public.camera_access('park')) = 'public', 'direct public quand le parc est libre');
select pg_temp.reset_role();
-- Une fermeture imminente borne l'état « libre » et l'accès public au direct.
insert into public.blackouts (id, resource_id, period, reason)
values ('cccccccc-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000001',
        tstzrange(now() + interval '4 minutes', now() + interval '1 hour'), 'entretien');
select pg_temp.act_as(null);
select pg_temp.assert((select until from public.get_resource_status('park')) = now() + interval '4 minutes', 'libre jusqu''à la fermeture');
select pg_temp.assert((select expires_at from public.camera_access('park')) = now() + interval '4 minutes', 'direct public coupé à la fermeture');
select pg_temp.reset_role();
delete from public.blackouts where id = 'cccccccc-0000-4000-8000-000000000001';
select pg_temp.act_as(null);
select pg_temp.expect_error($$select * from public.cameras$$, 'permission denied');
select pg_temp.reset_role();

-- Réservation en cours d'Alice → réservé, direct privé.
insert into public.appointments (id, resource_id, service_id, period)
values ('aaaaaaaa-0000-4000-8000-000000000003', '00000000-0000-4000-a000-000000000001',
        '00000000-0000-4000-b000-000000000001',
        tstzrange(now() - interval '10 minutes', now() + interval '50 minutes'));
insert into public.bookings (appointment_id, client_id)
values ('aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111');

select pg_temp.act_as(null);
select pg_temp.assert((select status from public.get_resource_status('park')) = 'reserved', 'parc réservé');
select pg_temp.assert((select mode from public.camera_access('park')) = 'denied', 'direct fermé au public pendant une réservation');
select pg_temp.reset_role();
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.assert((select mode from public.camera_access('park')) = 'denied', 'un autre client ne voit pas le direct privé');
select pg_temp.reset_role();
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select mode from public.camera_access('park')) = 'private', 'le client du créneau voit son chien');
select pg_temp.assert((select expires_at from public.camera_access('park')) <= now() + interval '10 minutes', 'accès borné dans le temps');
select pg_temp.reset_role();
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.assert((select mode from public.camera_access('park')) = 'admin', 'l''admin garde l''accès');
select pg_temp.reset_role();

-- 9. Suppression de compte : libère les créneaux à venir et efface les données
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.delete_my_account();
select pg_temp.reset_role();
select pg_temp.assert(not exists (select 1 from auth.users where id = '22222222-2222-4222-8222-222222222222'), 'compte supprimé');
select pg_temp.assert(not exists (select 1 from public.dogs where owner_id = '22222222-2222-4222-8222-222222222222'), 'chiens supprimés');
select pg_temp.assert(
  (select count(*) from public.get_available_slots((select bilan from t), (select day from t), (select day from t))) > 0
  and exists (
    select 1 from public.get_available_slots((select bilan from t), (select day from t), (select day from t)) s
    where s.starts_at = (select ten from t)
  ),
  'le créneau coaching de Bob est libéré');

rollback;
