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

-- Règles fixées par FreePaws dans son cahier des charges (7 octobre 2026) :
--   coaching : adresse du domicile demandée, annulation et report en ligne jusqu'à 48 h avant ;
--   parc : créneaux de 60 min (45 min dans le parc + 15 min de battement), 5 chiens maximum,
--          annulation jusqu'à 48 h avant. Réservation fermée tant que le parc n'est pas ouvert.
-- Les tarifs, horaires et délais de réservation restent à définir par FreePaws (non renseignés).
update public.services set cancel_notice_hours = 48;
update public.services set requires_address = true
where slug in ('bilan-cohabitation', 'accompagnement-adoption', 'adoption-famille-atypique');

insert into public.services (
  id, slug, resource_id, mode, name, summary, description, location,
  duration_minutes, slot_step_minutes, buffer_minutes, max_dogs, cancel_notice_hours, booking_enabled, sort_order
) values (
  '00000000-0000-4000-b000-000000000001', 'park-session',
  '00000000-0000-4000-a000-000000000001', 'slot',
  'FreePaws Park',
  'Un lieu pensé pour que votre chien puisse enfin courir, jouer et se dépenser librement et en sécurité, entre Liège, Huy et Waremme.',
  'Un lieu pensé pour que votre chien puisse enfin courir, jouer et se dépenser librement et en sécurité, entre Liège, Huy et Waremme.',
  '',
  45, 60, 0, 5, 48, false, 10
)
on conflict (id) do nothing;

-- Traductions anglaises des textes du site (FR + EN au lancement), à faire valider par FreePaws.
update public.services set translations = jsonb_build_object('en', jsonb_build_object(
  'name', 'Home relationship assessment',
  'summary', 'I observe the dynamic between your family and your dog, and build a personalised action plan with you.',
  'description', E'2 hours, at home. I observe the dynamic between your child/family and your dog, identify the sources of tension, and build a personalised action plan with you.\n\nThe same approach as childhood and family professionals, applied to the child/family–dog relationship. This assessment is the starting point: together we look at what is really going on in your daily life with your dog, without judgement, to build a way forward that suits you.',
  'location', 'At home'))
where slug = 'bilan-cohabitation';
update public.services set translations = jsonb_build_object('en', jsonb_build_object(
  'name', 'Adoption support',
  'summary', 'Before adoption: choosing a dog suited to your family, preparing your home, introduction protocol. After adoption: 3-month follow-up.',
  'description', E'Before adoption: choosing a dog suited to your family, preparing your home, and an introduction protocol designed for a calm start.\n\nAfter adoption, a 3-month follow-up to adjust and consolidate the first weeks together — because the real questions often come once the dog is home, not before.'))
where slug = 'accompagnement-adoption';
update public.services set translations = jsonb_build_object('en', jsonb_build_object(
  'name', 'Adoption for families with specific needs',
  'summary', 'The same approach as standard support, with a choice of breed and a protocol designed around your child''s needs. 3-month follow-up included.',
  'description', E'The same approach as standard support, but with a choice of breed and an introduction protocol designed specifically around your child''s profile and needs.\n\n3-month follow-up included. This programme draws on fifteen years of supporting children with specific needs, combined with dog training — so that the dog becomes real support, not an extra source of stress.'))
where slug = 'adoption-famille-atypique';
update public.services set translations = jsonb_build_object('en', jsonb_build_object(
  'name', 'Group workshop “My child and my dog”',
  'summary', 'Group format, 1 to 4 families, 2 hours. Time to learn together and share with families in similar situations.',
  'description', E'Group format, 1 to 4 families, 2 hours. Time to learn together, share with families in similar situations, and observe the child–dog relationship in a supportive setting.\n\nIdeally held on private, fenced land where dogs can be present in complete safety.'))
where slug = 'atelier-collectif';
update public.services set translations = jsonb_build_object('en', jsonb_build_object(
  'summary', 'A place designed so your dog can finally run, play and burn off energy freely and safely, between Liège, Huy and Waremme.',
  'description', 'A place designed so your dog can finally run, play and burn off energy freely and safely, between Liège, Huy and Waremme.'))
where slug = 'park-session';
