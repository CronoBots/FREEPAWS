-- Outils d'administration : fermeture exceptionnelle en une action, flux d'agenda (iCal).

-- Jeton secret du flux iCal (abonnement depuis Google Agenda, Apple Calendrier, Outlook).
alter table public.settings
  add column calendar_token text not null default replace(gen_random_uuid()::text, '-', '');

-- Fermeture exceptionnelle (M3-08) : bloque une période et, si demandé, annule en une action
-- tous les rendez-vous qui la chevauchent (les réservations sont annulées par cascade).
create or replace function public.close_period(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text default '',
  p_cancel_existing boolean default false
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cancelled integer := 0;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;

  insert into public.blackouts (resource_id, period, reason)
  values (p_resource_id, tstzrange(p_starts_at, p_ends_at), left(coalesce(p_reason, ''), 200));

  if p_cancel_existing then
    with cancelled as (
      update public.appointments
      set status = 'cancelled'
      where resource_id = p_resource_id
        and status = 'scheduled'
        and period && tstzrange(p_starts_at, p_ends_at)
      returning id
    )
    select count(*) into v_cancelled from cancelled;
  end if;

  return v_cancelled;
end;
$$;

-- Nombre de rendez-vous qu'une fermeture toucherait (aperçu avant confirmation).
create or replace function public.count_appointments_in_period(
  p_resource_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_admin() then (
    select count(*)::integer from public.appointments
    where resource_id = p_resource_id and status = 'scheduled'
      and period && tstzrange(p_starts_at, p_ends_at)
  ) else 0 end;
$$;

revoke execute on function public.close_period(uuid, timestamptz, timestamptz, text, boolean) from public, anon;
revoke execute on function public.count_appointments_in_period(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.close_period(uuid, timestamptz, timestamptz, text, boolean) to authenticated;
grant execute on function public.count_appointments_in_period(uuid, timestamptz, timestamptz) to authenticated;
