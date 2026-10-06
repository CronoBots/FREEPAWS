-- Données de départ : catalogue FreePaws et horaires d'exemple.
-- Les tarifs, horaires et durées marqués « à confirmer » doivent être validés avant la mise en ligne.

insert into public.resources (id, slug, name) values
  ('00000000-0000-4000-a000-000000000001', 'park', 'FreePaws Park'),
  ('00000000-0000-4000-a000-000000000002', 'coach', 'Coaching FreePaws')
on conflict (id) do nothing;

insert into public.services (
  id, slug, resource_id, mode, name, summary, description, location,
  duration_minutes, slot_step_minutes, buffer_minutes, default_capacity,
  price_cents, min_notice_hours, max_advance_days, cancel_notice_hours, sort_order
) values
  (
    '00000000-0000-4000-b000-000000000001', 'park-session',
    '00000000-0000-4000-a000-000000000001', 'slot',
    'Session privative au parc',
    'Le parc rien que pour vous : votre chien court librement, en sécurité.',
    'Un terrain clôturé réservé à votre seule famille pendant le créneau. Pendant votre session, la caméra devient privée : vous pouvez garder un œil sur votre chien, utile si le rappel n''est pas encore acquis.',
    'FreePaws Park — axe Liège–Huy–Waremme',
    60, 60, 0, 1,
    null, 1, 30, 12, 10
  ),
  (
    '00000000-0000-4000-b000-000000000002', 'bilan-cohabitation',
    '00000000-0000-4000-a000-000000000002', 'slot',
    'Bilan cohabitation',
    '2h à domicile : observation de la dynamique famille-chien et plan d''action personnalisé.',
    'J''observe la dynamique entre votre enfant/famille et votre chien, j''identifie les sources de tension, et je construis avec vous un plan d''action personnalisé. Sans jugement, pour construire une suite qui vous correspond.',
    'À domicile',
    120, 30, 30, 1,
    null, 48, 60, 48, 20
  ),
  (
    '00000000-0000-4000-b000-000000000003', 'accompagnement-adoption',
    '00000000-0000-4000-a000-000000000002', 'slot',
    'Accompagnement adoption',
    'Avant l''adoption : choix du chien, préparation du logement, protocole d''introduction. Suivi 3 mois.',
    'Avant l''adoption : choix d''un chien adapté au profil de votre famille, préparation du logement, protocole d''introduction pensé pour un début serein. Après l''adoption, un suivi sur 3 mois pour ajuster et consolider les premières semaines de vie commune.',
    'À domicile',
    90, 30, 30, 1,
    null, 48, 60, 48, 30
  ),
  (
    '00000000-0000-4000-b000-000000000004', 'adoption-famille-atypique',
    '00000000-0000-4000-a000-000000000002', 'slot',
    'Adoption, famille atypique',
    'L''accompagnement adoption, pensé selon les besoins de votre enfant. Suivi 3 mois inclus.',
    'La même approche que l''accompagnement classique, avec un choix de race et un protocole d''introduction pensés spécifiquement en fonction du profil et des besoins de votre enfant. Suivi sur 3 mois inclus.',
    'À domicile',
    90, 30, 30, 1,
    null, 48, 60, 48, 40
  ),
  (
    '00000000-0000-4000-b000-000000000005', 'atelier-collectif',
    '00000000-0000-4000-a000-000000000002', 'event',
    'Atelier « Mon enfant et mon chien »',
    'Format groupe, 1 à 4 familles, 2h. Apprendre ensemble et échanger.',
    'Un temps collectif pour apprendre ensemble, échanger entre familles qui vivent des situations similaires, et observer la relation enfant-chien dans un cadre bienveillant.',
    'FreePaws Park',
    120, 30, 0, 4,
    null, 24, 90, 48, 50
  )
on conflict (id) do nothing;

-- Horaires d'exemple (à confirmer).
-- Parc : tous les jours 8h–20h.
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000001', d, '08:00', '20:00', date '2026-01-01'
from generate_series(1, 7) as d
where not exists (select 1 from public.availability_rules where resource_id = '00000000-0000-4000-a000-000000000001');

-- Coaching : lundi–vendredi 9h–12h et 13h30–18h, samedi 9h–12h.
insert into public.availability_rules (resource_id, weekday, start_time, end_time, valid_from)
select '00000000-0000-4000-a000-000000000002', w.d, w.s::time, w.e::time, date '2026-01-01'
from (
  select d, '09:00' as s, '12:00' as e from generate_series(1, 6) as d
  union all
  select d, '13:30', '18:00' from generate_series(1, 5) as d
) as w
where not exists (select 1 from public.availability_rules where resource_id = '00000000-0000-4000-a000-000000000002');

insert into public.cameras (resource_id, name, stream_path, sort_order)
select '00000000-0000-4000-a000-000000000001', 'Vue d''ensemble', 'park/main', 10
where not exists (select 1 from public.cameras);
