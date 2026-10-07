-- Tests phase 2 : fiches, vaccins, conditions d'accès, sanctions, urgence, audit, MFA, liste d'attente.
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

-- Configuration de TEST : parc ouvert et réservable, fiches exigées, un vaccin exigé.
update public.resources set is_open = true where slug = 'park';
update public.services set booking_enabled = true, min_notice_hours = 1, max_advance_days = 60,
  cancel_notice_hours = 0, requires_park_profile = true, max_people = 4
  where slug = 'park-session';
update public.settings set admin_email = 'admin@example.com', min_dog_age_months = 6;
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000001', d, '08:00', '20:00', date '2026-01-01' from generate_series(1, 7) d;
insert into public.vaccine_types (id, name) values ('99999999-9999-4999-8999-999999999999', 'Vaccin test');

create temp table t as
select (current_date + 4 + time '10:00') at time zone 'Europe/Brussels' as ten,
       (current_date + 5 + time '10:00') at time zone 'Europe/Brussels' as later,
       (select id from public.services where slug = 'park-session') as park;
grant select on t to anon, authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into public.dogs (id, name, birth_date) values ('d0000000-0000-4000-8000-000000000001', 'Nami', current_date - 1000);
insert into public.dogs (id, name, birth_date) values ('d0000000-0000-4000-8000-000000000002', 'Chiot', current_date - 60);

-- Le propriétaire ne peut pas poser le drapeau « chien à protocole ».
update public.dogs set protocol = true where id = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.assert(not (select protocol from public.dogs where id = 'd0000000-0000-4000-8000-000000000001'), 'protocole réservé à l''admin');

select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t), p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid])$$, 'profile_incomplete');
update public.profiles set birth_date = current_date - interval '17 years', emergency_contact_name = 'Paul', emergency_contact_phone = '+32 400 00 00 00'
  where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t), p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid])$$, 'not_adult');
update public.profiles set birth_date = date '1990-01-01' where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t), p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid])$$, 'insurance_missing');
update public.profiles set insurance_company = 'Assureur', insurance_valid_until = current_date + 2 where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t), p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid])$$, 'insurance_expired');
update public.profiles set insurance_valid_until = current_date + 365 where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t))$$, 'dog_required');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t), p_dog_ids => array['d0000000-0000-4000-8000-000000000002'::uuid])$$, 'dog_too_young');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t), p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid])$$, 'vaccination_missing');

-- Vaccination saisie par le propriétaire : en attente, même s'il tente de la valider lui-même.
insert into public.dog_vaccinations (id, dog_id, vaccine_type_id, vaccinated_on, valid_until, status)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '99999999-9999-4999-8999-999999999999', current_date - 30, current_date + 300, 'validated');
select pg_temp.assert((select status from public.dog_vaccinations) = 'pending', 'vaccination en attente');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t), p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid])$$, 'vaccination_missing');
select pg_temp.reset_role();
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'admin_vaccination_to_review'), 'alerte admin : vaccin à valider');

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
update public.dog_vaccinations set status = 'validated';
update public.dogs set protocol = true, protocol_note = 'Réactif' where id = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.reset_role();
select pg_temp.assert((select reviewed_by from public.dog_vaccinations) = '33333333-3333-4333-8333-333333333333', 'validation tracée');
select pg_temp.assert((select protocol from public.dogs where id = 'd0000000-0000-4000-8000-000000000001'), 'protocole posé par l''admin');
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'vaccination_reviewed'), 'propriétaire prévenu');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t), p_adults_count => 3, p_children_count => 2, p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid])$$, 'too_many_people');
select public.book_slot((select park from t), (select ten from t), p_adults_count => 2,
  p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid]);
select pg_temp.assert((select dogs_count from public.bookings) = 1, 'nombre de chiens déduit');
select pg_temp.assert((select count(*) from public.booking_dogs) = 1, 'chien lié à la réservation');
select public.set_booking_guests((select id from public.bookings), '[{"full_name":"Invitée","email":"i@example.com"},{"full_name":" "}]');
select pg_temp.assert((select count(*) from public.booking_guests) = 1, 'invités enregistrés (lignes vides ignorées)');
select pg_temp.expect_error($$select public.raise_emergency()$$, 'no_current_booking');
select pg_temp.assert((select export_my_data() -> 'dogs' -> 0 ->> 'protocol') is null, 'export : pas de champ admin');
select pg_temp.assert(jsonb_array_length(public.export_my_data() -> 'bookings') = 1, 'export : réservations');
select pg_temp.reset_role();

-- Réservation en cours : bouton urgence et mode urgence.
update public.appointments set period = tstzrange(now() - interval '10 minutes', now() + interval '35 minutes');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.assert(public.raise_emergency('Chute') is not null, 'urgence déclenchée');
select pg_temp.expect_error($$select public.get_emergency_overview()$$, 'not_authorized');
select pg_temp.reset_role();
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'admin_emergency'), 'admin alertée');
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.assert((public.get_emergency_overview() -> 0 -> 'dogs' -> 0 ->> 'protocol')::boolean, 'mode urgence : chien à protocole');
select pg_temp.assert(public.get_emergency_overview() -> 0 ->> 'emergency_contact_phone' = '+32 400 00 00 00', 'mode urgence : contact d''urgence');
select pg_temp.assert(jsonb_array_length(public.get_emergency_overview() -> 0 -> 'emergencies') = 1, 'mode urgence : alerte ouverte');
select pg_temp.assert((public.admin_stats(current_date - 1, current_date + 1) ->> 'bookings')::int = 1, 'statistiques');

-- Sanctions : une suspension bloque la réservation.
insert into public.sanctions (user_id, level, reason, ends_at) values ('11111111-1111-4111-8111-111111111111', 'suspension', 'Test', now() + interval '7 days');
select pg_temp.reset_role();
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select later from t), p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid])$$, 'account_suspended');
select pg_temp.reset_role();

-- Historique : la validation du vaccin et la modification du profil sont journalisées.
select pg_temp.assert(exists (select 1 from public.audit_log where table_name = 'dog_vaccinations' and actor_is_admin and changes ? 'status'), 'audit : validation');
select pg_temp.assert(exists (select 1 from public.audit_log where table_name = 'profiles' and changes ? 'insurance_valid_until'), 'audit : profil');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.audit_log) = 0, 'audit invisible pour un client');
select pg_temp.reset_role();

-- Liste d'attente : Bob attend le jour de la réservation d'Alice, l'annulation le prévient.
update public.appointments set period = tstzrange((select ten from t), (select ten from t) + interval '45 minutes');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
insert into public.waitlist_entries (service_id, day) values ((select park from t), ((select ten from t) at time zone 'Europe/Brussels')::date);
select pg_temp.reset_role();
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select public.cancel_booking((select id from public.bookings limit 1));
select pg_temp.reset_role();
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'waitlist_slot_freed' and profile_id = '22222222-2222-4222-8222-222222222222'), 'liste d''attente prévenue');

-- Alertes d'échéance : assurance dans 20 jours, une seule alerte même si la tâche tourne deux fois.
update public.profiles set insurance_valid_until = current_date + 20 where id = '11111111-1111-4111-8111-111111111111';
select public.enqueue_expiry_alerts();
select public.enqueue_expiry_alerts();
select pg_temp.assert((select count(*) from public.notifications where kind = 'insurance_expiring') = 1, 'alerte assurance unique');

-- Double authentification : un facteur vérifié exige une session aal2.
insert into auth.mfa_factors (user_id, status) values ('33333333-3333-4333-8333-333333333333', 'verified');
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.assert(not public.is_admin(), 'admin sans second facteur : pas de droits');
select pg_temp.assert(public.my_role() = 'admin', 'rôle connu pour demander le second facteur');
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
select pg_temp.assert(public.is_admin(), 'admin en aal2');
select pg_temp.expect_error($$select public.set_user_role('33333333-3333-4333-8333-333333333333', 'client')$$, 'last_admin');
select public.set_user_role('22222222-2222-4222-8222-222222222222', 'admin');
select pg_temp.reset_role();
select pg_temp.assert((select role from public.profiles where id = '22222222-2222-4222-8222-222222222222') = 'admin', 'rôle attribué');

rollback;
