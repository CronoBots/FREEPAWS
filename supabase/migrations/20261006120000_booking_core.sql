-- FreePaws — cœur du module de réservation.
--
-- Modèle :
--   resources       ressources réservables (la coach, le parc) : une ressource ne peut
--                   pas être à deux endroits à la fois.
--   services        prestations proposées ; mode 'slot' (créneau individuel calculé
--                   depuis les disponibilités) ou 'event' (séance de groupe planifiée).
--   availability_rules / blackouts
--                   horaires d'ouverture hebdomadaires et périodes bloquées.
--   appointments    occupation réelle de l'agenda d'une ressource. Une contrainte
--                   d'exclusion interdit tout chevauchement (double réservation).
--   bookings        inscription d'un client à un rendez-vous.
--
-- Les clients ne modifient jamais appointments/bookings directement : ils passent
-- par les fonctions book_slot, book_event et cancel_booking, qui valident tout côté
-- serveur. Toutes les heures sont stockées en timestamptz ; les règles horaires sont
-- exprimées en heure de Bruxelles.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('client', 'admin');
create type public.booking_mode as enum ('slot', 'event');
create type public.appointment_status as enum ('scheduled', 'cancelled');
create type public.booking_status as enum ('confirmed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  role public.user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Un profil par compte. Le rôle se change uniquement depuis le tableau de bord Supabase.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crée le profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garde l'email du profil aligné sur celui du compte.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Chiens
-- ---------------------------------------------------------------------------

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  breed text check (char_length(breed) <= 80),
  birth_date date check (birth_date <= current_date),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dogs_owner_id_idx on public.dogs (owner_id);

create trigger dogs_set_updated_at
  before update on public.dogs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  -- Tant que la ressource n'est pas ouverte (ex. le parc en recherche de terrain),
  -- son statut est « not_open » et aucune caméra n'est accessible au public.
  is_open boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  resource_id uuid not null references public.resources (id),
  mode public.booking_mode not null,
  name text not null,
  summary text not null default '',
  description text not null default '',
  location text not null default '',
  -- Inconnue tant que FreePaws ne l'a pas communiquée (null = non affichée).
  duration_minutes integer check (duration_minutes between 15 and 480),
  -- Pas de la grille de créneaux proposés (mode 'slot').
  slot_step_minutes integer not null default 30 check (slot_step_minutes between 5 and 240),
  -- Temps bloqué avant/après (trajet pour les visites à domicile).
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  -- Places par séance (mode 'event').
  default_capacity integer not null default 1 check (default_capacity between 1 and 50),
  price_cents integer check (price_cents >= 0),
  min_notice_hours integer not null default 24 check (min_notice_hours >= 0),
  max_advance_days integer not null default 60 check (max_advance_days between 1 and 365),
  cancel_notice_hours integer not null default 24 check (cancel_notice_hours >= 0),
  active boolean not null default true,
  -- Réservation en ligne ouverte ? Sinon l'app propose « Prendre rendez-vous » par email.
  -- À activer seulement quand durée, horaires et règles d'annulation sont fixés par FreePaws.
  booking_enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not booking_enabled or duration_minutes is not null)
);

create index services_resource_id_idx on public.services (resource_id);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Disponibilités
-- ---------------------------------------------------------------------------

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  -- ISO : 1 = lundi … 7 = dimanche
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  valid_from date not null default current_date,
  valid_until date,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check (valid_until is null or valid_until >= valid_from)
);

create index availability_rules_resource_idx on public.availability_rules (resource_id, weekday);

create table public.blackouts (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  period tstzrange not null check (not isempty(period) and lower(period) is not null and upper(period) is not null),
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);

create index blackouts_resource_period_idx on public.blackouts using gist (resource_id, period);

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id),
  service_id uuid not null references public.services (id),
  period tstzrange not null check (not isempty(period) and lower(period) is not null and upper(period) is not null),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  -- period élargie du buffer ; calculée par trigger, c'est elle qui ne doit pas se chevaucher.
  blocked tstzrange not null default 'empty',
  capacity integer not null default 1 check (capacity between 1 and 50),
  status public.appointment_status not null default 'scheduled',
  admin_notes text check (char_length(admin_notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_no_overlap
    exclude using gist (resource_id with =, blocked with &&) where (status = 'scheduled')
);

create index appointments_service_idx on public.appointments (service_id);
create index appointments_period_idx on public.appointments using gist (period);

create or replace function public.appointments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.blocked := tstzrange(
    lower(new.period) - make_interval(mins => new.buffer_minutes),
    upper(new.period) + make_interval(mins => new.buffer_minutes)
  );
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger appointments_before_write
  before insert or update on public.appointments
  for each row execute function public.appointments_before_write();

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  dog_id uuid references public.dogs (id) on delete set null,
  party_size integer not null default 1 check (party_size between 1 and 10),
  status public.booking_status not null default 'confirmed',
  client_notes text check (char_length(client_notes) <= 1000),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index bookings_one_active_per_client
  on public.bookings (appointment_id, client_id) where status = 'confirmed';
create index bookings_client_idx on public.bookings (client_id);
create index bookings_dog_idx on public.bookings (dog_id);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- Capacité : verrouille le rendez-vous puis compte les places prises.
create or replace function public.bookings_enforce_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_capacity integer;
  v_status public.appointment_status;
  v_taken integer;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  select capacity, status into v_capacity, v_status
  from public.appointments
  where id = new.appointment_id
  for update;

  if v_status <> 'scheduled' then
    raise exception 'appointment_cancelled' using errcode = 'P0001';
  end if;

  select coalesce(sum(party_size), 0) into v_taken
  from public.bookings
  where appointment_id = new.appointment_id
    and status = 'confirmed'
    and id <> new.id;

  if v_taken + new.party_size > v_capacity then
    raise exception 'appointment_full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger bookings_enforce_capacity
  before insert or update of status, party_size, appointment_id on public.bookings
  for each row execute function public.bookings_enforce_capacity();

-- Annuler une réservation individuelle libère le créneau ;
-- annuler un rendez-vous annule ses réservations.
create or replace function public.bookings_after_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'confirmed' and new.status = 'cancelled' then
    update public.appointments a
    set status = 'cancelled'
    from public.services s
    where a.id = new.appointment_id
      and s.id = a.service_id
      and s.mode = 'slot'
      and a.status = 'scheduled';
  end if;
  return null;
end;
$$;

create trigger bookings_after_cancel
  after update of status on public.bookings
  for each row execute function public.bookings_after_cancel();

create or replace function public.appointments_after_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

create trigger appointments_after_cancel
  after update of status on public.appointments
  for each row execute function public.appointments_after_cancel();

-- ---------------------------------------------------------------------------
-- Fonctions de réservation (API appelée par l'app)
-- ---------------------------------------------------------------------------

-- Créneaux disponibles d'une prestation entre deux dates (incluses, heure de Bruxelles).
create or replace function public.get_available_slots(
  p_service_id uuid,
  p_from date,
  p_to date
)
returns table (appointment_id uuid, starts_at timestamptz, ends_at timestamptz, remaining integer)
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
      select a.id, lower(a.period), upper(a.period), (a.capacity - coalesce(t.taken, 0))::integer
      from public.appointments a
      left join lateral (
        select sum(b.party_size) as taken
        from public.bookings b
        where b.appointment_id = a.id and b.status = 'confirmed'
      ) t on true
      where a.service_id = v_service.id
        and a.status = 'scheduled'
        and lower(a.period) >= v_earliest
        and lower(a.period) < v_latest
        and a.capacity - coalesce(t.taken, 0) > 0
      order by lower(a.period);
    return;
  end if;

  return query
    with days as (
      select d::date as day
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
    ),
    windows as (
      select (dy.day + r.start_time) at time zone v_tz as w_start,
             (dy.day + r.end_time) at time zone v_tz as w_end
      from days dy
      join public.availability_rules r
        on r.resource_id = v_service.resource_id
       and r.weekday = extract(isodow from dy.day)
       and dy.day >= r.valid_from
       and (r.valid_until is null or dy.day <= r.valid_until)
    ),
    candidates as (
      select distinct gs as c_start, gs + make_interval(mins => v_service.duration_minutes) as c_end
      from windows w,
           generate_series(
             w.w_start,
             w.w_end - make_interval(mins => v_service.duration_minutes),
             make_interval(mins => v_service.slot_step_minutes)
           ) as gs
    )
    select null::uuid, c.c_start, c.c_end, 1
    from candidates c
    where c.c_start >= v_earliest
      and c.c_start < v_latest
      and not exists (
        select 1 from public.blackouts bo
        where bo.resource_id = v_service.resource_id
          and bo.period && tstzrange(c.c_start, c.c_end)
      )
      and not exists (
        select 1 from public.appointments a
        where a.resource_id = v_service.resource_id
          and a.status = 'scheduled'
          and a.blocked && tstzrange(
            c.c_start - make_interval(mins => v_service.buffer_minutes),
            c.c_end + make_interval(mins => v_service.buffer_minutes)
          )
      )
    order by c.c_start;
end;
$$;

-- Limite anti-abus : nombre de réservations à venir par client.
create or replace function public.assert_booking_quota(p_client_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  -- Sérialise les réservations d'un même client : sans ce verrou, des appels parallèles
  -- compteraient tous le même total et dépasseraient la limite.
  perform pg_advisory_xact_lock(hashtextextended('booking_quota:' || p_client_id::text, 0));
  if (
    select count(*)
    from public.bookings b
    join public.appointments a on a.id = b.appointment_id
    where b.client_id = p_client_id
      and b.status = 'confirmed'
      and upper(a.period) > now()
  ) >= 5 then
    raise exception 'too_many_bookings' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.assert_dog_owner(p_dog_id uuid, p_owner_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_dog_id is not null
     and not exists (select 1 from public.dogs where id = p_dog_id and owner_id = p_owner_id) then
    raise exception 'dog_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Réserve un créneau individuel. Retourne l'id de la réservation.
create or replace function public.book_slot(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_dog_id uuid default null,
  p_notes text default null
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
  v_day date;
  v_appointment_id uuid;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if char_length(p_notes) > 1000 then
    raise exception 'notes_too_long' using errcode = 'P0001';
  end if;

  select * into v_service from public.services
  where id = p_service_id and active and booking_enabled and mode = 'slot';
  if not found then
    raise exception 'service_not_found' using errcode = 'P0001';
  end if;

  perform public.assert_dog_owner(p_dog_id, v_uid);
  perform public.assert_booking_quota(v_uid);

  v_day := (p_starts_at at time zone 'Europe/Brussels')::date;
  if not exists (
    select 1 from public.get_available_slots(p_service_id, v_day, v_day) s
    where s.starts_at = p_starts_at
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  begin
    insert into public.appointments (resource_id, service_id, period, buffer_minutes, capacity, created_by)
    values (
      v_service.resource_id,
      v_service.id,
      tstzrange(p_starts_at, p_starts_at + make_interval(mins => v_service.duration_minutes)),
      v_service.buffer_minutes,
      1,
      v_uid
    )
    returning id into v_appointment_id;
  exception when exclusion_violation then
    -- Quelqu'un a pris le créneau entre la lecture et l'écriture.
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end;

  insert into public.bookings (appointment_id, client_id, dog_id, client_notes)
  values (v_appointment_id, v_uid, p_dog_id, nullif(trim(p_notes), ''))
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- S'inscrit à une séance de groupe (atelier). Retourne l'id de la réservation.
create or replace function public.book_event(
  p_appointment_id uuid,
  p_dog_id uuid default null,
  p_notes text default null,
  p_party_size integer default 1
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_min_notice_hours integer;
  v_starts_at timestamptz;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if char_length(p_notes) > 1000 then
    raise exception 'notes_too_long' using errcode = 'P0001';
  end if;
  if p_party_size is null or p_party_size not between 1 and 10 then
    raise exception 'invalid_party_size' using errcode = 'P0001';
  end if;

  select lower(a.period), s.min_notice_hours into v_starts_at, v_min_notice_hours
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.id = p_appointment_id
    and a.status = 'scheduled'
    and s.active
    and s.booking_enabled
    and s.mode = 'event';
  if not found then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;
  if v_starts_at < now() + make_interval(hours => v_min_notice_hours) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  perform public.assert_dog_owner(p_dog_id, v_uid);
  perform public.assert_booking_quota(v_uid);

  begin
    insert into public.bookings (appointment_id, client_id, dog_id, client_notes, party_size)
    values (p_appointment_id, v_uid, p_dog_id, nullif(trim(p_notes), ''), p_party_size)
    returning id into v_booking_id;
  exception when unique_violation then
    raise exception 'already_booked' using errcode = 'P0001';
  end;

  return v_booking_id;
end;
$$;

-- Annule une réservation (le client dans le délai prévu, l'admin à tout moment).
create or replace function public.cancel_booking(p_booking_id uuid)
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
  v_starts_at timestamptz;
  v_notice integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select b.* into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found or (v_booking.client_id <> v_uid and not v_is_admin) then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;
  if v_booking.status = 'cancelled' then
    return;
  end if;

  select lower(a.period), s.cancel_notice_hours into v_starts_at, v_notice
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.id = v_booking.appointment_id;

  if not v_is_admin then
    if v_starts_at <= now() then
      raise exception 'booking_in_past' using errcode = 'P0001';
    end if;
    if v_starts_at < now() + make_interval(hours => v_notice) then
      raise exception 'cancellation_too_late' using errcode = 'P0001';
    end if;
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid
  where id = p_booking_id;
end;
$$;

-- Suppression de compte depuis l'app (exigence App Store / Google Play, RGPD).
-- Libère d'abord les créneaux à venir, puis supprime le compte (cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid
  where client_id = v_uid and status = 'confirmed';

  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sécurité : RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.resources enable row level security;
alter table public.services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blackouts enable row level security;
alter table public.appointments enable row level security;
alter table public.bookings enable row level security;

-- profiles
create policy "profiles: lecture du sien ou admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: mise à jour du sien" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Seuls nom et téléphone sont modifiables par l'utilisateur (pas le rôle ni l'email).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- dogs
create policy "dogs: le propriétaire gère ses chiens" on public.dogs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "dogs: l'admin consulte" on public.dogs
  for select to authenticated
  using ((select public.is_admin()));

-- catalogue (lisible sans compte : on peut parcourir l'offre avant de s'inscrire)
create policy "resources: lecture publique" on public.resources
  for select to anon, authenticated using (true);
create policy "resources: admin écrit" on public.resources
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Les prestations désactivées restent lisibles : l'historique des clients doit les afficher.
-- L'app ne propose à la réservation que les actives, et les fonctions de réservation le vérifient.
create policy "services: lecture publique" on public.services
  for select to anon, authenticated
  using (true);
create policy "services: admin écrit" on public.services
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "availability: lecture publique" on public.availability_rules
  for select to anon, authenticated using (true);
create policy "availability: admin écrit" on public.availability_rules
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "blackouts: admin" on public.blackouts
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- agenda : le client voit les rendez-vous où il est inscrit ; l'admin voit et gère tout.
create policy "appointments: client inscrit ou admin" on public.appointments
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.bookings b
      where b.appointment_id = appointments.id and b.client_id = (select auth.uid())
    )
  );
create policy "appointments: admin écrit" on public.appointments
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "bookings: les siennes ou admin" on public.bookings
  for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_admin()));
create policy "bookings: admin écrit" on public.bookings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Sécurité : droits d'exécution des fonctions
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

-- is_admin() est appelée par les policies de lecture publique : elle renvoie false pour un visiteur anonyme.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_available_slots(uuid, date, date) to anon, authenticated;
grant execute on function public.book_slot(uuid, timestamptz, uuid, text) to authenticated;
grant execute on function public.book_event(uuid, uuid, text, integer) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
