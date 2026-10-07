-- Phase 1 (coaching) : informations de réservation, tarif social, conditions acceptées, report.
--
--   services            prix affiché ou masqué, nombre de chiens maximum, documents à accepter
--   bookings            adresse de visite, nombre d'adultes / d'enfants / de chiens, prix calculé
--   discount_codes      codes « tarif social » créés par l'administratrice (échéance, utilisations,
--                       plafond mensuel global dans settings)
--   legal_documents     conditions versionnées ; une nouvelle version publiée doit être réacceptée
--   document_acceptances preuve horodatée (document + version) liée à la réservation
--   reschedule_booking  report en ligne dans le même délai que l'annulation

-- ---------------------------------------------------------------------------
-- Paramètres globaux (une seule ligne)
-- ---------------------------------------------------------------------------

create table public.settings (
  id boolean primary key default true check (id),
  -- Plafond mensuel global d'utilisations des codes « tarif social » (null = pas de plafond).
  social_monthly_cap integer check (social_monthly_cap >= 0),
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (true);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
create policy "settings: admin" on public.settings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Prestations et réservations : nouveaux champs
-- ---------------------------------------------------------------------------

alter table public.services
  add column price_visible boolean not null default false,
  add column max_dogs integer check (max_dogs between 1 and 20),
  -- Documents (legal_documents.kind) à accepter avant de réserver cette prestation.
  add column required_document_kinds text[] not null default '{}',
  -- Visite à domicile : l'adresse est demandée à la réservation.
  add column requires_address boolean not null default false,
  -- Contenu traduit : {"en": {"name": "...", "summary": "...", "description": "...", "location": "..."}}.
  -- Le français (colonnes name, summary…) sert de référence et de repli.
  add column translations jsonb not null default '{}' check (jsonb_typeof(translations) = 'object');

alter table public.bookings
  add column visit_address text check (char_length(visit_address) <= 300),
  add column adults_count integer check (adults_count between 0 and 50),
  add column children_count integer check (children_count between 0 and 50),
  add column dogs_count integer check (dogs_count between 0 and 20),
  add column price_cents integer check (price_cents >= 0),
  add column discount_cents integer check (discount_cents >= 0),
  add column discount_code_id uuid;

-- ---------------------------------------------------------------------------
-- Tarif social
-- ---------------------------------------------------------------------------

create type public.discount_kind as enum ('percent', 'amount');

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{4,32}$'),
  label text not null default '' check (char_length(label) <= 120),
  kind public.discount_kind not null,
  value integer not null check (value > 0),
  valid_until date,
  max_uses integer check (max_uses > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);

alter table public.bookings
  add constraint bookings_discount_code_fk foreign key (discount_code_id)
  references public.discount_codes (id) on delete set null;

create index bookings_discount_code_idx on public.bookings (discount_code_id);

alter table public.discount_codes enable row level security;
create policy "discount_codes: admin" on public.discount_codes
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Documents versionnés et acceptations
-- ---------------------------------------------------------------------------

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind ~ '^[a-z0-9_]{2,40}$'),
  language text not null default 'fr' check (language in ('fr', 'en', 'nl', 'de')),
  version integer not null check (version > 0),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) <= 100000),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, language, version)
);

create table public.document_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid not null references public.legal_documents (id),
  booking_id uuid references public.bookings (id) on delete set null,
  accepted_at timestamptz not null default now(),
  unique (user_id, document_id)
);

create index document_acceptances_document_idx on public.document_acceptances (document_id);
create index document_acceptances_booking_idx on public.document_acceptances (booking_id);

alter table public.legal_documents enable row level security;
alter table public.document_acceptances enable row level security;

create policy "legal_documents: lecture publique des publiés" on public.legal_documents
  for select to anon, authenticated
  using (published_at is not null and published_at <= now() or (select public.is_admin()));
create policy "legal_documents: admin écrit" on public.legal_documents
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "document_acceptances: les siennes ou admin" on public.document_acceptances
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Pas d'écriture directe : les acceptations passent par les fonctions de réservation.

-- Dernière version publiée de chaque document exigé par une prestation, et si l'appelant l'a acceptée.
create or replace function public.get_required_documents(p_service_id uuid, p_language text default 'fr')
returns table (document_id uuid, kind text, version integer, title text, body text, accepted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (d.kind) d.*
    from public.legal_documents d
    join public.services s on s.id = p_service_id and d.kind = any (s.required_document_kinds)
    where d.published_at is not null and d.published_at <= now()
    order by d.kind, d.version desc, (d.language = p_language) desc, (d.language = 'fr') desc
  )
  select l.id, l.kind, l.version, l.title, l.body,
         exists (
           select 1 from public.document_acceptances a
           join public.legal_documents d2 on d2.id = a.document_id
           where a.user_id = (select auth.uid()) and d2.kind = l.kind and d2.version = l.version
         )
  from latest l
  order by l.kind;
$$;

-- ---------------------------------------------------------------------------
-- Logique commune aux réservations
-- ---------------------------------------------------------------------------

-- Vérifie et calcule tout ce qui ne dépend pas du créneau. Lève une erreur si la demande est invalide.
create or replace function public.prepare_booking(
  p_service public.services,
  p_uid uuid,
  p_dog_id uuid,
  p_notes text,
  p_visit_address text,
  p_adults_count integer,
  p_children_count integer,
  p_dogs_count integer,
  p_discount_code text,
  p_document_ids uuid[],
  out discount_code_id uuid,
  out price_cents integer,
  out discount_cents integer
)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code public.discount_codes;
  v_cap integer;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
  v_missing integer;
begin
  if char_length(p_notes) > 1000 then
    raise exception 'notes_too_long' using errcode = 'P0001';
  end if;
  if p_service.requires_address and coalesce(trim(p_visit_address), '') = '' then
    raise exception 'address_required' using errcode = 'P0001';
  end if;
  if p_service.max_dogs is not null and coalesce(p_dogs_count, 1) > p_service.max_dogs then
    raise exception 'too_many_dogs' using errcode = 'P0001';
  end if;

  perform public.assert_dog_owner(p_dog_id, p_uid);
  perform public.assert_booking_quota(p_uid);

  -- Documents exigés : dernière version publiée de chaque type, acceptée maintenant ou auparavant.
  select count(*) into v_missing
  from public.get_required_documents(p_service.id) r
  where not r.accepted and not (r.document_id = any (coalesce(p_document_ids, '{}')));
  if v_missing > 0 then
    raise exception 'documents_not_accepted' using errcode = 'P0001';
  end if;

  price_cents := p_service.price_cents;
  discount_cents := null;
  discount_code_id := null;

  if coalesce(trim(p_discount_code), '') <> '' then
    select * into v_code from public.discount_codes
    where code = upper(trim(p_discount_code)) and active
    for update;
    if not found or (v_code.valid_until is not null and v_code.valid_until < (now() at time zone 'Europe/Brussels')::date) then
      raise exception 'discount_code_invalid' using errcode = 'P0001';
    end if;
    if v_code.max_uses is not null and (
      select count(*) from public.bookings b where b.discount_code_id = v_code.id and b.status = 'confirmed'
    ) >= v_code.max_uses then
      raise exception 'discount_code_exhausted' using errcode = 'P0001';
    end if;
    -- Plafond mensuel global (tous codes confondus) : verrou sur la ligne de paramètres.
    select social_monthly_cap into v_cap from public.settings where id for update;
    if v_cap is not null and (
      select count(*) from public.bookings b
      where b.discount_code_id is not null and b.status = 'confirmed' and b.created_at >= v_month_start
    ) >= v_cap then
      raise exception 'discount_code_exhausted' using errcode = 'P0001';
    end if;

    discount_code_id := v_code.id;
    if price_cents is not null then
      discount_cents := case v_code.kind
        when 'percent' then round(price_cents * v_code.value / 100.0)::integer
        else least(price_cents, v_code.value)
      end;
      price_cents := price_cents - discount_cents;
    end if;
  end if;
end;
$$;

create or replace function public.record_acceptances(p_uid uuid, p_booking_id uuid, p_document_ids uuid[])
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.document_acceptances (user_id, document_id, booking_id)
  select p_uid, d.id, p_booking_id
  from public.legal_documents d
  where d.id = any (coalesce(p_document_ids, '{}'))
    and d.published_at is not null and d.published_at <= now()
  on conflict (user_id, document_id) do nothing;
$$;

-- ---------------------------------------------------------------------------
-- Réservation : nouvelles signatures
-- ---------------------------------------------------------------------------

drop function public.book_slot(uuid, timestamptz, uuid, text);
drop function public.book_event(uuid, uuid, text, integer);

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
  p_document_ids uuid[] default null
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

  select * into v_prep from public.prepare_booking(
    v_service, v_uid, p_dog_id, p_notes, p_visit_address, p_adults_count, p_children_count,
    p_dogs_count, p_discount_code, p_document_ids
  );

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
    v_appointment_id, v_uid, p_dog_id, nullif(trim(p_notes), ''), nullif(trim(p_visit_address), ''),
    p_adults_count, p_children_count, p_dogs_count, v_prep.price_cents, v_prep.discount_cents,
    v_prep.discount_code_id
  )
  returning id into v_booking_id;

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
  p_document_ids uuid[] default null
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

  select * into v_prep from public.prepare_booking(
    v_service, v_uid, p_dog_id, p_notes, null, p_adults_count, p_children_count,
    p_dogs_count, p_discount_code, p_document_ids
  );

  begin
    insert into public.bookings (
      appointment_id, client_id, dog_id, client_notes, party_size, adults_count, children_count,
      dogs_count, price_cents, discount_cents, discount_code_id
    )
    values (
      p_appointment_id, v_uid, p_dog_id, nullif(trim(p_notes), ''), p_party_size, p_adults_count,
      p_children_count, p_dogs_count, v_prep.price_cents, v_prep.discount_cents, v_prep.discount_code_id
    )
    returning id into v_booking_id;
  exception when unique_violation then
    raise exception 'already_booked' using errcode = 'P0001';
  end;

  perform public.record_acceptances(v_uid, v_booking_id, p_document_ids);
  return v_booking_id;
end;
$$;

-- Aperçu d'un code tarif social (sans révéler la liste des codes).
create or replace function public.check_discount_code(p_service_id uuid, p_code text)
returns table (valid boolean, price_cents integer, discount_cents integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code public.discount_codes;
  v_price integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select s.price_cents into v_price from public.services s where s.id = p_service_id and s.active;
  select * into v_code from public.discount_codes
  where code = upper(trim(p_code)) and active
    and (valid_until is null or valid_until >= (now() at time zone 'Europe/Brussels')::date);
  if not found then
    return query select false, v_price, null::integer;
    return;
  end if;
  return query select true,
    case when v_price is null then null else v_price - (case v_code.kind when 'percent' then round(v_price * v_code.value / 100.0)::integer else least(v_price, v_code.value) end) end,
    case when v_price is null then null else (case v_code.kind when 'percent' then round(v_price * v_code.value / 100.0)::integer else least(v_price, v_code.value) end) end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Report d'une réservation (même délai que l'annulation)
-- ---------------------------------------------------------------------------

-- Pendant un report, l'ancien rendez-vous est annulé sans annuler la réservation qui le quitte.
create or replace function public.appointments_after_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('freepaws.rescheduling', true) = 'on' then
    return null;
  end if;
  if old.status = 'scheduled' and new.status = 'cancelled' then
    update public.bookings
    set status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, now()),
        cancelled_by = coalesce(cancelled_by, auth.uid())
    where appointment_id = new.id
      and status = 'confirmed';
  end if;
  return null;
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

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_available_slots(uuid, date, date) to anon, authenticated;
grant execute on function public.get_resource_status(text) to anon, authenticated;
grant execute on function public.camera_access(text) to anon, authenticated;
grant execute on function public.get_required_documents(uuid, text) to anon, authenticated;
grant execute on function public.book_slot(uuid, timestamptz, uuid, text, text, integer, integer, integer, text, uuid[]) to authenticated;
grant execute on function public.book_event(uuid, uuid, text, integer, integer, integer, integer, text, uuid[]) to authenticated;
grant execute on function public.check_discount_code(uuid, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
