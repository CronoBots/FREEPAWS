-- Notifications (M1-05, M6) : confirmation, report, annulation, rappel avant le rendez-vous,
-- alertes à l'administratrice.
--
-- Principe « outbox » : des triggers sur bookings écrivent dans public.notifications, dans la même
-- transaction que la réservation. L'Edge Function `send-notifications` (appelée chaque minute par
-- pg_cron, voir docs/NOTIFICATIONS.md) réclame les lignes dues, envoie les emails et les marque
-- envoyées. Une réservation annulée ou reportée retire son rappel non encore envoyé.

-- Langue des emails : celle choisie dans l'app.
alter table public.profiles
  add column language text not null default 'fr' check (language in ('fr', 'en'));

grant update (language) on public.profiles to authenticated;

alter table public.settings
  -- Adresse qui reçoit les alertes (nouvelle réservation, annulation, report). Null = aucune alerte.
  add column admin_email text check (admin_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Délai du rappel avant le rendez-vous.
  add column reminder_hours integer not null default 48 check (reminder_hours between 1 and 336);

create type public.notification_kind as enum (
  'booking_confirmed',
  'booking_rescheduled',
  'booking_cancelled',
  'booking_reminder',
  'admin_new_booking',
  'admin_booking_rescheduled',
  'admin_booking_cancelled'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind public.notification_kind not null,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  audience text not null check (audience in ('client', 'admin')),
  send_after timestamptz not null default now(),
  attempts integer not null default 0,
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index notifications_due_idx on public.notifications (send_after) where sent_at is null;
create index notifications_booking_idx on public.notifications (booking_id);

alter table public.notifications enable row level security;

create policy "notifications: lecture admin" on public.notifications
  for select to authenticated using (public.is_admin());

-- Programme le rappel d'une réservation (rien si le rendez-vous est trop proche).
create or replace function public.schedule_booking_reminder(p_booking_id uuid, p_starts_at timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_send_after timestamptz;
begin
  select p_starts_at - make_interval(hours => s.reminder_hours) into v_send_after from public.settings s;
  if v_send_after > now() then
    insert into public.notifications (kind, booking_id, audience, send_after)
    values ('booking_reminder', p_booking_id, 'client', v_send_after);
  end if;
end;
$$;

create or replace function public.bookings_enqueue_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz;
  -- Pas d'alerte à l'administratrice pour ses propres actions, ni sans adresse configurée.
  v_alert_admin boolean := not public.is_admin()
    and exists (select 1 from public.settings where admin_email is not null);
begin
  select lower(a.period) into v_starts_at from public.appointments a where a.id = new.appointment_id;

  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then
      insert into public.notifications (kind, booking_id, audience) values ('booking_confirmed', new.id, 'client');
      if v_alert_admin then
        insert into public.notifications (kind, booking_id, audience) values ('admin_new_booking', new.id, 'admin');
      end if;
      perform public.schedule_booking_reminder(new.id, v_starts_at);
    end if;

  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    delete from public.notifications where booking_id = new.id and kind = 'booking_reminder' and sent_at is null;
    insert into public.notifications (kind, booking_id, audience) values ('booking_cancelled', new.id, 'client');
    if v_alert_admin then
      insert into public.notifications (kind, booking_id, audience) values ('admin_booking_cancelled', new.id, 'admin');
    end if;

  elsif new.status = 'confirmed' and new.appointment_id <> old.appointment_id then
    delete from public.notifications where booking_id = new.id and kind = 'booking_reminder' and sent_at is null;
    insert into public.notifications (kind, booking_id, audience) values ('booking_rescheduled', new.id, 'client');
    if v_alert_admin then
      insert into public.notifications (kind, booking_id, audience) values ('admin_booking_rescheduled', new.id, 'admin');
    end if;
    perform public.schedule_booking_reminder(new.id, v_starts_at);
  end if;

  return null;
end;
$$;

create trigger bookings_enqueue_notifications
  after insert or update of status, appointment_id on public.bookings
  for each row execute function public.bookings_enqueue_notifications();

-- Réservé à l'Edge Function (service_role) : réclame les notifications dues, sans doublon entre
-- deux exécutions concurrentes (verrou de 5 minutes, 5 tentatives au plus).
create or replace function public.claim_notifications(p_limit integer default 25)
returns setof public.notifications
language sql
volatile
security definer
set search_path = ''
as $$
  update public.notifications n
  set attempts = n.attempts + 1, locked_until = now() + interval '5 minutes'
  where n.id in (
    select id from public.notifications
    where sent_at is null
      and send_after <= now()
      and attempts < 5
      and (locked_until is null or locked_until < now())
    order by send_after
    limit p_limit
    for update skip locked
  )
  returning n.*;
$$;

revoke execute on function public.schedule_booking_reminder(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.bookings_enqueue_notifications() from public, anon, authenticated;
revoke execute on function public.claim_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
