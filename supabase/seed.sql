-- Données de départ : uniquement les informations publiées sur www.freepaws.be.
--
-- Rien n'est inventé : pas d'horaires, pas de tarifs, pas de durée quand le site n'en donne pas.
-- Tant que FreePaws n'a pas fixé horaires, durées et règles d'annulation, la réservation en ligne
-- reste fermée (booking_enabled = false) et l'app propose « Prendre rendez-vous » par email,
-- comme le site. Le parc est « pas encore ouvert » (is_open = false), comme indiqué sur le site.

insert into public.resources (id, slug, name, is_open) values
  ('00000000-0000-4000-a000-000000000001', 'park', 'FreePaws Park', false),
  ('00000000-0000-4000-a000-000000000002', 'coach', 'Coaching FreePaws', false)
on conflict (id) do nothing;

-- Textes repris de coaching.html et des pages de chaque offre.
insert into public.services (
  id, slug, resource_id, mode, name, summary, description, location,
  duration_minutes, default_capacity, booking_enabled, sort_order
) values
  (
    '00000000-0000-4000-b000-000000000002', 'bilan-cohabitation',
    '00000000-0000-4000-a000-000000000002', 'slot',
    'Bilan cohabitation',
    'J''observe la dynamique entre votre famille et votre chien, et je construis avec vous un plan d''action personnalisé.',
    E'2h, à domicile. J''observe la dynamique entre votre enfant/famille et votre chien, j''identifie les sources de tension, et je construis avec vous un plan d''action personnalisé.\n\nLa même approche que celle des professionnels de l''enfance ou de la famille, appliquée à la relation enfant/famille-chien. Ce bilan est le point de départ : on regarde ensemble ce qui se joue vraiment dans votre quotidien avec votre chien, sans jugement, pour construire une suite qui vous correspond.',
    'À domicile',
    120, 1, false, 20
  ),
  (
    '00000000-0000-4000-b000-000000000003', 'accompagnement-adoption',
    '00000000-0000-4000-a000-000000000002', 'slot',
    'Accompagnement adoption',
    'Avant l''adoption : choix d''un chien adapté au profil de votre famille, préparation du logement, protocole d''introduction. Après l''adoption : suivi sur 3 mois.',
    E'Avant l''adoption : choix d''un chien adapté au profil de votre famille, préparation du logement, protocole d''introduction pensé pour un début serein.\n\nAprès l''adoption, un suivi sur 3 mois pour ajuster et consolider les premières semaines de vie commune — parce que les vraies questions arrivent souvent une fois le chien à la maison, pas avant.',
    '',
    null, 1, false, 30
  ),
  (
    '00000000-0000-4000-b000-000000000004', 'adoption-famille-atypique',
    '00000000-0000-4000-a000-000000000002', 'slot',
    'Adoption, famille atypique',
    'La même approche que l''accompagnement classique, avec un choix de race et un protocole pensés selon les besoins de votre enfant. Suivi sur 3 mois inclus.',
    E'La même approche que l''accompagnement classique, mais avec un choix de race et un protocole d''introduction pensés spécifiquement en fonction du profil et des besoins de votre enfant.\n\nSuivi sur 3 mois inclus. Ce parcours s''appuie sur quinze ans d''accompagnement de l''enfant à besoins particuliers, combinés à une formation canine — pour que le chien devienne un vrai soutien, pas une source de stress supplémentaire.',
    '',
    null, 1, false, 40
  ),
  (
    '00000000-0000-4000-b000-000000000005', 'atelier-collectif',
    '00000000-0000-4000-a000-000000000002', 'event',
    'Atelier collectif « Mon enfant et mon chien »',
    'Format groupe, 1 à 4 familles, 2h. Un temps pour apprendre ensemble et échanger entre familles qui vivent des situations similaires.',
    E'Format groupe, 1 à 4 familles, 2h. Un temps collectif pour apprendre ensemble, échanger entre familles qui vivent des situations similaires, et observer la relation enfant-chien dans un cadre bienveillant.\n\nIdéalement organisé dans un terrain privé et clôturé où les chiens peuvent être présents en toute sécurité.',
    '',
    120, 4, false, 50
  )
on conflict (id) do nothing;
