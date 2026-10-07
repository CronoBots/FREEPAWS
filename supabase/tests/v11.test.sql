-- Tests cahier v1.1 : chiens du groupe, règles de santé (avertissement / blocage), questionnaire, push.
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
update public.profiles set birth_date = '1990-01-01', emergency_contact_name = 'P', emergency_contact_phone = '1',
  insurance_company = 'A', insurance_valid_until = current_date + 365 where id = '11111111-1111-4111-8111-111111111111';

-- Configuration de TEST.
update public.resources set is_open = true;
update public.services set booking_enabled = true, min_notice_hours = 0, max_advance_days = 60, cancel_notice_hours = 0,
  requires_park_profile = true where slug = 'park-session';
update public.services set booking_enabled = true, min_notice_hours = 0, max_advance_days = 60
  where slug = 'bilan-cohabitation';
update public.settings set admin_email = 'admin@example.com', heat_rule = 'warn', antiparasitic_rule = 'block';
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select r.id, d, '08:00', '20:00', date '2026-01-01' from public.resources r, generate_series(1, 7) d;

create temp table t as
select (select id from public.services where slug = 'park-session') as park,
       (select id from public.services where slug = 'bilan-cohabitation') as bilan,
       ((current_date + 3) + time '10:00') at time zone 'Europe/Brussels' as ten,
       ((current_date + 4) + time '10:00') at time zone 'Europe/Brussels' as later;
grant select on t to anon, authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into public.dogs (id, name, sex, in_heat, antiparasitic_until)
values ('d0000000-0000-4000-8000-000000000001', 'Nala', 'female', true, current_date + 100);

-- Aperçu : avertissement chaleurs (mode « avertissement »), pas de blocage.
select pg_temp.assert((select check_park_eligibility((select park from t), (select ten from t), array['d0000000-0000-4000-8000-000000000001'::uuid]) ->> 'error') is null, 'aperçu : pas de blocage');
select pg_temp.assert((select check_park_eligibility((select park from t), (select ten from t), array['d0000000-0000-4000-8000-000000000001'::uuid]) -> 'warnings' ->> 0) = 'dog_in_heat:Nala', 'aperçu : avertissement chaleurs');

-- Chiens du groupe : certification obligatoire.
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t),
  p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid],
  p_group_dogs => '[{"name":"Rex","breed":"Malinois","size":"large","protocol":true}]')$$, 'group_certification_required');
select pg_temp.expect_error($$select public.book_slot((select park from t), (select ten from t),
  p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid],
  p_group_dogs => '[{"name":"A"},{"name":"B"},{"name":"C"},{"name":"D"},{"name":"E"}]', p_group_certified => true)$$, 'too_many_dogs');
select public.book_slot((select park from t), (select ten from t),
  p_dog_ids => array['d0000000-0000-4000-8000-000000000001'::uuid],
  p_group_dogs => '[{"name":"Rex","breed":"Malinois","size":"large","protocol":true},{"name":" "}]', p_group_certified => true);
select pg_temp.assert((select dogs_count from public.bookings) = 2, 'chiens : 1 + 1 du groupe');
select pg_temp.assert((select group_certified_at is not null and jsonb_array_length(group_dogs) = 1 from public.bookings), 'groupe certifié');
select pg_temp.assert((select health_warnings from public.bookings) = array['dog_in_heat:Nala'], 'avertissement enregistré');
select pg_temp.reset_role();

-- Mode urgence : chiens du groupe visibles.
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
update public.appointments set period = tstzrange(now() - interval '5 minutes', now() + interval '40 minutes');
select pg_temp.assert((public.get_emergency_overview() -> 0 -> 'group_dogs' -> 0 ->> 'protocol')::boolean, 'urgence : chien à protocole du groupe');
select pg_temp.reset_role();

-- Règle bloquante : antiparasitaire échu.
update public.dogs set antiparasitic_until = current_date - 1;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select check_park_eligibility((select park from t), (select later from t), array['d0000000-0000-4000-8000-000000000001'::uuid]) ->> 'error') = 'antiparasitic_missing', 'aperçu : blocage');
select pg_temp.reset_role();

-- Groupe sans chien du responsable : accepté si certifié.
update public.dogs set antiparasitic_until = current_date + 100;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_slot((select park from t), (select later from t),
  p_group_dogs => '[{"name":"Max"}]', p_group_certified => true);
select pg_temp.reset_role();

-- Questionnaire pré-visite : questions de l'administratrice, réponses du client.
insert into public.questionnaire_questions (id, service_id, position, kind, label, required)
select 'f0000000-0000-4000-8000-000000000001', bilan, 1, 'long_text', 'Question test 1', true from t;
insert into public.questionnaire_questions (id, service_id, position, kind, label, options)
select 'f0000000-0000-4000-8000-000000000002', bilan, 2, 'single_choice', 'Question test 2', '[{"value":"a","label":"A"}]' from t;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.book_slot((select bilan from t), ((current_date + 6) + time '10:00') at time zone 'Europe/Brussels', p_visit_address => 'Rue 1');
create temp table bk as select id from public.bookings b where exists (
  select 1 from public.appointments a where a.id = b.appointment_id and a.service_id = (select bilan from t));
grant select on bk to authenticated;
select pg_temp.expect_error($$select public.submit_questionnaire((select id from bk), '{"f0000000-0000-4000-8000-000000000001":" "}')$$, 'questionnaire_incomplete');
select public.submit_questionnaire((select id from bk), '{"f0000000-0000-4000-8000-000000000001":"Réponse","f0000000-0000-4000-8000-000000000002":"a","intrus":"x"}');
select pg_temp.assert((select answers from public.questionnaire_responses) = '{"f0000000-0000-4000-8000-000000000001":"Réponse","f0000000-0000-4000-8000-000000000002":"a"}', 'réponses enregistrées, clés inconnues ignorées');
select pg_temp.assert(jsonb_array_length((select questions_snapshot from public.questionnaire_responses)) = 2, 'libellés copiés');
select pg_temp.reset_role();
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select pg_temp.assert((select count(*) from public.questionnaire_responses) = 0, 'réponses invisibles pour un autre client');
select pg_temp.expect_error($$select public.submit_questionnaire((select id from bk), '{}')$$, 'booking_not_found');
-- Jetons push : chacun ne voit que les siens.
insert into public.push_tokens (token, platform) values ('ExponentPushToken[bob]', 'ios');
select pg_temp.reset_role();
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.push_tokens) = 0, 'jetons push privés');
select pg_temp.reset_role();
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'admin_questionnaire_submitted'), 'admin prévenue des réponses');

rollback;
