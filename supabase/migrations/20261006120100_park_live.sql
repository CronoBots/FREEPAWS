-- FreePaws Park — statut en direct et accès caméra « à deux temps ».
--
--   Parc libre    : le direct est public (disponibilité, état du terrain avant de se déplacer).
--   Parc réservé  : le direct devient privé ; seul le client qui a réservé le créneau en cours
--                   (et l'admin, en cas d'incident) peut le regarder.
--   Parc fermé    : hors horaires ou période bloquée ; pas de direct public.
--   Pas ouvert    : le parc n'existe pas encore (resources.is_open = false) ; pas de direct.
--
-- L'app n'obtient jamais d'URL de flux permanente : l'Edge Function `live-stream` appelle
-- camera_access() avec le jeton de l'utilisateur, puis signe des URLs à durée de vie courte.

create table public.cameras (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- Chemin du flux sur le serveur vidéo (ex. « park/entree »), jamais exposé tel quel.
  stream_path text not null check (stream_path ~ '^[a-z0-9][a-z0-9/_-]{0,120}$'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index cameras_resource_idx on public.cameras (resource_id);

alter table public.cameras enable row level security;

create policy "cameras: admin" on public.cameras
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Statut d'une ressource à l'instant présent. Ne révèle aucune donnée personnelle.
--   status : 'free' | 'reserved' | 'closed' | 'not_open'
--   until  : fin de l'état courant si connue (fin du créneau, prochaine réservation, fermeture)
create or replace function public.get_resource_status(p_resource_slug text)
returns table (status text, until timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Europe/Brussels';
  v_resource_id uuid;
  v_now timestamptz := now();
  v_local timestamp := now() at time zone 'Europe/Brussels';
  v_window_end timestamptz;
  v_end timestamptz;
  v_next_booking timestamptz;
  v_next_blackout timestamptz;
  v_is_open boolean;
begin
  select id, is_open into v_resource_id, v_is_open from public.resources where slug = p_resource_slug;
  if not found then
    raise exception 'resource_not_found' using errcode = 'P0001';
  end if;
  if not v_is_open then
    return query select 'not_open'::text, null::timestamptz;
    return;
  end if;

  select upper(a.period) into v_end
  from public.appointments a
  where a.resource_id = v_resource_id and a.status = 'scheduled' and a.period @> v_now
  order by upper(a.period) desc
  limit 1;
  if found then
    return query select 'reserved'::text, v_end;
    return;
  end if;

  select upper(b.period) into v_end
  from public.blackouts b
  where b.resource_id = v_resource_id and b.period @> v_now
  order by upper(b.period) desc
  limit 1;
  if found then
    return query select 'closed'::text, v_end;
    return;
  end if;

  select max((v_local::date + r.end_time) at time zone v_tz) into v_window_end
  from public.availability_rules r
  where r.resource_id = v_resource_id
    and r.weekday = extract(isodow from v_local)
    and v_local::date >= r.valid_from
    and (r.valid_until is null or v_local::date <= r.valid_until)
    and v_local::time >= r.start_time
    and v_local::time < r.end_time;

  if v_window_end is null then
    return query select 'closed'::text, null::timestamptz;
    return;
  end if;

  select min(lower(a.period)) into v_next_booking
  from public.appointments a
  where a.resource_id = v_resource_id
    and a.status = 'scheduled'
    and lower(a.period) > v_now
    and lower(a.period) < v_window_end;

  select min(lower(b.period)) into v_next_blackout
  from public.blackouts b
  where b.resource_id = v_resource_id
    and lower(b.period) > v_now
    and lower(b.period) < v_window_end;

  return query select 'free'::text, least(coalesce(v_next_booking, v_window_end), coalesce(v_next_blackout, v_window_end));
end;
$$;

-- Décide si l'appelant peut voir le direct maintenant.
--   mode : 'public' (parc libre), 'private' (client du créneau en cours), 'admin', 'denied'
--   expires_at : jusqu'à quand cette décision reste valable (borne la durée des URLs signées)
create or replace function public.camera_access(p_resource_slug text)
returns table (mode text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_until timestamptz;
  v_max constant interval := interval '10 minutes';
begin
  select s.status, s.until into v_status, v_until from public.get_resource_status(p_resource_slug) s;

  if v_uid is not null and public.is_admin() then
    return query select 'admin'::text, now() + v_max;
    return;
  end if;

  if v_status = 'free' then
    return query select 'public'::text, least(coalesce(v_until, now() + v_max), now() + v_max);
    return;
  end if;

  if v_status = 'reserved' and v_uid is not null and exists (
    select 1
    from public.appointments a
    join public.resources r on r.id = a.resource_id
    join public.bookings b on b.appointment_id = a.id
    where r.slug = p_resource_slug
      and a.status = 'scheduled'
      and a.period @> now()
      and b.client_id = v_uid
      and b.status = 'confirmed'
  ) then
    return query select 'private'::text, least(v_until, now() + v_max);
    return;
  end if;

  return query select 'denied'::text, null::timestamptz;
end;
$$;

revoke execute on function public.get_resource_status(text) from public;
revoke execute on function public.camera_access(text) from public;
grant execute on function public.get_resource_status(text) to anon, authenticated;
grant execute on function public.camera_access(text) to anon, authenticated;
