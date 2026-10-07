-- Suite du cahier des charges, sans contenu métier :
--   M3-03  moteur de tarifs paramétrable (heures creuses, jours fériés, supplément par chien, forfait groupe)
--   M1-02  import de l'agenda personnel (iCal) comme indisponibilités
--   M3-12  jours complets connus de l'app (liste d'attente depuis le calendrier)
--   M2-09  critères d'admission : chien malade, traitement antiparasitaire
--   M8-03  live individuel pour chaque invité (lien personnel valable pendant le créneau)

-- ---------------------------------------------------------------------------
-- M2-09 : critères d'admission supplémentaires (désactivés par défaut)
-- ---------------------------------------------------------------------------

alter table public.dogs
  add column currently_ill boolean not null default false,
  add column antiparasitic_until date;

alter table public.settings
  add column refuse_ill_dogs boolean not null default false,
  add column require_antiparasitic boolean not null default false;

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
    if v_settings.refuse_ill_dogs and v_dog.currently_ill then
      raise exception 'dog_ill' using errcode = 'P0001';
    end if;
    if v_settings.require_antiparasitic and (v_dog.antiparasitic_until is null or v_dog.antiparasitic_until < v_day) then
      raise exception 'antiparasitic_missing' using errcode = 'P0001';
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


-- ---------------------------------------------------------------------------
-- M3-03 : tarification paramétrable
-- ---------------------------------------------------------------------------

-- Jours fériés et vacances scolaires saisis par l'administratrice.
create table public.calendar_days (
  day date primary key,
  kind text not null check (kind in ('public_holiday', 'school_holiday')),
  label text not null default '' check (char_length(label) <= 120)
);

alter table public.calendar_days enable row level security;
create policy "calendar_days: lecture publique" on public.calendar_days for select using (true);
create policy "calendar_days: admin écrit" on public.calendar_days
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Règles de prix par prestation. Le tarif de base reste services.price_cents.
--   off_peak  : période (jours, heures, fériés, vacances) → pourcentage, différence ou prix fixe
--   group     : à partir de `threshold` invités → prix fixe (forfait groupe de plusieurs foyers)
--   extra_dog : au-delà de `threshold` chiens → `value` centimes par chien supplémentaire
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  kind text not null check (kind in ('off_peak', 'group', 'extra_dog')),
  label text not null default '' check (char_length(label) <= 120),
  weekdays smallint[] not null default '{}' check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  start_time time,
  end_time time,
  on_public_holidays boolean not null default false,
  on_school_holidays boolean not null default false,
  adjustment text not null default 'fixed' check (adjustment in ('percent', 'amount', 'fixed')),
  value integer not null,
  threshold integer not null default 0 check (threshold between 0 and 50),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (start_time is null or end_time is null or end_time > start_time),
  check (adjustment <> 'percent' or value between -100 and 500),
  check (adjustment <> 'fixed' or value >= 0)
);

create index pricing_rules_service_idx on public.pricing_rules (service_id, kind, sort_order);

alter table public.pricing_rules enable row level security;
create policy "pricing_rules: admin" on public.pricing_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create trigger pricing_rules_audit after insert or update or delete on public.pricing_rules
  for each row execute function public.audit_row();

-- Prix d'un créneau (null si la prestation n'a pas de prix). Ordre : forfait groupe, période, chiens.
create or replace function public.compute_price(
  p_service public.services,
  p_starts_at timestamptz,
  p_dogs integer,
  p_guests integer
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_starts_at at time zone 'Europe/Brussels';
  v_day date := v_local::date;
  v_time time := v_local::time;
  v_dow smallint := extract(isodow from v_local)::smallint;
  v_public boolean;
  v_school boolean;
  v_price numeric := p_service.price_cents;
  v_rule public.pricing_rules;
begin
  if v_price is null then
    return null;
  end if;
  select exists (select 1 from public.calendar_days where day = v_day and kind = 'public_holiday'),
         exists (select 1 from public.calendar_days where day = v_day and kind = 'school_holiday')
  into v_public, v_school;

  select * into v_rule from public.pricing_rules
  where service_id = p_service.id and active and kind = 'group' and coalesce(p_guests, 0) >= threshold
  order by threshold desc, sort_order limit 1;
  if found then
    v_price := v_rule.value;
  end if;

  select * into v_rule from public.pricing_rules r
  where r.service_id = p_service.id and r.active and r.kind = 'off_peak'
    and (v_dow = any (r.weekdays) or (r.on_public_holidays and v_public) or (r.on_school_holidays and v_school))
    and (r.start_time is null or v_time >= r.start_time)
    and (r.end_time is null or v_time < r.end_time)
  order by r.sort_order, r.created_at limit 1;
  if found then
    v_price := case v_rule.adjustment
      when 'percent' then v_price * (100 + v_rule.value) / 100.0
      when 'amount' then v_price + v_rule.value
      else v_rule.value
    end;
  end if;

  for v_rule in
    select * from public.pricing_rules
    where service_id = p_service.id and active and kind = 'extra_dog'
    order by sort_order
  loop
    v_price := v_price + greatest(0, coalesce(p_dogs, 1) - v_rule.threshold) * v_rule.value;
  end loop;

  return greatest(0, round(v_price))::integer;
end;
$$;

-- Aperçu du prix avant réservation (respecte « prix affiché » de la prestation).
create or replace function public.quote_price(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_dogs_count integer default 1,
  p_guests_count integer default 0,
  p_discount_code text default null
)
returns table (price_cents integer, discount_cents integer, labels text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service public.services;
  v_price integer;
  v_code public.discount_codes;
  v_discount integer;
  v_labels text[];
  v_local timestamp := p_starts_at at time zone 'Europe/Brussels';
begin
  select * into v_service from public.services where id = p_service_id and active;
  if not found or not (v_service.price_visible or public.is_admin()) then
    return query select null::integer, null::integer, '{}'::text[];
    return;
  end if;
  v_price := public.compute_price(v_service, p_starts_at, p_dogs_count, p_guests_count);

  -- Libellés des règles appliquées (ex. « Heures creuses »), pour l'affichage.
  select coalesce(array_agg(r.label order by r.sort_order) filter (where r.label <> ''), '{}') into v_labels
  from public.pricing_rules r
  where r.service_id = v_service.id and r.active and (
    (r.kind = 'group' and coalesce(p_guests_count, 0) >= r.threshold)
    or (r.kind = 'extra_dog' and coalesce(p_dogs_count, 1) > r.threshold)
    or (r.kind = 'off_peak'
        and (extract(isodow from v_local)::smallint = any (r.weekdays)
             or (r.on_public_holidays and exists (select 1 from public.calendar_days d where d.day = v_local::date and d.kind = 'public_holiday'))
             or (r.on_school_holidays and exists (select 1 from public.calendar_days d where d.day = v_local::date and d.kind = 'school_holiday')))
        and (r.start_time is null or v_local::time >= r.start_time)
        and (r.end_time is null or v_local::time < r.end_time))
  );

  if v_price is not null and coalesce(trim(p_discount_code), '') <> '' and auth.uid() is not null then
    select * into v_code from public.discount_codes
    where code = upper(trim(p_discount_code)) and active
      and (valid_until is null or valid_until >= (now() at time zone 'Europe/Brussels')::date);
    if found then
      v_discount := case v_code.kind
        when 'percent' then round(v_price * v_code.value / 100.0)::integer
        else least(v_price, v_code.value)
      end;
      v_price := v_price - v_discount;
    end if;
  end if;

  return query select v_price, v_discount, v_labels;
end;
$$;

-- ---------------------------------------------------------------------------
-- M8-03 : invités avec lien live personnel
-- ---------------------------------------------------------------------------

alter table public.booking_guests
  add column access_token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

-- Invités saisis : tableau JSON nettoyé (lignes sans nom ignorées, 20 au plus).
create or replace function public.clean_guests(p_guests jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_clean jsonb;
begin
  if p_guests is null then
    return '[]';
  end if;
  if jsonb_typeof(p_guests) <> 'array' then
    raise exception 'invalid_guests' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'full_name', left(trim(g ->> 'full_name'), 120),
           'email', nullif(left(trim(g ->> 'email'), 200), ''),
           'phone', nullif(left(trim(g ->> 'phone'), 30), ''))), '[]')
  into v_clean
  from jsonb_array_elements(p_guests) g
  where coalesce(trim(g ->> 'full_name'), '') <> '';
  if jsonb_array_length(v_clean) > 20 then
    raise exception 'invalid_guests' using errcode = 'P0001';
  end if;
  return v_clean;
end;
$$;

create or replace function public.insert_guests(p_booking_id uuid, p_guests jsonb)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.booking_guests (booking_id, full_name, email, phone)
  select p_booking_id, g ->> 'full_name', g ->> 'email', g ->> 'phone'
  from jsonb_array_elements(p_guests) g;
$$;

-- Remplacement des invités : on garde le lien des invités inchangés (même nom et même email),
-- et le prix suit le nombre d'invités (forfait groupe).
create or replace function public.set_booking_guests(p_booking_id uuid, p_guests jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_guests jsonb := public.clean_guests(p_guests);
  v_service public.services;
  v_starts_at timestamptz;
  v_price integer;
  v_code public.discount_codes;
  v_row record;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and status = 'confirmed' and (client_id = auth.uid() or public.is_admin())
  for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;

  delete from public.booking_guests g
  where g.booking_id = p_booking_id
    and not exists (
      select 1 from jsonb_array_elements(v_guests) x
      where x ->> 'full_name' = g.full_name and (x ->> 'email') is not distinct from g.email
    );
  update public.booking_guests g set phone = x ->> 'phone'
  from jsonb_array_elements(v_guests) x
  where g.booking_id = p_booking_id and x ->> 'full_name' = g.full_name
    and (x ->> 'email') is not distinct from g.email;
  insert into public.booking_guests (booking_id, full_name, email, phone)
  select p_booking_id, x ->> 'full_name', x ->> 'email', x ->> 'phone'
  from jsonb_array_elements(v_guests) x
  where not exists (
    select 1 from public.booking_guests g
    where g.booking_id = p_booking_id and g.full_name = x ->> 'full_name'
      and g.email is not distinct from (x ->> 'email')
  );

  select s.*, lower(a.period) as starts_at into v_row
  from public.appointments a join public.services s on s.id = a.service_id
  where a.id = v_booking.appointment_id;
  select * into v_service from public.services where id = v_row.id;
  v_starts_at := v_row.starts_at;
  v_price := public.compute_price(v_service, v_starts_at, coalesce(v_booking.dogs_count, 1), jsonb_array_length(v_guests));
  if v_booking.discount_code_id is not null and v_price is not null then
    select * into v_code from public.discount_codes where id = v_booking.discount_code_id;
    update public.bookings set
      discount_cents = case v_code.kind when 'percent' then round(v_price * v_code.value / 100.0)::integer else least(v_price, v_code.value) end,
      price_cents = v_price - case v_code.kind when 'percent' then round(v_price * v_code.value / 100.0)::integer else least(v_price, v_code.value) end
    where id = p_booking_id;
  else
    update public.bookings set price_cents = v_price where id = p_booking_id;
  end if;
end;
$$;

-- Accès caméra d'un invité, par son lien personnel (sans compte).
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
  select g.full_name, lower(a.period) as s, upper(a.period) as e, r.is_open
  into v_row
  from public.booking_guests g
  join public.bookings b on b.id = g.booking_id and b.status = 'confirmed'
  join public.appointments a on a.id = b.appointment_id and a.status = 'scheduled'
  join public.resources r on r.id = a.resource_id and r.slug = 'park'
  where g.access_token = p_token;

  if not found or not v_row.is_open or v_row.e <= now() then
    return query select 'denied'::text, null::timestamptz, null::timestamptz, null::timestamptz, null::text;
  elsif v_row.s > now() then
    return query select 'not_started'::text, null::timestamptz, v_row.s, v_row.e, v_row.full_name;
  else
    return query select 'private'::text, least(v_row.e, now() + interval '10 minutes'), v_row.s, v_row.e, v_row.full_name;
  end if;
end;
$$;

-- Email du lien live à chaque invité (30 min avant le début), recalé au report, retiré à l'annulation.
alter type public.notification_kind add value 'guest_live_link';

alter table public.notifications
  drop constraint notifications_audience_check,
  add constraint notifications_audience_check check (audience in ('client', 'admin', 'guest')),
  add column guest_id uuid references public.booking_guests (id) on delete cascade;

create or replace function public.booking_guests_enqueue_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
begin
  if new.email is null then
    return null;
  end if;
  select lower(a.period) into v_start
  from public.bookings b
  join public.appointments a on a.id = b.appointment_id
  join public.resources r on r.id = a.resource_id and r.slug = 'park'
  where b.id = new.booking_id and b.status = 'confirmed';
  if v_start is not null and v_start > now() then
    insert into public.notifications (kind, booking_id, audience, guest_id, send_after)
    values ('guest_live_link', new.booking_id, 'guest', new.id, greatest(now(), v_start - interval '30 minutes'));
  end if;
  return null;
end;
$$;

create trigger booking_guests_enqueue_link
  after insert or update of email on public.booking_guests
  for each row execute function public.booking_guests_enqueue_link();

-- Annulation / report : les liens non envoyés suivent la réservation.
create or replace function public.bookings_guest_links_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    delete from public.notifications where booking_id = new.id and kind = 'guest_live_link' and sent_at is null;
  elsif new.appointment_id <> old.appointment_id then
    update public.notifications n
    set send_after = greatest(now(), lower(a.period) - interval '30 minutes')
    from public.appointments a
    where a.id = new.appointment_id and n.booking_id = new.id and n.kind = 'guest_live_link' and n.sent_at is null;
  end if;
  return null;
end;
$$;

create trigger bookings_guest_links_follow
  after update of status, appointment_id on public.bookings
  for each row execute function public.bookings_guest_links_follow();

-- ---------------------------------------------------------------------------
-- Réservation : prix calculé et invités enregistrés dans la même transaction
-- ---------------------------------------------------------------------------

drop function public.book_slot(uuid, timestamptz, uuid, text, text, integer, integer, integer, text, uuid[], uuid[]);
drop function public.book_event(uuid, uuid, text, integer, integer, integer, integer, text, uuid[], uuid[]);
drop function public.prepare_booking(public.services, uuid, uuid, text, text, integer, integer, integer, text, uuid[]);

create function public.prepare_booking(
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
  p_price integer,
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

  price_cents := p_price;
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
  p_guests jsonb default null
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

  v_price := public.compute_price(v_service, p_starts_at, coalesce(v_dogs_count, 1), jsonb_array_length(v_guests));
  select * into v_prep from public.prepare_booking(
    v_service, v_uid, v_dogs[1], p_notes, p_visit_address, p_adults_count, p_children_count,
    v_dogs_count, p_discount_code, p_document_ids, v_price
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
  p_guests jsonb default null
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

  v_price := public.compute_price(v_service, v_starts_at, coalesce(v_dogs_count, 1), jsonb_array_length(v_guests));
  select * into v_prep from public.prepare_booking(
    v_service, v_uid, v_dogs[1], p_notes, null, p_adults_count, p_children_count,
    v_dogs_count, p_discount_code, p_document_ids, v_price
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
  perform public.insert_guests(v_booking_id, v_guests);
  perform public.record_acceptances(v_uid, v_booking_id, p_document_ids);
  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- M3-12 : jours complets (des créneaux existent ce jour-là, mais tous sont pris)
-- ---------------------------------------------------------------------------

create or replace function public.get_full_days(p_service_id uuid, p_from date, p_to date)
returns setof date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Europe/Brussels';
  v_service public.services;
  v_earliest timestamptz;
  v_latest timestamptz;
begin
  select * into v_service from public.services where id = p_service_id and active and booking_enabled;
  if not found then
    raise exception 'service_not_found' using errcode = 'P0001';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;
  v_earliest := greatest(now() + make_interval(hours => v_service.min_notice_hours), p_from::timestamp at time zone v_tz);
  v_latest := least(now() + make_interval(days => v_service.max_advance_days), (p_to + 1)::timestamp at time zone v_tz);

  if v_service.mode = 'event' then
    return query
      select distinct (lower(a.period) at time zone v_tz)::date
      from public.appointments a
      where a.service_id = v_service.id and a.status = 'scheduled'
        and lower(a.period) >= v_earliest and lower(a.period) < v_latest
        and a.capacity <= (select coalesce(sum(b.party_size), 0) from public.bookings b
                           where b.appointment_id = a.id and b.status = 'confirmed')
        and not exists (
          select 1 from public.get_available_slots(p_service_id, (lower(a.period) at time zone v_tz)::date,
                                                   (lower(a.period) at time zone v_tz)::date))
      order by 1;
    return;
  end if;

  return query
    with days as (
      select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
    ),
    candidates as (
      select dy.day, gs as c_start, gs + make_interval(mins => v_service.duration_minutes) as c_end
      from days dy
      join public.availability_rules r
        on r.resource_id = v_service.resource_id
       and r.weekday = extract(isodow from dy.day)
       and dy.day >= r.valid_from
       and (r.valid_until is null or dy.day <= r.valid_until),
      generate_series(
        (dy.day + r.start_time) at time zone v_tz,
        (dy.day + r.end_time) at time zone v_tz - make_interval(mins => v_service.duration_minutes),
        make_interval(mins => v_service.slot_step_minutes)
      ) gs
    ),
    open_candidates as (
      select c.* from candidates c
      where c.c_start >= v_earliest and c.c_start < v_latest
        and not exists (
          select 1 from public.blackouts bo
          where bo.resource_id = v_service.resource_id and bo.period && tstzrange(c.c_start, c.c_end)
        )
    )
    select oc.day from open_candidates oc
    group by oc.day
    having bool_and(exists (
      select 1 from public.appointments a
      where a.resource_id = v_service.resource_id and a.status = 'scheduled'
        and a.blocked && tstzrange(oc.c_start - make_interval(mins => v_service.buffer_minutes),
                                   oc.c_end + make_interval(mins => v_service.buffer_minutes))
    ))
    order by oc.day;
end;
$$;

-- ---------------------------------------------------------------------------
-- M1-02 : import de l'agenda personnel (iCal) en indisponibilités
-- ---------------------------------------------------------------------------

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 120),
  -- Adresse secrète iCal (Google Agenda : « Adresse secrète au format iCal »). Jamais lisible par les clients.
  url text not null check (url ~* '^(https|webcal)://' and char_length(url) <= 1000),
  active boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  event_count integer,
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;
create policy "calendar_feeds: admin" on public.calendar_feeds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.blackouts
  add column source text not null default 'manual' check (source in ('manual', 'external')),
  add column feed_id uuid references public.calendar_feeds (id) on delete cascade;

-- Appelée par l'Edge Function calendar-import : remplace les indisponibilités futures d'un agenda.
create or replace function public.replace_external_busy(p_feed_id uuid, p_events jsonb, p_error text default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_feed public.calendar_feeds;
  v_count integer := 0;
begin
  select * into v_feed from public.calendar_feeds where id = p_feed_id for update;
  if not found then
    raise exception 'feed_not_found' using errcode = 'P0001';
  end if;
  if p_error is not null then
    update public.calendar_feeds set last_error = left(p_error, 500), last_synced_at = now() where id = p_feed_id;
    return 0;
  end if;

  delete from public.blackouts where feed_id = p_feed_id and upper(period) > now() - interval '1 day';
  insert into public.blackouts (resource_id, period, reason, source, feed_id)
  select v_feed.resource_id, tstzrange((e ->> 'start')::timestamptz, (e ->> 'end')::timestamptz), '', 'external', p_feed_id
  from jsonb_array_elements(coalesce(p_events, '[]')) e
  where (e ->> 'end')::timestamptz > (e ->> 'start')::timestamptz
    and (e ->> 'end')::timestamptz > now() - interval '1 day';
  get diagnostics v_count = row_count;
  update public.calendar_feeds
  set last_synced_at = now(), last_error = null, event_count = v_count
  where id = p_feed_id;
  return v_count;
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
grant execute on function public.get_required_documents(uuid, text) to anon, authenticated;
grant execute on function public.quote_price(uuid, timestamptz, integer, integer, text) to anon, authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.book_slot(uuid, timestamptz, uuid, text, text, integer, integer, integer, text, uuid[], uuid[], jsonb) to authenticated;
grant execute on function public.book_event(uuid, uuid, text, integer, integer, integer, integer, text, uuid[], uuid[], jsonb) to authenticated;
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
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.enqueue_expiry_alerts() to service_role;
grant execute on function public.replace_external_busy(uuid, jsonb, text) to service_role;
