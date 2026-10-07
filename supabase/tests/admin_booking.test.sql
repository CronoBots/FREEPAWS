-- Tests : rendez-vous posé par l'administratrice, accès temporaire des secours.
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

create temp table t as
select (select id from public.services where slug = 'bilan-cohabitation') as bilan,
       ((current_date + 5) + time '19:00') at time zone 'Europe/Brussels' as evening;
grant select on t to anon, authenticated;

-- Un client ne peut pas poser de rendez-vous pour un autre.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error($$select public.admin_book_for_client((select bilan from t), '11111111-1111-4111-8111-111111111111', (select evening from t), 90)$$, 'not_authorized');
select pg_temp.reset_role();

-- L'administratrice pose un suivi de 90 min un soir, hors horaires et sans réservation en ligne.
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select public.admin_book_for_client((select bilan from t), '11111111-1111-4111-8111-111111111111', (select evening from t), 90, 'Rue Test 1', 'Suivi');
select pg_temp.assert((select upper(period) - lower(period) from public.appointments) = interval '90 minutes', 'durée libre');
select pg_temp.expect_error($$select public.admin_book_for_client((select bilan from t), '11111111-1111-4111-8111-111111111111', (select evening from t) + interval '30 minutes', 60)$$, 'slot_unavailable');
select pg_temp.expect_error($$select public.admin_book_for_client((select bilan from t), '11111111-1111-4111-8111-111111111111', (select evening from t), 5)$$, 'invalid_duration');
select pg_temp.reset_role();
select pg_temp.assert((select client_id from public.bookings) = '11111111-1111-4111-8111-111111111111', 'réservation au nom du client');
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'booking_confirmed'), 'confirmation au client');
select pg_temp.assert(not exists (select 1 from public.notifications where kind = 'admin_new_booking'), 'pas d''alerte à elle-même');

-- Accès secours : valable jusqu'à expiration ou révocation, 7 jours au plus.
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
insert into public.rescue_access (label, expires_at) values ('Zone de secours (test)', now() + interval '4 hours');
select pg_temp.expect_error($$insert into public.rescue_access (expires_at) values (now() + interval '8 days')$$, 'check');
select pg_temp.reset_role();
create temp table tok as select token from public.rescue_access;
grant select on tok to anon;
select pg_temp.act_as(null);
select pg_temp.assert((select mode from public.rescue_camera_access((select token from tok))) = 'rescue', 'accès secours valable');
select pg_temp.assert((select mode from public.rescue_camera_access(repeat('b', 64))) = 'denied', 'lien inconnu refusé');
select pg_temp.assert((select count(*) from public.rescue_access) = 0, 'liste des accès invisible sans compte admin');
select pg_temp.reset_role();
update public.rescue_access set revoked_at = now();
select pg_temp.act_as(null);
select pg_temp.assert((select mode from public.rescue_camera_access((select token from tok))) = 'denied', 'accès révoqué');
select pg_temp.reset_role();

rollback;
