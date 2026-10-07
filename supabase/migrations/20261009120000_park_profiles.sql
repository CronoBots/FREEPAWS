-- Phase 2 (parc) : fiches maîtres et chiens, assurance, vaccinations, questionnaire d'admission,
-- conditions d'accès vérifiées à la réservation, historique des modifications.
--
-- Rien n'est imposé par défaut : une prestation n'exige ces fiches que si l'administratrice coche
-- services.requires_park_profile, et la liste des vaccins exigés est vide tant qu'elle ne l'a pas remplie.

-- ---------------------------------------------------------------------------
-- Fiche du responsable de réservation (M2-01) et assurance RC familiale (M2-02)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column birth_date date check (birth_date <= current_date and birth_date >= date '1900-01-01'),
  add column emergency_contact_name text check (char_length(emergency_contact_name) <= 120),
  add column emergency_contact_phone text check (char_length(emergency_contact_phone) <= 30),
  add column insurance_company text check (char_length(insurance_company) <= 120),
  add column insurance_policy text check (char_length(insurance_policy) <= 60),
  add column insurance_valid_until date,
  -- Chemin du justificatif dans le bucket privé `proofs` (<user_id>/...).
  add column insurance_proof_path text check (char_length(insurance_proof_path) <= 300);

grant update (
  birth_date, emergency_contact_name, emergency_contact_phone,
  insurance_company, insurance_policy, insurance_valid_until, insurance_proof_path
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Fiche chien (M2-03) et questionnaire d'admission (M2-05)
-- ---------------------------------------------------------------------------

alter table public.dogs
  add column sex text check (sex in ('male', 'female')),
  add column size text check (size in ('small', 'medium', 'large', 'giant')),
  add column chip_number text check (chip_number ~ '^[0-9A-Za-z]{9,20}$'),
  add column dogid_registered boolean not null default false,
  add column sterilised boolean,
  add column in_heat boolean not null default false,
  add column vet_name text check (char_length(vet_name) <= 120),
  add column vet_phone text check (char_length(vet_phone) <= 30),
  add column bite_history boolean,
  add column reactivity text check (char_length(reactivity) <= 1000),
  add column special_needs text check (char_length(special_needs) <= 1000),
  -- « Chien à protocole » : posé par l'administratrice, visible en mode urgence, n'interdit pas l'accès.
  add column protocol boolean not null default false,
  add column protocol_note text check (char_length(protocol_note) <= 1000);

-- Seule l'administratrice pose ou retire le drapeau « chien à protocole ».
create or replace function public.dogs_protect_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.protocol := false;
      new.protocol_note := null;
    else
      new.protocol := old.protocol;
      new.protocol_note := old.protocol_note;
    end if;
  end if;
  return new;
end;
$$;

create trigger dogs_protect_admin_fields
  before insert or update on public.dogs
  for each row execute function public.dogs_protect_admin_fields();

-- L'administratrice peut poser le drapeau sur n'importe quel chien.
create policy "dogs: l'admin met à jour" on public.dogs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Vaccinations (M2-04) : liste paramétrable, justificatif, validation par l'administratrice
-- ---------------------------------------------------------------------------

create table public.vaccine_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  translations jsonb not null default '{}',
  required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.vaccine_types enable row level security;
create policy "vaccine_types: lecture publique" on public.vaccine_types for select using (true);
create policy "vaccine_types: admin écrit" on public.vaccine_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create type public.review_status as enum ('pending', 'validated', 'rejected');

create table public.dog_vaccinations (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  vaccine_type_id uuid not null references public.vaccine_types (id) on delete cascade,
  vaccinated_on date not null check (vaccinated_on <= current_date),
  valid_until date not null,
  proof_path text check (char_length(proof_path) <= 300),
  status public.review_status not null default 'pending',
  review_note text check (char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until > vaccinated_on)
);

create index dog_vaccinations_dog_idx on public.dog_vaccinations (dog_id);
create index dog_vaccinations_pending_idx on public.dog_vaccinations (created_at) where status = 'pending';

create trigger dog_vaccinations_set_updated_at
  before update on public.dog_vaccinations
  for each row execute function public.set_updated_at();

-- Toute saisie ou modification par le propriétaire repasse en attente de validation.
create or replace function public.dog_vaccinations_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() then
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      new.reviewed_by := case when new.status = 'pending' then null else auth.uid() end;
      new.reviewed_at := case when new.status = 'pending' then null else now() end;
    end if;
  else
    new.status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

create trigger dog_vaccinations_review
  before insert or update on public.dog_vaccinations
  for each row execute function public.dog_vaccinations_review();

alter table public.dog_vaccinations enable row level security;
create policy "dog_vaccinations: le propriétaire gère" on public.dog_vaccinations
  for all to authenticated
  using (exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = (select auth.uid())));
create policy "dog_vaccinations: admin" on public.dog_vaccinations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Justificatifs : bucket privé, un dossier par utilisateur (Supabase Storage)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('proofs', 'proofs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "proofs: le propriétaire gère son dossier" on storage.objects
        for all to authenticated
        using (bucket_id = 'proofs' and (storage.foldername(name))[1] = (select auth.uid())::text)
        with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
    execute $p$
      create policy "proofs: l'admin consulte" on storage.objects
        for select to authenticated using (bucket_id = 'proofs' and public.is_admin())
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Règles d'accès paramétrables (M2-07, M2-09)
-- ---------------------------------------------------------------------------

alter table public.services
  -- Exige fiche complète, assurance et vaccins valides, et la sélection des chiens (parc).
  add column requires_park_profile boolean not null default false,
  -- Plafond de personnes simultanées (adultes + enfants). Null = pas de plafond.
  add column max_people integer check (max_people between 1 and 100);

alter table public.settings
  add column min_dog_age_months integer check (min_dog_age_months between 0 and 60),
  add column refuse_dogs_in_heat boolean not null default false,
  add column expiry_alert_days integer not null default 30 check (expiry_alert_days between 1 and 120);

-- Chiens et invités d'une réservation (M2-06).
create table public.booking_dogs (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  primary key (booking_id, dog_id)
);

create table public.booking_guests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 30),
  created_at timestamptz not null default now()
);

create index booking_guests_booking_idx on public.booking_guests (booking_id);

alter table public.booking_dogs enable row level security;
alter table public.booking_guests enable row level security;
create policy "booking_dogs: les siennes ou admin" on public.booking_dogs for select to authenticated
  using (public.is_admin() or exists (select 1 from public.bookings b where b.id = booking_id and b.client_id = (select auth.uid())));
create policy "booking_guests: les siennes ou admin" on public.booking_guests for select to authenticated
  using (public.is_admin() or exists (select 1 from public.bookings b where b.id = booking_id and b.client_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Vérification des conditions d'accès (appelée par book_slot, book_event, reschedule_booking)
-- ---------------------------------------------------------------------------

create or replace function public.assert_eligibility(
  p_service public.services,
  p_uid uuid,
  p_starts_at timestamptz,
  p_dog_ids uuid[]
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_settings public.settings;
  v_day date := (p_starts_at at time zone 'Europe/Brussels')::date;
  v_dog public.dogs;
begin
  if p_service.requires_park_profile is not true then
    return;
  end if;

  select * into v_profile from public.profiles where id = p_uid;
  select * into v_settings from public.settings;

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

  if coalesce(cardinality(p_dog_ids), 0) = 0 then
    raise exception 'dog_required' using errcode = 'P0001';
  end if;

  for v_dog in select * from public.dogs where id = any (p_dog_ids) loop
    if v_settings.min_dog_age_months is not null and (
      v_dog.birth_date is null
      or v_dog.birth_date > (v_day - make_interval(months => v_settings.min_dog_age_months))::date
    ) then
      raise exception 'dog_too_young' using errcode = 'P0001';
    end if;
    if v_settings.refuse_dogs_in_heat and v_dog.in_heat then
      raise exception 'dog_in_heat' using errcode = 'P0001';
    end if;
    -- Chaque vaccin exigé : une vaccination validée, encore valable le jour de la réservation.
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

-- Liste des chiens d'une réservation : p_dog_ids, ou à défaut l'ancien paramètre p_dog_id.
create or replace function public.normalize_dog_ids(p_dog_id uuid, p_dog_ids uuid[])
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select array_agg(distinct d) from unnest(coalesce(p_dog_ids, '{}') || array[p_dog_id]) d where d is not null),
    '{}'
  );
$$;

create or replace function public.assert_dogs_owner(p_dog_ids uuid[], p_owner_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(p_dog_ids) d
    where not exists (select 1 from public.dogs where id = d and owner_id = p_owner_id)
  ) then
    raise exception 'dog_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Réservation : chiens multiples, plafond de personnes, conditions d'accès
-- ---------------------------------------------------------------------------

drop function public.book_slot(uuid, timestamptz, uuid, text, text, integer, integer, integer, text, uuid[]);
drop function public.book_event(uuid, uuid, text, integer, integer, integer, integer, text, uuid[]);

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
  p_dog_ids uuid[] default null
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
  if cardinality(v_dogs) > 0 then
    v_dogs_count := greatest(coalesce(p_dogs_count, 0), cardinality(v_dogs));
  end if;
  if v_service.max_people is not null
     and coalesce(p_adults_count, 1) + coalesce(p_children_count, 0) > v_service.max_people then
    raise exception 'too_many_people' using errcode = 'P0001';
  end if;

  select * into v_prep from public.prepare_booking(
    v_service, v_uid, v_dogs[1], p_notes, p_visit_address, p_adults_count, p_children_count,
    v_dogs_count, p_discount_code, p_document_ids
  );
  perform public.assert_eligibility(v_service, v_uid, p_starts_at, v_dogs);

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
    dogs_count, price_cents, discount_cents, discount_code_id
  )
  values (
    v_appointment_id, v_uid, v_dogs[1], nullif(trim(p_notes), ''), nullif(trim(p_visit_address), ''),
    p_adults_count, p_children_count, v_dogs_count, v_prep.price_cents, v_prep.discount_cents,
    v_prep.discount_code_id
  )
  returning id into v_booking_id;

  insert into public.booking_dogs (booking_id, dog_id) select v_booking_id, unnest(v_dogs);
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
  p_dog_ids uuid[] default null
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
  if cardinality(v_dogs) > 0 then
    v_dogs_count := greatest(coalesce(p_dogs_count, 0), cardinality(v_dogs));
  end if;
  if v_service.max_people is not null
     and coalesce(p_adults_count, p_party_size) + coalesce(p_children_count, 0) > v_service.max_people then
    raise exception 'too_many_people' using errcode = 'P0001';
  end if;

  select * into v_prep from public.prepare_booking(
    v_service, v_uid, v_dogs[1], p_notes, null, p_adults_count, p_children_count,
    v_dogs_count, p_discount_code, p_document_ids
  );
  perform public.assert_eligibility(v_service, v_uid, v_starts_at, v_dogs);

  begin
    insert into public.bookings (
      appointment_id, client_id, dog_id, client_notes, party_size, adults_count, children_count,
      dogs_count, price_cents, discount_cents, discount_code_id
    )
    values (
      p_appointment_id, v_uid, v_dogs[1], nullif(trim(p_notes), ''), p_party_size, p_adults_count,
      p_children_count, v_dogs_count, v_prep.price_cents, v_prep.discount_cents, v_prep.discount_code_id
    )
    returning id into v_booking_id;
  exception when unique_violation then
    raise exception 'already_booked' using errcode = 'P0001';
  end;

  insert into public.booking_dogs (booking_id, dog_id) select v_booking_id, unnest(v_dogs);
  perform public.record_acceptances(v_uid, v_booking_id, p_document_ids);
  return v_booking_id;
end;
$$;

-- Report : mêmes conditions d'accès à la nouvelle date (assurance ou vaccin échu entre-temps).
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
      coalesce((select array_agg(dog_id) from public.booking_dogs where booking_id = p_booking_id), '{}')
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

-- Invités d'une réservation (groupe de promenade) : remplacés en bloc par le responsable.
create or replace function public.set_booking_guests(p_booking_id uuid, p_guests jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.bookings
    where id = p_booking_id and status = 'confirmed' and (client_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_guests) <> 'array' or jsonb_array_length(p_guests) > 20 then
    raise exception 'invalid_guests' using errcode = 'P0001';
  end if;

  delete from public.booking_guests where booking_id = p_booking_id;
  insert into public.booking_guests (booking_id, full_name, email, phone)
  select p_booking_id, trim(g ->> 'full_name'), nullif(trim(g ->> 'email'), ''), nullif(trim(g ->> 'phone'), '')
  from jsonb_array_elements(p_guests) g
  where coalesce(trim(g ->> 'full_name'), '') <> '';
end;
$$;

-- ---------------------------------------------------------------------------
-- Sanctions et liste noire (M9-06) : vérifiées à chaque réservation
-- ---------------------------------------------------------------------------

create type public.sanction_level as enum ('warning', 'suspension', 'ban');

create table public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  level public.sanction_level not null,
  reason text not null default '' check (char_length(reason) <= 1000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  incident_id uuid,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index sanctions_user_idx on public.sanctions (user_id);

alter table public.sanctions enable row level security;
create policy "sanctions: les siennes ou admin" on public.sanctions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "sanctions: admin écrit" on public.sanctions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.assert_not_sanctioned(p_uid uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.sanctions
    where user_id = p_uid and level in ('suspension', 'ban')
      and starts_at <= now() and (ends_at is null or ends_at > now())
  ) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Historique des modifications (M2-08) et journal des actions de l'administratrice (M9-07)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor uuid,
  actor_is_admin boolean not null default false,
  changes jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_row_idx on public.audit_log (table_name, row_id, created_at desc);
create index audit_log_admin_idx on public.audit_log (created_at desc) where actor_is_admin;

alter table public.audit_log enable row level security;
create policy "audit_log: lecture admin" on public.audit_log for select to authenticated using (public.is_admin());

-- Enregistre les champs modifiés (ancienne et nouvelle valeur). Les horodatages techniques sont ignorés.
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}' end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}' end;
  v_changes jsonb;
begin
  select coalesce(jsonb_object_agg(k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k)), '{}')
  into v_changes
  from (select jsonb_object_keys(v_old || v_new) k) keys
  where k not in ('updated_at', 'created_at', 'blocked')
    and (v_old -> k) is distinct from (v_new -> k);

  if tg_op = 'UPDATE' and v_changes = '{}' then
    return null;
  end if;

  insert into public.audit_log (table_name, row_id, action, actor, actor_is_admin, changes)
  values (
    tg_table_name,
    coalesce((v_new ->> 'id'), (v_old ->> 'id'))::uuid,
    tg_op,
    auth.uid(),
    public.is_admin(),
    v_changes
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'dogs', 'dog_vaccinations', 'vaccine_types', 'services', 'settings', 'sanctions',
    'discount_codes', 'availability_rules', 'blackouts', 'legal_documents', 'resources'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
      t || '_audit', t
    );
  end loop;
end $$;

-- settings a une clé booléenne : pas d'identifiant uuid à journaliser, mais les changements le sont.
-- (row_id reste null pour cette table.)
create or replace function public.audit_row_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (table_name, action, actor, actor_is_admin, changes)
  select 'settings', tg_op, auth.uid(), public.is_admin(),
         coalesce(jsonb_object_agg(k, jsonb_build_object('old', to_jsonb(old) -> k, 'new', to_jsonb(new) -> k)), '{}')
  from (select jsonb_object_keys(to_jsonb(new)) k) keys
  where k not in ('updated_at', 'calendar_token') and (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k)
  having count(*) > 0;
  return null;
end;
$$;

drop trigger settings_audit on public.settings;
create trigger settings_audit after update on public.settings
  for each row execute function public.audit_row_settings();
