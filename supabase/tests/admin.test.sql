-- Tests des outils d'administration : fermeture exceptionnelle.
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

-- Configuration de TEST : parc ouvert, réservable, horaires larges.
update public.resources set is_open = true where slug = 'park';
update public.services set requires_park_profile = false, booking_enabled = true, min_notice_hours = 1, max_advance_days = 60 where slug = 'park-session';
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000001', d, '08:00', '20:00', date '2026-01-01' from generate_series(1, 7) d;

create temp table t as
select (current_date + 4 + time '10:00') at time zone 'Europe/Brussels' as ten,
       (select id from public.services where slug = 'park-session') as park;
grant select on t to anon, authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_slot((select park from t), (select ten from t));
select pg_temp.expect_error(
  $$select public.close_period('00000000-0000-4000-a000-000000000001', now(), now() + interval '1 day')$$,
  'not_authorized');
select pg_temp.assert(
  public.count_appointments_in_period('00000000-0000-4000-a000-000000000001', now(), now() + interval '10 days') = 0,
  'un client ne compte pas les rendez-vous des autres');
select pg_temp.reset_role();

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.assert(
  public.count_appointments_in_period('00000000-0000-4000-a000-000000000001', (select ten from t) - interval '1 day', (select ten from t) + interval '1 day') = 1,
  'aperçu : 1 rendez-vous touché');
select pg_temp.assert(
  public.close_period('00000000-0000-4000-a000-000000000001', (select ten from t) - interval '1 day',
    (select ten from t) + interval '1 day', 'Entretien', true) = 1,
  'fermeture : 1 rendez-vous annulé');
select pg_temp.reset_role();

select pg_temp.assert(
  (select status from public.bookings limit 1) = 'cancelled', 'la réservation du client est annulée');
select pg_temp.assert(
  not exists (select 1 from public.get_available_slots((select park from t), ((select ten from t) at time zone 'Europe/Brussels')::date, ((select ten from t) at time zone 'Europe/Brussels')::date)),
  'plus aucun créneau pendant la fermeture');
select pg_temp.assert(length((select calendar_token from public.settings)) = 32, 'jeton iCal généré');

rollback;
