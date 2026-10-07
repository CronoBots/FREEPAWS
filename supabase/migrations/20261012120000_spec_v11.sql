-- Cahier des charges v1.1 (7 octobre 2026) : évolutions logicielles.
--   M1-05 / M1-11  questionnaire pré-visite paramétrable, réponses consultables avant la visite
--   M2-06          chiens du groupe listés par le responsable, avec certification
--   M2-09          règles de santé au choix : bloquantes ou simple avertissement
--   M2-10          invitation des participants : profil allégé avant l'accès au direct
--   M6-06 / M9-08  notifications push (appareils enregistrés), dont les alertes d'urgence 24 h/24

-- ---------------------------------------------------------------------------
-- M2-09 : règles de santé « désactivée / avertissement / bloquante »
-- ---------------------------------------------------------------------------

alter table public.settings
  add column min_age_rule text not null default 'off' check (min_age_rule in ('off', 'warn', 'block')),
  add column heat_rule text not null default 'off' check (heat_rule in ('off', 'warn', 'block')),
  add column illness_rule text not null default 'off' check (illness_rule in ('off', 'warn', 'block')),
  add column antiparasitic_rule text not null default 'off' check (antiparasitic_rule in ('off', 'warn', 'block'));

update public.settings set
  min_age_rule = case when min_dog_age_months is not null then 'block' else 'off' end,
  heat_rule = case when refuse_dogs_in_heat then 'block' else 'off' end,
  illness_rule = case when refuse_ill_dogs then 'block' else 'off' end,
  antiparasitic_rule = case when require_antiparasitic then 'block' else 'off' end;

alter table public.settings
  drop column refuse_dogs_in_heat,
  drop column refuse_ill_dogs,
  drop column require_antiparasitic;

-- Écarts de santé d'un chien à une date, avec le mode choisi par l'administratrice.
create or replace function public.dog_health_issues(p_dog public.dogs, p_day date)
returns table (code text, mode text)
language sql
stable
security definer
set search_path = ''
as $$
  select x.code, x.mode
  from public.settings s,
  lateral (values
    ('dog_too_young', s.min_age_rule,
      s.min_dog_age_months is not null and (
        p_dog.birth_date is null
        or p_dog.birth_date > (p_day - make_interval(months => s.min_dog_age_months))::date)),
    ('dog_in_heat', s.heat_rule, p_dog.in_heat),
    ('dog_ill', s.illness_rule, p_dog.currently_ill),
    ('antiparasitic_missing', s.antiparasitic_rule,
      p_dog.antiparasitic_until is null or p_dog.antiparasitic_until < p_day)
  ) as x(code, mode, applies)
  where x.applies and x.mode <> 'off';
$$;

drop function public.assert_eligibility(public.services, uuid, timestamptz, uuid[]);

create function public.assert_eligibility(
  p_service public.services,
  p_uid uuid,
  p_starts_at timestamptz,
  p_dog_ids uuid[],
  p_group_count integer default 0
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_day date := (p_starts_at at time zone 'Europe/Brussels')::date;
  v_dog public.dogs;
  v_block text;
begin
  if p_service.requires_park_profile is not true then
    return;
  end if;

  select * into v_profile from public.profiles where id = p_uid;

  if v_profile.birth_date is null
     or coalesce(trim(v_profile.emergency_contact_name), '') = ''
     or coalesce(trim(v_profile.emergency_contact_phone), '') = '' then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;
  if v_profile.birth_date > (current_date - interval '18 years')::date then
    raise exception 'not_adult' using errcode = 'P0001';
  end if;
  if v_profile.insurance_valid_until is null or coalesce(trim(v_profile.insurance_company), '') = '' then
    raise exception 'insurance_missing' using errcode = 'P0001';
  end if;
  if v_profile.insurance_valid_until < v_day then
    raise exception 'insurance_expired' using errcode = 'P0001';
  end if;

  if coalesce(cardinality(p_dog_ids), 0) + coalesce(p_group_count, 0) = 0 then
    raise exception 'dog_required' using errcode = 'P0001';
  end if;

  for v_dog in select * from public.dogs where id = any (p_dog_ids) loop
    select h.code into v_block from public.dog_health_issues(v_dog, v_day) h where h.mode = 'block' limit 1;
    if v_block is not null then
      raise exception '%', v_block using errcode = 'P0001';
    end if;
    -- Chaque vaccin exigé : une vaccination validée, encore valable le jour de la réservation (M2-04).
    if exists (
      select 1 from public.vaccine_types vt
      where vt.active and vt.required
        and not exists (
          select 1 from public.dog_vaccinations v
          where v.dog_id = v_dog.id and v.vaccine_type_id = vt.id
            and v.status = 'validated' and v.valid_until >= v_day
        )
    ) then
      raise exception 'vaccination_missing' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

-- Avertissements (règles en mode « avertissement ») : « <code>:<nom du chien> ».
create or replace function public.eligibility_warnings(p_service public.services, p_starts_at timestamptz, p_dog_ids uuid[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(h.code || ':' || d.name order by d.name, h.code), '{}')
  from public.dogs d
  cross join lateral public.dog_health_issues(d, (p_starts_at at time zone 'Europe/Brussels')::date) h
  where p_service.requires_park_profile and d.id = any (p_dog_ids) and h.mode = 'warn';
$$;

-- Aperçu avant de confirmer : première règle bloquante (ou null) et avertissements.
create or replace function public.check_park_eligibility(p_service_id uuid, p_starts_at timestamptz, p_dog_ids uuid[], p_group_count integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service public.services;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_service from public.services where id = p_service_id;
  if not found then
    raise exception 'service_not_found' using errcode = 'P0001';
  end if;
  begin
    perform public.assert_dogs_owner(coalesce(p_dog_ids, '{}'), auth.uid());
    perform public.assert_not_sanctioned(auth.uid());
    perform public.assert_eligibility(v_service, auth.uid(), p_starts_at, coalesce(p_dog_ids, '{}'), p_group_count);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('error', sqlerrm, 'warnings', '[]'::jsonb);
  end;
  return jsonb_build_object(
    'error', null,
    'warnings', to_jsonb(public.eligibility_warnings(v_service, p_starts_at, coalesce(p_dog_ids, '{}')))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- M2-06 : chiens du groupe (autres foyers), listés et certifiés par le responsable
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column group_dogs jsonb not null default '[]' check (jsonb_typeof(group_dogs) = 'array'),
  -- Le responsable certifie l'identification (puce, DogID) et la vaccination des chiens du groupe.
  add column group_certified_at timestamptz,
  -- Règles de santé en mode « avertissement » au moment de la réservation (visible par l'administratrice).
  add column health_warnings text[] not null default '{}';

create or replace function public.clean_group_dogs(p_dogs jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_clean jsonb;
begin
  if p_dogs is null then
    return '[]';
  end if;
  if jsonb_typeof(p_dogs) <> 'array' then
    raise exception 'invalid_group_dogs' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', left(trim(d ->> 'name'), 60),
           'breed', nullif(left(trim(d ->> 'breed'), 80), ''),
           'size', case when d ->> 'size' in ('small', 'medium', 'large', 'giant') then d ->> 'size' end,
           'protocol', coalesce((d ->> 'protocol')::boolean, false))), '[]')
  into v_clean
  from jsonb_array_elements(p_dogs) d
  where coalesce(trim(d ->> 'name'), '') <> '';
  if jsonb_array_length(v_clean) > 20 then
    raise exception 'invalid_group_dogs' using errcode = 'P0001';
  end if;
  return v_clean;
end;
$$;

drop function public.book_slot(uuid, timestamptz, uuid, text, text, integer, integer, integer, text, uuid[], uuid[], jsonb);
drop function public.book_event(uuid, uuid, text, integer, integer, integer, integer, text, uuid[], uuid[], jsonb);

create function public.book_slot(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_dog_id uuid default null,
  p_notes text default null,
  p_visit_address text default null,
  p_adults_count integer default null,
  p_children_count integer default null,
  p_dogs_count integer default null,
  p_discount_code text default null,
  p_document_ids uuid[] default null,
  p_dog_ids uuid[] default null,
  p_guests jsonb default null,
  p_group_dogs jsonb default null,
  p_group_certified boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_service public.services;
  v_prep record;
  v_day date;
  v_dogs uuid[] := public.normalize_dog_ids(p_dog_id, p_dog_ids);
  v_dogs_count integer := p_dogs_count;
  v_guests jsonb := public.clean_guests(p_guests);
  v_price integer;
  v_group jsonb := public.clean_group_dogs(p_group_dogs);
  v_warnings text[];
  v_appointment_id uuid;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_service from public.services
  where id = p_service_id and active and booking_enabled and mode = 'slot';
  if not found then
    raise exception 'service_not_found' using errcode = 'P0001';
  end if;

  perform public.assert_not_sanctioned(v_uid);
  perform public.assert_dogs_owner(v_dogs, v_uid);
  if jsonb_array_length(v_group) > 0 and not coalesce(p_group_certified, false) then
    raise exception 'group_certification_required' using errcode = 'P0001';
  end if;
  if cardinality(v_dogs) + jsonb_array_length(v_group) > 0 then
    v_dogs_count := greatest(coalesce(p_dogs_count, 0), cardinality(v_dogs) + jsonb_array_length(v_group));
  end if;
  if v_service.max_people is not null
     and coalesce(p_adults_count, 1) + coalesce(p_children_count, 0) > v_service.max_people then
    raise exception 'too_many_people' using errcode = 'P0001';
  end if;

  v_price := public.compute_price(v_service, p_starts_at, coalesce(v_dogs_count, 1), jsonb_array_length(v_guests));
  select * into v_prep from public.prepare_booking(
    v_service, v_uid, v_dogs[1], p_notes, p_visit_address, p_adults_count, p_children_count,
    v_dogs_count, p_discount_code, p_document_ids, v_price
  );
  perform public.assert_eligibility(v_service, v_uid, p_starts_at, v_dogs, jsonb_array_length(v_group));
  v_warnings := public.eligibility_warnings(v_service, p_starts_at, v_dogs);

  v_day := (p_starts_at at time zone 'Europe/Brussels')::date;
  if not exists (
    select 1 from public.get_available_slots(p_service_id, v_day, v_day) s where s.starts_at = p_starts_at
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  begin
    insert into public.appointments (resource_id, service_id, period, buffer_minutes, capacity, created_by)
    values (
      v_service.resource_id, v_service.id,
      tstzrange(p_starts_at, p_starts_at + make_interval(mins => v_service.duration_minutes)),
      v_service.buffer_minutes, 1, v_uid
    )
    returning id into v_appointment_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end;

  insert into public.bookings (
    appointment_id, client_id, dog_id, client_notes, visit_address, adults_count, children_count,
    dogs_count, price_cents, discount_cents, discount_code_id, group_dogs, group_certified_at, health_warnings
  )
  values (
    v_appointment_id, v_uid, v_dogs[1], nullif(trim(p_notes), ''), nullif(trim(p_visit_address), ''),
    p_adults_count, p_children_count, v_dogs_count, v_prep.price_cents, v_prep.discount_cents,
    v_prep.discount_code_id, v_group,
    case when jsonb_array_length(v_group) > 0 then now() end, coalesce(v_warnings, '{}')
  )
  returning id into v_booking_id;

  insert into public.booking_dogs (booking_id, dog_id) select v_booking_id, unnest(v_dogs);
  perform public.insert_guests(v_booking_id, v_guests);
  perform public.record_acceptances(v_uid, v_booking_id, p_document_ids);
  return v_booking_id;
end;
$$;

create function public.book_event(
  p_appointment_id uuid,
  p_dog_id uuid default null,
  p_notes text default null,
  p_party_size integer default 1,
  p_adults_count integer default null,
  p_children_count integer default null,
  p_dogs_count integer default null,
  p_discount_code text default null,
  p_document_ids uuid[] default null,
  p_dog_ids uuid[] default null,
  p_guests jsonb default null,
  p_group_dogs jsonb default null,
  p_group_certified boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_service public.services;
  v_starts_at timestamptz;
  v_prep record;
  v_dogs uuid[] := public.normalize_dog_ids(p_dog_id, p_dog_ids);
  v_dogs_count integer := p_dogs_count;
  v_guests jsonb := public.clean_guests(p_guests);
  v_price integer;
  v_group jsonb := public.clean_group_dogs(p_group_dogs);
  v_warnings text[];
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_party_size is null or p_party_size not between 1 and 10 then
    raise exception 'invalid_party_size' using errcode = 'P0001';
  end if;

  select s.* into v_service
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.id = p_appointment_id and a.status = 'scheduled'
    and s.active and s.booking_enabled and s.mode = 'event';
  if not found then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;
  select lower(period) into v_starts_at from public.appointments where id = p_appointment_id;
  if v_starts_at < now() + make_interval(hours => v_service.min_notice_hours) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  perform public.assert_not_sanctioned(v_uid);
  perform public.assert_dogs_owner(v_dogs, v_uid);
  if jsonb_array_length(v_group) > 0 and not coalesce(p_group_certified, false) then
    raise exception 'group_certification_required' using errcode = 'P0001';
  end if;
  if cardinality(v_dogs) + jsonb_array_length(v_group) > 0 then
    v_dogs_count := greatest(coalesce(p_dogs_count, 0), cardinality(v_dogs) + jsonb_array_length(v_group));
  end if;
  if v_service.max_people is not null
     and coalesce(p_adults_count, p_party_size) + coalesce(p_children_count, 0) > v_service.max_people then
    raise exception 'too_many_people' using errcode = 'P0001';
  end if;

  v_price := public.compute_price(v_service, v_starts_at, coalesce(v_dogs_count, 1), jsonb_array_length(v_guests));
  select * into v_prep from public.prepare_booking(
    v_service, v_uid, v_dogs[1], p_notes, null, p_adults_count, p_children_count,
    v_dogs_count, p_discount_code, p_document_ids, v_price
  );
  perform public.assert_eligibility(v_service, v_uid, v_starts_at, v_dogs, jsonb_array_length(v_group));
  v_warnings := public.eligibility_warnings(v_service, v_starts_at, v_dogs);

  begin
    insert into public.bookings (
      appointment_id, client_id, dog_id, client_notes, party_size, adults_count, children_count,
      dogs_count, price_cents, discount_cents, discount_code_id, group_dogs, group_certified_at, health_warnings
    )
    values (
      p_appointment_id, v_uid, v_dogs[1], nullif(trim(p_notes), ''), p_party_size, p_adults_count,
      p_children_count, v_dogs_count, v_prep.price_cents, v_prep.discount_cents, v_prep.discount_code_id,
      v_group, case when jsonb_array_length(v_group) > 0 then now() end, coalesce(v_warnings, '{}')
    )
    returning id into v_booking_id;
  exception when unique_violation then
    raise exception 'already_booked' using errcode = 'P0001';
  end;

  insert into public.booking_dogs (booking_id, dog_id) select v_booking_id, unnest(v_dogs);
  perform public.insert_guests(v_booking_id, v_guests);
  perform public.record_acceptances(v_uid, v_booking_id, p_document_ids);
  return v_booking_id;
end;
$$;

create or replace function public.reschedule_booking(p_booking_id uuid, p_starts_at timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_booking public.bookings;
  v_old public.appointments;
  v_service public.services;
  v_day date;
  v_new_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or (v_booking.client_id <> v_uid and not v_is_admin) then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;

  select * into v_old from public.appointments where id = v_booking.appointment_id for update;
  select * into v_service from public.services where id = v_old.service_id;
  if v_service.mode <> 'slot' or not v_service.booking_enabled then
    raise exception 'reschedule_not_allowed' using errcode = 'P0001';
  end if;
  if not v_is_admin and lower(v_old.period) < now() + make_interval(hours => v_service.cancel_notice_hours) then
    raise exception 'cancellation_too_late' using errcode = 'P0001';
  end if;
  if not v_is_admin then
    perform public.assert_not_sanctioned(v_booking.client_id);
    perform public.assert_eligibility(
      v_service, v_booking.client_id, p_starts_at,
      coalesce((select array_agg(dog_id) from public.booking_dogs where booking_id = p_booking_id), '{}'),
      jsonb_array_length(v_booking.group_dogs)
    );
  end if;

  -- Libère l'ancien créneau (sans cascade), vérifie le nouveau, puis déplace la réservation.
  perform set_config('freepaws.rescheduling', 'on', true);
  update public.appointments set status = 'cancelled' where id = v_old.id;
  perform set_config('freepaws.rescheduling', 'off', true);

  v_day := (p_starts_at at time zone 'Europe/Brussels')::date;
  if not exists (
    select 1 from public.get_available_slots(v_service.id, v_day, v_day) s where s.starts_at = p_starts_at
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  begin
    insert into public.appointments (resource_id, service_id, period, buffer_minutes, capacity, created_by)
    values (
      v_service.resource_id, v_service.id,
      tstzrange(p_starts_at, p_starts_at + make_interval(mins => v_service.duration_minutes)),
      v_service.buffer_minutes, 1, v_uid
    )
    returning id into v_new_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end;

  update public.bookings set appointment_id = v_new_id where id = p_booking_id;
end;
$$;

-- Mode urgence : chiens du groupe et avertissements de santé en plus.
create or replace function public.get_emergency_overview(p_resource_slug text default 'park')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.starts_at)
    from (
      select
        b.id as booking_id,
        lower(a.period) as starts_at,
        upper(a.period) as ends_at,
        s.name as service_name,
        p.full_name, p.phone, p.email,
        p.emergency_contact_name, p.emergency_contact_phone,
        b.adults_count, b.children_count,
        b.group_dogs, b.health_warnings,
        (select coalesce(jsonb_agg(jsonb_build_object(
            'id', d.id, 'name', d.name, 'breed', d.breed, 'size', d.size, 'protocol', d.protocol,
            'protocol_note', d.protocol_note, 'bite_history', d.bite_history, 'reactivity', d.reactivity)), '[]')
         from public.dogs d
         where d.id in (select bd.dog_id from public.booking_dogs bd where bd.booking_id = b.id)
            or d.id = b.dog_id) as dogs,
        (select coalesce(jsonb_agg(jsonb_build_object(
            'full_name', g.full_name, 'phone', g.phone, 'email', g.email,
            'emergency_contact_name', g.emergency_contact_name, 'emergency_contact_phone', g.emergency_contact_phone,
            'dog', g.dog, 'profile_completed', g.profile_completed_at is not null)), '[]')
         from public.booking_guests g where g.booking_id = b.id) as guests,
        (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'created_at', e.created_at, 'message', e.message)), '[]')
         from public.emergencies e where e.booking_id = b.id and e.acknowledged_at is null) as emergencies
      from public.bookings b
      join public.appointments a on a.id = b.appointment_id
      join public.resources r on r.id = a.resource_id
      join public.services s on s.id = a.service_id
      join public.profiles p on p.id = b.client_id
      where r.slug = p_resource_slug and b.status = 'confirmed' and a.status = 'scheduled'
        and a.period && tstzrange(now() - interval '30 minutes', now() + interval '2 hours')
    ) x
  ), '[]');
end;
$$;

-- ---------------------------------------------------------------------------
-- M2-10 : invitation des participants (profil allégé), condition de l'accès au direct
-- ---------------------------------------------------------------------------

alter table public.booking_guests
  add column emergency_contact_name text check (char_length(emergency_contact_name) <= 120),
  add column emergency_contact_phone text check (char_length(emergency_contact_phone) <= 30),
  -- Fiche du chien du participant (facultatif) : nom, race, taille, chien à protocole.
  add column dog jsonb check (dog is null or jsonb_typeof(dog) = 'object'),
  add column profile_completed_at timestamptz;

create table public.guest_document_acceptances (
  guest_id uuid not null references public.booking_guests (id) on delete cascade,
  document_id uuid not null references public.legal_documents (id),
  accepted_at timestamptz not null default now(),
  primary key (guest_id, document_id)
);

alter table public.guest_document_acceptances enable row level security;
create policy "guest_document_acceptances: admin" on public.guest_document_acceptances
  for select to authenticated using (public.is_admin());

-- Ce que voit l'invité en ouvrant son lien : réservation, documents à accepter, son profil.
create or replace function public.get_guest_invitation(p_token text, p_language text default 'fr')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  if coalesce(char_length(p_token), 0) <> 64 then
    return null;
  end if;
  select g.*, lower(a.period) as starts_at, upper(a.period) as ends_at, a.service_id,
         s.name as service_name, p.full_name as host_name, b.status as booking_status
  into v_row
  from public.booking_guests g
  join public.bookings b on b.id = g.booking_id
  join public.appointments a on a.id = b.appointment_id
  join public.services s on s.id = a.service_id
  join public.profiles p on p.id = b.client_id
  where g.access_token = p_token;
  if not found or v_row.booking_status <> 'confirmed' or v_row.ends_at <= now() then
    return null;
  end if;
  return jsonb_build_object(
    'full_name', v_row.full_name,
    'email', v_row.email,
    'phone', v_row.phone,
    'emergency_contact_name', v_row.emergency_contact_name,
    'emergency_contact_phone', v_row.emergency_contact_phone,
    'dog', v_row.dog,
    'profile_completed', v_row.profile_completed_at is not null,
    'starts_at', v_row.starts_at,
    'ends_at', v_row.ends_at,
    'service_name', v_row.service_name,
    'host_name', v_row.host_name,
    'documents', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.document_id, 'kind', r.kind, 'version', r.version, 'title', r.title, 'body', r.body,
        'accepted', exists (select 1 from public.guest_document_acceptances ga
                            where ga.guest_id = v_row.id and ga.document_id = r.document_id))), '[]')
      from public.get_required_documents(v_row.service_id, p_language) r
    )
  );
end;
$$;

create or replace function public.complete_guest_profile(p_token text, p_profile jsonb, p_document_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_guest public.booking_guests;
  v_service_id uuid;
begin
  select g.* into v_guest
  from public.booking_guests g
  join public.bookings b on b.id = g.booking_id and b.status = 'confirmed'
  join public.appointments a on a.id = b.appointment_id and upper(a.period) > now()
  where g.access_token = p_token and coalesce(char_length(p_token), 0) = 64
  for update of g;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;
  select a.service_id into v_service_id
  from public.bookings b join public.appointments a on a.id = b.appointment_id where b.id = v_guest.booking_id;

  if coalesce(trim(p_profile ->> 'full_name'), '') = ''
     or coalesce(trim(p_profile ->> 'emergency_contact_name'), '') = ''
     or coalesce(trim(p_profile ->> 'emergency_contact_phone'), '') = ''
     or (coalesce(trim(p_profile ->> 'email'), '') = '' and coalesce(trim(p_profile ->> 'phone'), '') = '') then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.get_required_documents(v_service_id) r
    where not (r.document_id = any (coalesce(p_document_ids, '{}')))
      and not exists (select 1 from public.guest_document_acceptances ga
                      where ga.guest_id = v_guest.id and ga.document_id = r.document_id)
  ) then
    raise exception 'documents_not_accepted' using errcode = 'P0001';
  end if;

  update public.booking_guests set
    full_name = left(trim(p_profile ->> 'full_name'), 120),
    email = coalesce(nullif(left(trim(p_profile ->> 'email'), 200), ''), email),
    phone = nullif(left(trim(p_profile ->> 'phone'), 30), ''),
    emergency_contact_name = left(trim(p_profile ->> 'emergency_contact_name'), 120),
    emergency_contact_phone = left(trim(p_profile ->> 'emergency_contact_phone'), 30),
    dog = case when coalesce(trim(p_profile -> 'dog' ->> 'name'), '') = '' then null
               else (public.clean_group_dogs(jsonb_build_array(p_profile -> 'dog'))) -> 0 end,
    profile_completed_at = now()
  where id = v_guest.id;

  insert into public.guest_document_acceptances (guest_id, document_id)
  select v_guest.id, d.id from public.legal_documents d
  where d.id = any (coalesce(p_document_ids, '{}')) and d.published_at is not null and d.published_at <= now()
  on conflict do nothing;
end;
$$;

-- Le direct n'est ouvert qu'aux participants qui ont complété leur profil (M2-10).
create or replace function public.guest_camera_access(p_token text)
returns table (mode text, expires_at timestamptz, starts_at timestamptz, ends_at timestamptz, guest_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  if coalesce(char_length(p_token), 0) <> 64 then
    return query select 'denied'::text, null::timestamptz, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;
  select g.full_name, g.profile_completed_at, lower(a.period) as s, upper(a.period) as e, r.is_open
  into v_row
  from public.booking_guests g
  join public.bookings b on b.id = g.booking_id and b.status = 'confirmed'
  join public.appointments a on a.id = b.appointment_id and a.status = 'scheduled'
  join public.resources r on r.id = a.resource_id and r.slug = 'park'
  where g.access_token = p_token;

  if not found or not v_row.is_open or v_row.e <= now() then
    return query select 'denied'::text, null::timestamptz, null::timestamptz, null::timestamptz, null::text;
  elsif v_row.profile_completed_at is null then
    return query select 'profile_required'::text, null::timestamptz, v_row.s, v_row.e, v_row.full_name;
  elsif v_row.s > now() then
    return query select 'not_started'::text, null::timestamptz, v_row.s, v_row.e, v_row.full_name;
  else
    return query select 'private'::text, least(v_row.e, now() + interval '10 minutes'), v_row.s, v_row.e, v_row.full_name;
  end if;
end;
$$;

-- L'invitation part dès l'ajout de l'invité (et non plus 30 min avant) : il doit compléter son profil.
create or replace function public.booking_guests_enqueue_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or (tg_op = 'UPDATE' and new.email is not distinct from old.email) then
    return null;
  end if;
  if exists (
    select 1 from public.bookings b
    join public.appointments a on a.id = b.appointment_id and upper(a.period) > now()
    join public.resources r on r.id = a.resource_id and r.slug = 'park'
    where b.id = new.booking_id and b.status = 'confirmed'
  ) then
    insert into public.notifications (kind, booking_id, audience, guest_id)
    values ('guest_live_link', new.booking_id, 'guest', new.id);
  end if;
  return null;
end;
$$;

-- Le report ne recale plus l'invitation (déjà envoyée) ; l'annulation retire celles en attente.
create or replace function public.bookings_guest_links_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    delete from public.notifications where booking_id = new.id and kind = 'guest_live_link' and sent_at is null;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- M1-05 / M1-11 : questionnaire pré-visite (questions saisies par l'administratrice)
-- ---------------------------------------------------------------------------

create table public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  position integer not null default 0,
  kind text not null check (kind in ('text', 'long_text', 'yes_no', 'single_choice', 'multi_choice', 'number', 'date')),
  label text not null check (char_length(label) between 1 and 300),
  help text check (char_length(help) <= 600),
  -- Choix possibles : [{ "value": "...", "label": "...", "label_en": "..." }].
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
  -- { "en": { "label": "...", "help": "..." } }
  translations jsonb not null default '{}',
  required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index questionnaire_questions_service_idx on public.questionnaire_questions (service_id, position);

alter table public.questionnaire_questions enable row level security;
create policy "questionnaire_questions: lecture publique des actives" on public.questionnaire_questions
  for select using (active or public.is_admin());
create policy "questionnaire_questions: admin écrit" on public.questionnaire_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger questionnaire_questions_audit after insert or update or delete on public.questionnaire_questions
  for each row execute function public.audit_row();

create table public.questionnaire_responses (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  -- { "<question_id>": valeur } ; les libellés sont copiés pour garder le sens si une question change.
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  questions_snapshot jsonb not null default '[]',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.questionnaire_responses enable row level security;
create policy "questionnaire_responses: les siennes ou admin" on public.questionnaire_responses for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.bookings b where b.id = booking_id and b.client_id = (select auth.uid())));

-- Enregistre (ou met à jour) les réponses du client, tant que le rendez-vous n'a pas commencé.
create or replace function public.submit_questionnaire(p_booking_id uuid, p_answers jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_service_id uuid;
  v_missing integer;
  v_snapshot jsonb;
begin
  select a.service_id into v_service_id
  from public.bookings b join public.appointments a on a.id = b.appointment_id
  where b.id = p_booking_id and b.client_id = auth.uid() and b.status = 'confirmed' and lower(a.period) > now();
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 20000 then
    raise exception 'invalid_answers' using errcode = 'P0001';
  end if;

  select count(*) into v_missing
  from public.questionnaire_questions q
  where q.service_id = v_service_id and q.active and q.required
    and (p_answers -> q.id::text is null
         or p_answers -> q.id::text = 'null'::jsonb
         or (jsonb_typeof(p_answers -> q.id::text) = 'string' and trim(p_answers ->> q.id::text) = '')
         or (jsonb_typeof(p_answers -> q.id::text) = 'array' and jsonb_array_length(p_answers -> q.id::text) = 0));
  if v_missing > 0 then
    raise exception 'questionnaire_incomplete' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'label', q.label, 'kind', q.kind, 'options', q.options)
                            order by q.position, q.created_at), '[]')
  into v_snapshot
  from public.questionnaire_questions q
  where q.service_id = v_service_id and q.active;

  insert into public.questionnaire_responses (booking_id, answers, questions_snapshot)
  select p_booking_id,
         coalesce((select jsonb_object_agg(k, v) from jsonb_each(p_answers) e(k, v)
                   where k in (select q.id::text from public.questionnaire_questions q
                               where q.service_id = v_service_id and q.active)), '{}'),
         v_snapshot
  on conflict (booking_id) do update
    set answers = excluded.answers, questions_snapshot = excluded.questions_snapshot, updated_at = now();

  if exists (select 1 from public.settings where admin_email is not null) then
    insert into public.notifications (kind, booking_id, audience)
    values ('admin_questionnaire_submitted', p_booking_id, 'admin');
  end if;
end;
$$;

alter type public.notification_kind add value 'admin_questionnaire_submitted';

-- ---------------------------------------------------------------------------
-- M6-06 / M9-08 : notifications push (Expo) sur les appareils enregistrés
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  token text primary key check (char_length(token) <= 300),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  platform text check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
create policy "push_tokens: les siens" on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_tokens to authenticated;

alter table public.notifications add column push_sent_at timestamptz;

-- Alerte d'urgence : file d'envoi même sans adresse email (le push suffit).
create or replace function public.raise_emergency(p_message text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking_id uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select b.id into v_booking_id
  from public.bookings b
  join public.appointments a on a.id = b.appointment_id
  where b.client_id = v_uid and b.status = 'confirmed' and a.status = 'scheduled'
    and a.period && tstzrange(now() - interval '15 minutes', now() + interval '15 minutes')
  order by lower(a.period)
  limit 1;
  if v_booking_id is null then
    raise exception 'no_current_booking' using errcode = 'P0001';
  end if;
  -- Un appui répété dans la minute ne crée pas de nouvelle alerte.
  select id into v_id from public.emergencies
  where user_id = v_uid and created_at > now() - interval '1 minute'
  order by created_at desc limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.emergencies (user_id, booking_id, message)
  values (v_uid, v_booking_id, nullif(left(trim(p_message), 500), ''))
  returning id into v_id;

  -- Toujours mis en file : email si une adresse est réglée, et push sur ses appareils (24 h/24, M9-08).
  insert into public.notifications (kind, booking_id, audience, emergency_id)
  values ('admin_emergency', v_booking_id, 'admin', v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_available_slots(uuid, date, date) to anon, authenticated;
grant execute on function public.get_full_days(uuid, date, date) to anon, authenticated;
grant execute on function public.get_resource_status(text) to anon, authenticated;
grant execute on function public.camera_access(text) to anon, authenticated;
grant execute on function public.guest_camera_access(text) to anon, authenticated;
grant execute on function public.rescue_camera_access(text) to anon, authenticated;
grant execute on function public.get_guest_invitation(text, text) to anon, authenticated;
grant execute on function public.complete_guest_profile(text, jsonb, uuid[]) to anon, authenticated;
grant execute on function public.get_required_documents(uuid, text) to anon, authenticated;
grant execute on function public.quote_price(uuid, timestamptz, integer, integer, text) to anon, authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.book_slot(uuid, timestamptz, uuid, text, text, integer, integer, integer, text, uuid[], uuid[], jsonb, jsonb, boolean) to authenticated;
grant execute on function public.book_event(uuid, uuid, text, integer, integer, integer, integer, text, uuid[], uuid[], jsonb, jsonb, boolean) to authenticated;
grant execute on function public.check_park_eligibility(uuid, timestamptz, uuid[], integer) to authenticated;
grant execute on function public.submit_questionnaire(uuid, jsonb) to authenticated;
grant execute on function public.check_discount_code(uuid, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.set_booking_guests(uuid, jsonb) to authenticated;
grant execute on function public.raise_emergency(text) to authenticated;
grant execute on function public.get_rescue_info() to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.close_period(uuid, timestamptz, timestamptz, text, boolean) to authenticated;
grant execute on function public.count_appointments_in_period(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.get_emergency_overview(text) to authenticated;
grant execute on function public.admin_stats(date, date) to authenticated;
grant execute on function public.admin_book_for_client(uuid, uuid, timestamptz, integer, text, text, integer) to authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.enqueue_expiry_alerts() to service_role;
grant execute on function public.replace_external_busy(uuid, jsonb, text) to service_role;
