-- Tests : tarification, jours complets, agenda importé, critères d'admission, live des invités.
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

-- Configuration de TEST : parc ouvert, 08:00–10:00 tous les jours, prix 20 €, fiche non exigée.
update public.resources set is_open = true where slug = 'park';
update public.services set requires_park_profile = false, booking_enabled = true, min_notice_hours = 0,
  max_advance_days = 60, cancel_notice_hours = 0, price_cents = 2000, price_visible = true
  where slug = 'park-session';
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000001', d, '08:00', '10:00', date '2026-01-01' from generate_series(1, 7) d;

create temp table t as
select (select id from public.services where slug = 'park-session') as park,
       current_date + 10 as d10,
       ((current_date + 10) + time '08:00') at time zone 'Europe/Brussels' as eight,
       ((current_date + 10) + time '09:00') at time zone 'Europe/Brussels' as nine;
grant select on t to anon, authenticated;

-- Tarifs : heures creuses −25 % de 8 h à 9 h le jour J, +5 € par chien au-delà de 2, forfait groupe 50 € dès 3 invités.
insert into public.pricing_rules (service_id, kind, label, weekdays, start_time, end_time, adjustment, value)
select park, 'off_peak', 'Heures creuses', array[extract(isodow from d10)::smallint], '08:00', '09:00', 'percent', -25 from t;
insert into public.pricing_rules (service_id, kind, label, adjustment, value, threshold)
select park, 'extra_dog', 'Chien supplémentaire', 'amount', 500, 2 from t;
insert into public.pricing_rules (service_id, kind, label, adjustment, value, threshold)
select park, 'group', 'Forfait groupe', 'fixed', 5000, 3 from t;

select pg_temp.assert((select price_cents from public.quote_price((select park from t), (select eight from t), 1, 0)) = 1500, 'heures creuses −25 %');
select pg_temp.assert((select price_cents from public.quote_price((select park from t), (select nine from t), 1, 0)) = 2000, 'tarif plein');
select pg_temp.assert((select price_cents from public.quote_price((select park from t), (select nine from t), 4, 0)) = 3000, '2 chiens supplémentaires');
select pg_temp.assert((select price_cents from public.quote_price((select park from t), (select nine from t), 1, 3)) = 5000, 'forfait groupe');
select pg_temp.assert((select 'Heures creuses' = any (labels) from public.quote_price((select park from t), (select eight from t), 1, 0)), 'libellé affiché');
-- Jour férié : la règle s'applique aussi le lendemain si cochée « jours fériés ».
update public.pricing_rules set on_public_holidays = true where kind = 'off_peak';
insert into public.calendar_days (day, kind, label) select d10 + 1, 'public_holiday', 'Férié (test)' from t;
select pg_temp.assert((select price_cents from public.quote_price((select park from t), (select eight from t) + interval '1 day', 1, 0)) = 1500, 'jour férié');
update public.services set price_visible = false where slug = 'park-session';
select pg_temp.assert((select price_cents from public.quote_price((select park from t), (select nine from t), 1, 0)) is null, 'prix masqué');

-- Réservation : prix calculé côté serveur, invités enregistrés avec la réservation.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_slot((select park from t), (select eight from t), p_dogs_count => 3,
  p_guests => '[{"full_name":"Invitée","email":"i@example.com"}]');
select pg_temp.assert((select price_cents from public.bookings) = 2000, 'prix réservé : −25 % + 1 chien supplémentaire');
select pg_temp.assert((select count(*) from public.booking_guests) = 1, 'invité enregistré');
select public.set_booking_guests((select id from public.bookings),
  '[{"full_name":"Invitée","email":"i@example.com"},{"full_name":"B"},{"full_name":"C"}]');
select pg_temp.assert((select price_cents from public.bookings) = 4250, 'forfait groupe (50 €) − 25 % + 1 chien supplémentaire');
select pg_temp.reset_role();
select pg_temp.assert((select count(*) from public.booking_guests where full_name = 'Invitée') = 1, 'invité conservé (même lien)');
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'guest_live_link'), 'lien live programmé');

-- Live invité : pas encore commencé, puis en cours, puis lien inconnu.
create temp table tok as select access_token from public.booking_guests where full_name = 'Invitée';
grant select on tok to anon;
select pg_temp.act_as(null);
select pg_temp.assert((select mode from public.guest_camera_access((select access_token from tok))) = 'profile_required', 'profil invité à compléter (M2-10)');
select pg_temp.expect_error($$select public.complete_guest_profile((select access_token from tok), '{"full_name":"Invitée"}', '{}')$$, 'profile_incomplete');
select public.complete_guest_profile((select access_token from tok),
  '{"full_name":"Invitée","email":"i@example.com","emergency_contact_name":"Paul","emergency_contact_phone":"+32 400","dog":{"name":"Rex","size":"large","protocol":true}}', '{}');
select pg_temp.assert((select get_guest_invitation((select access_token from tok)) ->> 'profile_completed')::boolean, 'profil complété');
select pg_temp.assert((select mode from public.guest_camera_access((select access_token from tok))) = 'not_started', 'pas encore commencé');
select pg_temp.assert((select mode from public.guest_camera_access(repeat('a', 64))) = 'denied', 'lien inconnu');
select pg_temp.reset_role();
update public.appointments set period = tstzrange(now() - interval '5 minutes', now() + interval '40 minutes');
select pg_temp.act_as(null);
select pg_temp.assert((select mode from public.guest_camera_access((select access_token from tok))) = 'private', 'live pendant le créneau');
select pg_temp.reset_role();

-- Annulation : les liens non envoyés disparaissent.
update public.appointments set period = tstzrange((select eight from t), (select eight from t) + interval '45 minutes');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.cancel_booking((select id from public.bookings));
select pg_temp.reset_role();
select pg_temp.assert(not exists (select 1 from public.notifications where kind = 'guest_live_link' and sent_at is null), 'liens retirés à l''annulation');

-- Jours complets : les deux créneaux du jour J pris → J est complet.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_slot((select park from t), (select eight from t));
select public.book_slot((select park from t), (select nine from t));
select pg_temp.assert((select array_agg(d) from public.get_full_days((select park from t), (select d10 from t), (select d10 from t) + 1) d) = array[(select d10 from t)], 'jour complet détecté');
select pg_temp.reset_role();

-- Agenda importé : un rendez-vous personnel bloque le créneau.
insert into public.calendar_feeds (id, resource_id, url) values ('ffffffff-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000001', 'https://example.com/a.ics');
select pg_temp.assert(public.replace_external_busy('ffffffff-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('start', (select eight from t) + interval '2 days', 'end', (select eight from t) + interval '2 days 2 hours'))) = 1, 'événement importé');
select pg_temp.assert(not exists (select 1 from public.get_available_slots((select park from t), (select d10 from t) + 2, (select d10 from t) + 2)), 'créneaux bloqués par l''agenda');
select public.replace_external_busy('ffffffff-0000-4000-8000-000000000001', '[]');
select pg_temp.assert(exists (select 1 from public.get_available_slots((select park from t), (select d10 from t) + 2, (select d10 from t) + 2)), 'synchronisation suivante : libéré');
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.assert((select count(*) from public.calendar_feeds) = 1, 'admin lit les agendas');
select pg_temp.reset_role();
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.calendar_feeds) = 0, 'adresse secrète invisible pour un client');
select pg_temp.reset_role();

-- Critères d'admission : chien malade, antiparasitaire.
update public.services set requires_park_profile = true where slug = 'park-session';
update public.settings set illness_rule = 'block', antiparasitic_rule = 'block';
update public.profiles set birth_date = '1990-01-01', emergency_contact_name = 'P', emergency_contact_phone = '1',
  insurance_company = 'A', insurance_valid_until = current_date + 365 where id = '11111111-1111-4111-8111-111111111111';
insert into public.dogs (id, owner_id, name, currently_ill) values ('d0000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Rex', true);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select eight from t) + interval '3 days', p_dog_ids => array['d0000000-0000-4000-8000-000000000009'::uuid])$$, 'dog_ill');
update public.dogs set currently_ill = false;
select pg_temp.expect_error($$select public.book_slot((select park from t), (select eight from t) + interval '3 days', p_dog_ids => array['d0000000-0000-4000-8000-000000000009'::uuid])$$, 'antiparasitic_missing');
select pg_temp.reset_role();

rollback;
