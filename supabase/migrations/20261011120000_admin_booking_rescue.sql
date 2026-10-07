-- Précisions de FreePaws (octobre 2026) :
--   * coaching : après le premier rendez-vous, l'administratrice ajoute elle-même les suivis, avec une
--     durée variable, pour un client donné ;
--   * secours (M9-04) : accès temporaire en lecture seule au direct et à la fiche secours.

-- ---------------------------------------------------------------------------
-- Rendez-vous posé par l'administratrice pour un client
-- ---------------------------------------------------------------------------
-- Ignore les horaires d'ouverture et le délai de réservation (c'est elle qui décide), mais jamais
-- l'agenda : la contrainte d'exclusion empêche toujours le chevauchement. Le client reçoit la
-- confirmation et le rappel habituels.
create or replace function public.admin_book_for_client(
  p_service_id uuid,
  p_client_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_visit_address text default null,
  p_notes text default null,
  p_price_cents integer default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_service public.services;
  v_appointment_id uuid;
  v_booking_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 15 and 720 then
    raise exception 'invalid_duration' using errcode = 'P0001';
  end if;
  if p_starts_at < now() - interval '1 day' then
    raise exception 'booking_in_past' using errcode = 'P0001';
  end if;
  if p_price_cents is not null and p_price_cents < 0 then
    raise exception 'invalid_price' using errcode = 'P0001';
  end if;
  select * into v_service from public.services where id = p_service_id and mode = 'slot';
  if not found then
    raise exception 'service_not_found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_client_id) then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  begin
    insert into public.appointments (resource_id, service_id, period, buffer_minutes, capacity, created_by)
    values (
      v_service.resource_id, v_service.id,
      tstzrange(p_starts_at, p_starts_at + make_interval(mins => p_duration_minutes)),
      v_service.buffer_minutes, 1, auth.uid()
    )
    returning id into v_appointment_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end;

  insert into public.bookings (appointment_id, client_id, client_notes, visit_address, price_cents)
  values (
    v_appointment_id, p_client_id, nullif(left(trim(p_notes), 1000), ''),
    nullif(left(trim(p_visit_address), 300), ''), coalesce(p_price_cents, v_service.price_cents)
  )
  returning id into v_booking_id;
  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accès temporaire des secours (M9-04)
-- ---------------------------------------------------------------------------

create table public.rescue_access (
  id uuid primary key default gen_random_uuid(),
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  label text not null default '' check (char_length(label) <= 120),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);

alter table public.rescue_access enable row level security;
create policy "rescue_access: admin" on public.rescue_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create trigger rescue_access_audit after insert or update or delete on public.rescue_access
  for each row execute function public.audit_row();

-- Vérifie un lien secours : direct de toutes les caméras du parc (lecture seule) et fiche secours.
create or replace function public.rescue_camera_access(p_token text)
returns table (mode text, expires_at timestamptz, rescue_info text, label text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_access public.rescue_access;
begin
  if coalesce(char_length(p_token), 0) <> 64 then
    return query select 'denied'::text, null::timestamptz, null::text, null::text;
    return;
  end if;
  select * into v_access from public.rescue_access ra
  where ra.token = p_token and ra.revoked_at is null and ra.expires_at > now();
  if not found then
    return query select 'denied'::text, null::timestamptz, null::text, null::text;
    return;
  end if;
  return query
    select 'rescue'::text, least(v_access.expires_at, now() + interval '10 minutes'),
           (select s.rescue_info from public.settings s), v_access.label;
end;
$$;

revoke execute on function public.admin_book_for_client(uuid, uuid, timestamptz, integer, text, text, integer) from public, anon, authenticated;
revoke execute on function public.rescue_camera_access(text) from public, anon, authenticated;
grant execute on function public.admin_book_for_client(uuid, uuid, timestamptz, integer, text, text, integer) to authenticated;
grant execute on function public.rescue_camera_access(text) to anon, authenticated;
