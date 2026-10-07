-- Tests des notifications : file d'attente remplie par les triggers, rappel, réclamation.
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
  ('33333333-3333-4333-8333-333333333333', 'admin@freepaws.be');
update public.profiles set role = 'admin' where id = '33333333-3333-4333-8333-333333333333';

-- Configuration de TEST : parc ouvert, réservable, horaires larges, alertes activées.
update public.resources set is_open = true where slug = 'park';
update public.services set booking_enabled = true, min_notice_hours = 1, max_advance_days = 60, cancel_notice_hours = 0
  where slug = 'park-session';
update public.settings set admin_email = 'admin@example.com';
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000001', d, '08:00', '20:00', date '2026-01-01' from generate_series(1, 7) d;

create temp table t as
select (current_date + 4 + time '10:00') at time zone 'Europe/Brussels' as ten,
       (current_date + 5 + time '10:00') at time zone 'Europe/Brussels' as later,
       (current_date + 1 + time '12:00') at time zone 'Europe/Brussels' as soon,
       (select id from public.services where slug = 'park-session') as park;
grant select on t to anon, authenticated;

create function pg_temp.kinds() returns text language sql as $$
  select coalesce(string_agg(kind::text, ',' order by kind::text), '') from public.notifications where sent_at is null
$$;

-- Réservation : confirmation, alerte admin, rappel 48 h avant.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_slot((select park from t), (select ten from t));
select pg_temp.reset_role();
select pg_temp.assert(pg_temp.kinds() = 'admin_new_booking,booking_confirmed,booking_reminder', 'réservation : ' || pg_temp.kinds());
select pg_temp.assert(
  (select send_after from public.notifications where kind = 'booking_reminder') = (select ten from t) - interval '48 hours',
  'rappel 48 h avant le rendez-vous');

-- Les clients ne lisent pas la file.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.notifications) = 0, 'file invisible pour un client');
select pg_temp.expect_error($$select public.claim_notifications()$$, 'permission denied');
select pg_temp.reset_role();

-- Report : l'ancien rappel est remplacé.
delete from public.notifications;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.reschedule_booking((select id from public.bookings limit 1), (select later from t));
select pg_temp.reset_role();
select pg_temp.assert(pg_temp.kinds() = 'admin_booking_rescheduled,booking_reminder,booking_rescheduled', 'report : ' || pg_temp.kinds());
select pg_temp.assert(
  (select send_after from public.notifications where kind = 'booking_reminder') = (select later from t) - interval '48 hours',
  'rappel recalé sur le nouveau créneau');

-- Annulation par l'administratrice : email au client, pas d'alerte à elle-même, rappel retiré.
delete from public.notifications where kind <> 'booking_reminder';
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select public.cancel_booking((select id from public.bookings limit 1));
select pg_temp.reset_role();
select pg_temp.assert(pg_temp.kinds() = 'booking_cancelled', 'annulation admin : ' || pg_temp.kinds());

-- Rendez-vous dans moins de 48 h : pas de rappel.
delete from public.notifications;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_slot((select park from t), (select soon from t));
select pg_temp.reset_role();
select pg_temp.assert(pg_temp.kinds() = 'admin_new_booking,booking_confirmed', 'sans rappel : ' || pg_temp.kinds());

-- Réclamation : une seule fois tant que le verrou court, rappels futurs exclus.
set local role service_role;
select pg_temp.assert((select count(*) from public.claim_notifications()) = 2, 'deux notifications dues');
select pg_temp.assert((select count(*) from public.claim_notifications()) = 0, 'pas de double envoi');
reset role;

rollback;
