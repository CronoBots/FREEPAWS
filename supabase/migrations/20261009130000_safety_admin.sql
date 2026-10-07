-- Phase 2 (suite) : incidents, urgence, fiche secours, double authentification de l'administratrice,
-- rôles, tableau de bord, export RGPD, liste d'attente, alertes d'échéance.

-- ---------------------------------------------------------------------------
-- Double authentification (M10-03)
-- ---------------------------------------------------------------------------
-- Dès qu'une administratrice a activé un facteur TOTP, ses droits ne valent que pour une session
-- vérifiée en deux étapes (aal2). Avant l'activation, l'app l'invite à le faire.

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
  )
  and (
    coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status::text = 'verified'
    )
  );
$$;

-- Rôle sans condition de session : sert à l'app pour savoir qu'il faut demander le second facteur.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role::text from public.profiles where id = (select auth.uid());
$$;

-- Gestion des rôles depuis l'app (jamais la dernière administratrice).
create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  if p_role = 'client' and (
    select count(*) from public.profiles where role = 'admin' and id <> p_user_id
  ) = 0 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registre d'incidents (M9-05)
-- ---------------------------------------------------------------------------

create type public.incident_kind as enum ('injury', 'bite', 'fight', 'dirt', 'rules_breach', 'other');

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  kind public.incident_kind not null,
  description text not null default '' check (char_length(description) <= 4000),
  -- Article du règlement enfreint (texte libre).
  rule_reference text check (char_length(rule_reference) <= 200),
  booking_id uuid references public.bookings (id) on delete set null,
  person_ids uuid[] not null default '{}',
  dog_ids uuid[] not null default '{}',
  photo_paths text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incidents_occurred_idx on public.incidents (occurred_at desc);
create index incidents_people_idx on public.incidents using gin (person_ids);
create index incidents_dogs_idx on public.incidents using gin (dog_ids);

create trigger incidents_set_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();
create trigger incidents_audit
  after insert or update or delete on public.incidents
  for each row execute function public.audit_row();

alter table public.incidents enable row level security;
create policy "incidents: admin" on public.incidents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.sanctions
  add constraint sanctions_incident_fk foreign key (incident_id) references public.incidents (id) on delete set null;

-- Photos d'incidents : bucket privé réservé à l'administratrice.
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('incidents', 'incidents', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
    on conflict (id) do nothing;
    execute $p$
      create policy "incidents: admin" on storage.objects for all to authenticated
        using (bucket_id = 'incidents' and public.is_admin())
        with check (bucket_id = 'incidents' and public.is_admin())
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fiche secours (M9-03) : rédigée par l'administratrice, lisible par tout client connecté
-- ---------------------------------------------------------------------------

alter table public.settings
  add column rescue_info text not null default '' check (char_length(rescue_info) <= 4000);

create or replace function public.get_rescue_info()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then null else (select rescue_info from public.settings) end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications : messages non liés à une réservation
-- ---------------------------------------------------------------------------

alter type public.notification_kind add value 'insurance_expiring';
alter type public.notification_kind add value 'vaccination_expiring';
alter type public.notification_kind add value 'vaccination_reviewed';
alter type public.notification_kind add value 'waitlist_slot_freed';
alter type public.notification_kind add value 'admin_documents_expired';
alter type public.notification_kind add value 'admin_vaccination_to_review';
alter type public.notification_kind add value 'admin_emergency';

alter table public.notifications
  alter column booking_id drop not null,
  add column profile_id uuid references public.profiles (id) on delete cascade,
  add column dog_id uuid references public.dogs (id) on delete cascade,
  -- Date de référence (échéance, jour) : évite d'envoyer deux fois la même alerte.
  add column ref_date date,
  add column payload jsonb not null default '{}',
  add constraint notifications_target check (
    booking_id is not null or profile_id is not null or audience = 'admin'
  );

create unique index notifications_dedupe_idx on public.notifications (
  kind, coalesce(profile_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(dog_id, '00000000-0000-0000-0000-000000000000'), ref_date
) where ref_date is not null;

-- ---------------------------------------------------------------------------
-- Urgence (M9-01, M9-02)
-- ---------------------------------------------------------------------------

create table public.emergencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles (id) on delete set null
);

create index emergencies_open_idx on public.emergencies (created_at desc) where acknowledged_at is null;

alter table public.emergencies enable row level security;
create policy "emergencies: les siennes ou admin" on public.emergencies for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "emergencies: admin met à jour" on public.emergencies for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.notifications
  add column emergency_id uuid references public.emergencies (id) on delete cascade;

-- Bouton « Urgence » : réservé à la personne dont la réservation est en cours (15 min de marge).
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

  if exists (select 1 from public.settings where admin_email is not null) then
    insert into public.notifications (kind, booking_id, audience, emergency_id)
    values ('admin_emergency', v_booking_id, 'admin', v_id);
  end if;
  return v_id;
end;
$$;

-- Mode urgence : qui est (ou va être) sur place, contacts d'urgence, chiens à protocole, invités.
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
        (select coalesce(jsonb_agg(jsonb_build_object(
            'id', d.id, 'name', d.name, 'breed', d.breed, 'protocol', d.protocol,
            'protocol_note', d.protocol_note, 'bite_history', d.bite_history, 'reactivity', d.reactivity)), '[]')
         from public.dogs d
         where d.id in (select bd.dog_id from public.booking_dogs bd where bd.booking_id = b.id)
            or d.id = b.dog_id) as dogs,
        (select coalesce(jsonb_agg(jsonb_build_object('full_name', g.full_name, 'phone', g.phone, 'email', g.email)), '[]')
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
-- Alertes d'échéance (M2-02, M2-04, M6-05) : appelée chaque jour par pg_cron
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_expiry_alerts()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Brussels')::date;
  v_days integer;
  v_admin boolean;
  v_count integer := 0;
  v_rows integer;
  v_expired integer;
begin
  select expiry_alert_days, admin_email is not null into v_days, v_admin from public.settings;

  -- Assurance qui arrive à échéance.
  insert into public.notifications (kind, audience, profile_id, ref_date)
  select 'insurance_expiring', 'client', p.id, p.insurance_valid_until
  from public.profiles p
  where p.insurance_valid_until between v_today and v_today + v_days
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Vaccin exigé qui arrive à échéance (sans vaccination plus récente déjà validée).
  insert into public.notifications (kind, audience, profile_id, dog_id, ref_date, payload)
  select 'vaccination_expiring', 'client', d.owner_id, d.id, v.valid_until, jsonb_build_object('vaccine', vt.name)
  from public.dog_vaccinations v
  join public.dogs d on d.id = v.dog_id
  join public.vaccine_types vt on vt.id = v.vaccine_type_id and vt.active and vt.required
  where v.status = 'validated' and v.valid_until between v_today and v_today + v_days
    and not exists (
      select 1 from public.dog_vaccinations newer
      where newer.dog_id = v.dog_id and newer.vaccine_type_id = v.vaccine_type_id
        and newer.status = 'validated' and newer.valid_until > v.valid_until
    )
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Récapitulatif pour l'administratrice : documents échus hier.
  if v_admin then
    select
      (select count(*) from public.profiles where insurance_valid_until = v_today - 1)
      + (select count(*) from public.dog_vaccinations v
         join public.vaccine_types vt on vt.id = v.vaccine_type_id and vt.active and vt.required
         where v.status = 'validated' and v.valid_until = v_today - 1)
    into v_expired;
    if v_expired > 0 then
      insert into public.notifications (kind, audience, ref_date, payload)
      values ('admin_documents_expired', 'admin', v_today, jsonb_build_object('count', v_expired))
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    end if;
  end if;

  return v_count;
end;
$$;

-- Vaccination à valider (alerte admin) et résultat de la validation (email au propriétaire).
create or replace function public.dog_vaccinations_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.dogs where id = new.dog_id;
  if new.status = 'pending' and not public.is_admin()
     and exists (select 1 from public.settings where admin_email is not null) then
    insert into public.notifications (kind, audience, profile_id, dog_id, ref_date)
    values ('admin_vaccination_to_review', 'admin', v_owner, new.dog_id, (now() at time zone 'Europe/Brussels')::date)
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and new.status <> 'pending' and old.status = 'pending' then
    insert into public.notifications (kind, audience, profile_id, dog_id, payload)
    values ('vaccination_reviewed', 'client', v_owner, new.dog_id,
            jsonb_build_object('status', new.status, 'note', new.review_note,
                               'vaccine', (select name from public.vaccine_types where id = new.vaccine_type_id)));
  end if;
  return null;
end;
$$;

create trigger dog_vaccinations_notify
  after insert or update on public.dog_vaccinations
  for each row execute function public.dog_vaccinations_notify();

-- ---------------------------------------------------------------------------
-- Liste d'attente (M3-12)
-- ---------------------------------------------------------------------------

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  day date not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, service_id, day)
);

create index waitlist_entries_day_idx on public.waitlist_entries (service_id, day) where notified_at is null;

alter table public.waitlist_entries enable row level security;
create policy "waitlist: les siennes ou admin" on public.waitlist_entries for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "waitlist: s'inscrire" on public.waitlist_entries for insert to authenticated
  with check (user_id = (select auth.uid()) and day >= current_date);
create policy "waitlist: se désinscrire" on public.waitlist_entries for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

grant select, insert, delete on public.waitlist_entries to authenticated;

-- Un rendez-vous annulé libère un créneau : on prévient les inscrits de la même ressource et du même jour.
create or replace function public.appointments_notify_waitlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (lower(new.period) at time zone 'Europe/Brussels')::date;
begin
  if old.status = 'scheduled' and new.status = 'cancelled' and lower(new.period) > now() then
    with notified as (
      update public.waitlist_entries w
      set notified_at = now()
      from public.services s
      where s.id = w.service_id and s.resource_id = new.resource_id and s.active and s.booking_enabled
        and w.day = v_day and w.notified_at is null
      returning w.user_id, w.service_id, w.day
    )
    insert into public.notifications (kind, audience, profile_id, ref_date, payload)
    select 'waitlist_slot_freed', 'client', n.user_id, n.day, jsonb_build_object('service_id', n.service_id)
    from notified n
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger appointments_notify_waitlist
  after update of status on public.appointments
  for each row execute function public.appointments_notify_waitlist();

-- ---------------------------------------------------------------------------
-- Tableau de bord (M10-01)
-- ---------------------------------------------------------------------------

create or replace function public.admin_stats(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_range tstzrange := tstzrange(
    (p_from::timestamp at time zone 'Europe/Brussels'),
    ((p_to + 1)::timestamp at time zone 'Europe/Brussels')
  );
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'bookings', (
      select count(*) from public.bookings b join public.appointments a on a.id = b.appointment_id
      where b.status = 'confirmed' and lower(a.period) <@ v_range
    ),
    'cancellations', (
      select count(*) from public.bookings b join public.appointments a on a.id = b.appointment_id
      where b.status = 'cancelled' and lower(a.period) <@ v_range
    ),
    'revenue_cents', (
      select coalesce(sum(b.price_cents), 0) from public.bookings b join public.appointments a on a.id = b.appointment_id
      where b.status = 'confirmed' and lower(a.period) <@ v_range
    ),
    'new_clients', (
      select count(*) from public.profiles
      where role = 'client' and created_at <@ v_range
    ),
    'by_service', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]') from (
        select s.name, count(*) as count, coalesce(sum(b.price_cents), 0) as revenue_cents
        from public.bookings b
        join public.appointments a on a.id = b.appointment_id
        join public.services s on s.id = a.service_id
        where b.status = 'confirmed' and lower(a.period) <@ v_range
        group by s.name
      ) x
    ),
    'by_hour', (
      select coalesce(jsonb_object_agg(h, c), '{}') from (
        select extract(hour from lower(a.period) at time zone 'Europe/Brussels')::int as h, count(*) as c
        from public.bookings b join public.appointments a on a.id = b.appointment_id
        where b.status = 'confirmed' and lower(a.period) <@ v_range
        group by 1
      ) x
    ),
    'by_weekday', (
      select coalesce(jsonb_object_agg(d, c), '{}') from (
        select extract(isodow from lower(a.period) at time zone 'Europe/Brussels')::int as d, count(*) as c
        from public.bookings b join public.appointments a on a.id = b.appointment_id
        where b.status = 'confirmed' and lower(a.period) <@ v_range
        group by 1
      ) x
    ),
    -- Remplissage : minutes réservées / minutes d'ouverture (horaires de la semaine, hors fermetures).
    'fill_rate', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'resource', r.name,
        'booked_minutes', bm.minutes,
        'open_minutes', om.minutes,
        'rate', case when om.minutes > 0 then round(bm.minutes::numeric / om.minutes, 3) end)), '[]')
      from public.resources r
      cross join lateral (
        select coalesce(sum(extract(epoch from upper(a.period) - lower(a.period)) / 60), 0)::int as minutes
        from public.appointments a
        where a.resource_id = r.id and a.status = 'scheduled' and lower(a.period) <@ v_range
      ) bm
      cross join lateral (
        select coalesce(sum(extract(epoch from ar.end_time - ar.start_time) / 60), 0)::int as minutes
        from generate_series(p_from, p_to, interval '1 day') day
        join public.availability_rules ar
          on ar.resource_id = r.id
         and ar.weekday = extract(isodow from day)
         and ar.valid_from <= day::date
         and (ar.valid_until is null or ar.valid_until >= day::date)
        where not exists (
          select 1 from public.blackouts bo
          where bo.resource_id = r.id
            and bo.period @> ((day::date + ar.start_time)::timestamp at time zone 'Europe/Brussels')
        )
      ) om
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Droit d'accès RGPD (M11-03) : toutes les données du compte en un fichier
-- ---------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'role' from public.profiles p where p.id = v_uid),
    'dogs', (select coalesce(jsonb_agg(to_jsonb(d) - 'protocol' - 'protocol_note'), '[]') from public.dogs d where d.owner_id = v_uid),
    'vaccinations', (
      select coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object('vaccine', vt.name)), '[]')
      from public.dog_vaccinations v
      join public.dogs d on d.id = v.dog_id
      join public.vaccine_types vt on vt.id = v.vaccine_type_id
      where d.owner_id = v_uid
    ),
    'bookings', (
      select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object(
        'service', s.name, 'starts_at', lower(a.period), 'ends_at', upper(a.period),
        'guests', (select coalesce(jsonb_agg(to_jsonb(g)), '[]') from public.booking_guests g where g.booking_id = b.id))), '[]')
      from public.bookings b
      join public.appointments a on a.id = b.appointment_id
      join public.services s on s.id = a.service_id
      where b.client_id = v_uid
    ),
    'accepted_documents', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind', d.kind, 'language', d.language, 'version', d.version, 'title', d.title, 'accepted_at', x.accepted_at)), '[]')
      from public.document_acceptances x
      join public.legal_documents d on d.id = x.document_id
      where x.user_id = v_uid
    ),
    'sanctions', (select coalesce(jsonb_agg(to_jsonb(s) - 'created_by'), '[]') from public.sanctions s where s.user_id = v_uid),
    'waitlist', (select coalesce(jsonb_agg(to_jsonb(w)), '[]') from public.waitlist_entries w where w.user_id = v_uid)
  );
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
grant execute on function public.my_role() to authenticated;
grant execute on function public.book_slot(uuid, timestamptz, uuid, text, text, integer, integer, integer, text, uuid[], uuid[]) to authenticated;
grant execute on function public.book_event(uuid, uuid, text, integer, integer, integer, integer, text, uuid[], uuid[]) to authenticated;
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
