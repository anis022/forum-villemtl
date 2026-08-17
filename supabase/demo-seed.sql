-- Une communauté de démonstration : vingt résidents, les quatre élus de
-- l'arrondissement, trente signalements et la discussion qui va avec.
--
--   npm run migrate -- supabase/demo-seed.sql
--
-- Pourquoi ce fichier existe : une page de forum vide ne se juge pas. On ne
-- voit ni le classement par appuis, ni la pile de visages, ni ce que devient
-- une carte avec trente épingles dessus, ni à quoi ressemble un fil où un élu
-- a répondu — ni, surtout, ce qui arrive quand une réponse à une réponse à une
-- réponse finit par avoir plus de marge que de texte. Il faut du monde dedans
-- pour que les écrans disent quelque chose.
--
-- Les résidents ne sont PAS de vraies personnes. Les noms sont inventés, les
-- adresses sont en @exemple.test (TLD réservé, rien n'est livrable), et chaque
-- compte porte raw_app_meta_data->>'seed' = 'villemtl-demo'. C'est cette
-- marque, et non l'adresse, qui sert au ménage :
--
--   delete from auth.users where raw_app_meta_data->>'seed' = 'villemtl-demo';
--
-- Tout le reste part en cascade : profils, signalements, commentaires, appuis.
-- Le fichier commence d'ailleurs par exactement cette ligne, donc le rejouer
-- remplace la communauté au lieu de la doubler.
--
-- LES ÉLUS, EUX, EXISTENT. Ce sont les quatre personnes de utils/officials.ts,
-- celles qui siègent réellement au conseil d'arrondissement de
-- Côte-des-Neiges–Notre-Dame-de-Grâce, avec leurs vrais noms et leurs vrais
-- portraits. Aucune d'elles n'a écrit une ligne de ce fichier. Les réponses
-- qu'on leur prête ici sont écrites par nous, pour une démonstration : c'est de
-- la mise en situation, au même titre que les trente signalements inventés
-- au-dessus desquels elles apparaissent. Leurs adresses le disent —
-- demo.moroz@montreal.ca n'est l'adresse de personne — mais l'adresse n'est pas
-- visible à l'écran, alors il faut le dire ici, en clair, et le redire à
-- quiconque met ces données ailleurs que sur un site de démonstration.
-- (Le domaine doit rester @montreal.ca : c'est de là que le rôle « élu » est
-- dérivé, migration 0003, et il ne s'écrit pas à la main.)
--
-- Aucun de ces comptes n'a de mot de passe, parce que le site n'en utilise
-- plus : on se connecte avec un code à six chiffres reçu par courriel, et rien
-- de secret n'est gardé en base. Ces comptes-ci ne sont donc pas ouvrables —
-- @exemple.test ne reçoit rien, par construction. Pour visiter le site en tant
-- que résident, créez un compte avec votre propre adresse ; pour entrer dans
-- l'un de ceux-là, passez par le tableau de bord Supabase, qui sait générer un
-- lien de connexion pour n'importe quelle adresse sans avoir à en recevoir le
-- courriel.
--
-- Les identifiants sont dérivés des clés textuelles (uuid v5), pas tirés au
-- hasard : deux exécutions produisent les mêmes lignes, donc les couleurs
-- d'avatar et les liens de profil ne bougent pas d'une fois à l'autre. C'est
-- aussi ce qui permet à utils/officials.ts de connaître d'avance l'identifiant
-- de compte de chaque élu, sans aller le chercher.

-- Efface la fournée précédente, s'il y en a une.
delete from auth.users where raw_app_meta_data ->> 'seed' = 'villemtl-demo';
-- Et les adhésions inventées qui allaient avec. Le drapeau `seeded` de la
-- migration 0025 est ce qui distingue ces lignes-là de l'export réel, aussi
-- bien ici que dans `npm run members`, qui les laisse tranquilles.
delete from public.members where seeded;
delete from public.staff where seeded;

create or replace function pg_temp.demo_id(key text) returns uuid
language sql immutable as $$
  select extensions.uuid_generate_v5(
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'villemtl-demo:' || key
  )
$$;


-- 1. Les gens ----------------------------------------------------------------
--
-- Vingt résidents et les quatre élus. Le mélange de noms est celui du
-- quartier : CDN-NDG est l'un des arrondissements les plus divers de la ville
-- et le forum ne ressemblerait à rien avec vingt Tremblay dedans.
--
-- Les dates d'inscription sont étalées sur quatorze mois. Vingt profils créés
-- le même jour ne ressemblent pas à une communauté, ils ressemblent à un
-- import. Chacune précède la première contribution de la personne : rien n'a
-- l'air plus faux qu'un « membre depuis 3 semaines » sous un commentaire vieux
-- de deux mois.

create temporary table demo_people (
  key text primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  joined_days int not null,
  -- Élue ou élu : porte une adresse @montreal.ca, donc le déclencheur de la
  -- migration 0003 lui donnera le rôle 'official', et son portrait sert d'avatar.
  official boolean not null default false
) on commit drop;

insert into demo_people (key, first_name, last_name, email, joined_days) values
  ('tremblay',    'Marie-Claude', 'Tremblay',     'marie-claude.tremblay@exemple.test',  412),
  ('belkacem',    'Ahmed',        'Belkacem',     'ahmed.belkacem@exemple.test',         389),
  ('fournier',    'Rosalie',      'Fournier',     'rosalie.fournier@exemple.test',       356),
  ('wexler',      'Jonathan',     'Wexler',       'jonathan.wexler@exemple.test',        341),
  ('haddad',      'Farah',        'Haddad',       'farah.haddad@exemple.test',           318),
  ('okonkwo',     'Daniel',       'Okonkwo',      'daniel.okonkwo@exemple.test',         295),
  ('gauthier',    'Mylène',       'Gauthier',     'mylene.gauthier@exemple.test',        274),
  ('shaw',        'Alison',       'Shaw',         'alison.shaw@exemple.test',            265),
  ('sundaram',    'Ravi',         'Sundaram',     'ravi.sundaram@exemple.test',          251),
  ('jeanbaptiste','Claudette',    'Jean-Baptiste','claudette.jean-baptiste@exemple.test',233),
  ('lavoie',      'Simon',        'Lavoie',       'simon.lavoie@exemple.test',           208),
  ('mendoza',     'Grace',        'Mendoza',      'grace.mendoza@exemple.test',          186),
  ('elamrani',    'Youssef',      'El Amrani',    'youssef.elamrani@exemple.test',       164),
  ('bergeron',    'Léa',          'Bergeron',     'lea.bergeron@exemple.test',           141),
  ('nguyen',      'Thanh',        'Nguyen',       'thanh.nguyen@exemple.test',           119),
  ('oconnell',    'Patrick',      'O''Connell',   'patrick.oconnell@exemple.test',        98),
  ('whitfield',   'Emma',         'Whitfield',    'emma.whitfield@exemple.test',          85),
  ('kohn',        'Samuel',       'Kohn',         'samuel.kohn@exemple.test',             79),
  ('petrescu',    'Nadia',        'Petrescu',     'nadia.petrescu@exemple.test',          76),
  ('riveros',     'Carlos',       'Riveros',      'carlos.riveros@exemple.test',          54);

-- Les élus. La clé est le slug de utils/officials.ts, et c'est ce qui relie les
-- deux fichiers : le portrait est public/elus/<slug>.jpg, le profil est
-- /profil/<slug>, et l'identifiant de compte est uuid_v5('user:' || slug).
insert into demo_people (key, first_name, last_name, email, joined_days, official) values
  ('valenzuela',  'Stéphanie',    'Valenzuela',   'demo.valenzuela@montreal.ca',         430, true),
  ('thiagarajah', 'Milany',       'Thiagarajah',  'demo.thiagarajah@montreal.ca',        428, true),
  ('teodoresco',  'Alexandre',    'Teodoresco',   'demo.teodoresco@montreal.ca',         428, true),
  ('moroz',       'Sonny',        'Moroz',        'demo.moroz@montreal.ca',              425, true);

-- Le forum est réservé aux membres depuis la migration 0025 : un compte ne se
-- crée que pour une adresse inscrite au registre, et les vingt résidents
-- d'ici n'y sont pas — sans ces lignes, l'insertion ci-dessous échoue au
-- premier d'entre eux. On les inscrit donc, marqués `seeded` pour que le
-- chargement de l'export réel ne les emporte pas et pour que la ligne de ménage
-- en haut du fichier sache lesquelles reprendre.
--
--
-- Adhésion prise le jour de l'inscription du compte et valable deux ans, donc
-- courante pour tout le monde : ce fichier sert à remplir un forum, et une
-- moitié de la communauté muette pour cause d'adhésion échue ne montrerait
-- aucun des écrans qu'on cherche à voir.
insert into public.members (email, first_name, last_name, district, joined_on, expires_on, seeded)
select
  p.email,
  p.first_name,
  p.last_name,
  'Côte-des-Neiges',
  (now() - (p.joined_days || ' days')::interval)::date,
  (now() - (p.joined_days || ' days')::interval + interval '2 years')::date,
  true
from demo_people p
where not p.official;

-- Et les quatre élus au tableau du cabinet, migration 0026. Le domaine
-- @montreal.ca ne suffit plus : depuis cette migration seules les neuf adresses
-- nommées ouvrent la porte, et demo.valenzuela@montreal.ca n'en fait pas
-- partie — c'est justement une adresse qui n'est celle de personne. Marquées
-- `seeded`, avec elected à vrai : ce sont bien les quatre personnes qui siègent
-- au conseil d'arrondissement qu'on met en situation ici.
insert into public.staff (email, first_name, last_name, elected, seeded)
select p.email, p.first_name, p.last_name, true, true
from demo_people p
where p.official;

-- Les colonnes de jetons sont mises à '' plutôt que laissées nulles : GoTrue les
-- lit comme des chaînes et une valeur nulle fait échouer la connexion avec une
-- erreur de conversion qui ne pointe vers rien de compréhensible.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  pg_temp.demo_id('user:' || p.key),
  'authenticated',
  'authenticated',
  p.email,
  -- Sans mot de passe, comme tout compte créé par ce site. La colonne accepte
  -- NULL et GoTrue traite ces comptes comme des comptes par code : c'est l'état
  -- normal ici, pas une donnée manquante.
  null,
  now() - (p.joined_days || ' days')::interval,
  jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'seed', 'villemtl-demo'
  ),
  jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name),
  now() - (p.joined_days || ' days')::interval,
  now() - (p.joined_days || ' days')::interval,
  '', '', '', ''
from demo_people p;

-- Sans ligne d'identité, GoTrue ne reconnaît pas l'adresse comme appartenant au
-- compte, et l'envoi d'un code échoue avant même de partir.
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.created_at, u.created_at, u.created_at
from auth.users u
where u.raw_app_meta_data ->> 'seed' = 'villemtl-demo';

-- Le profil est créé par le déclencheur on_auth_user_created, avec created_at à
-- maintenant. La page profil affiche « membre depuis », alors on la réajuste sur
-- la date d'inscription réelle du compte.
update public.profiles p
   set created_at = u.created_at
  from auth.users u
 where u.id = p.id
   and u.raw_app_meta_data ->> 'seed' = 'villemtl-demo';

-- Le portrait des élus, le même que celui de la page /elus. Un fil où l'élue
-- répond avec des initiales sur fond coloré pendant que la page d'à côté montre
-- sa photo n'a pas l'air du même site.
update public.profiles p
   set avatar_url = '/elus/' || d.key || '.jpg'
  from demo_people d
 where p.id = pg_temp.demo_id('user:' || d.key)
   and d.official;


-- 2. Les signalements --------------------------------------------------------
--
-- Trente rapports étalés sur onze semaines, tous localisés dans CDN-NDG et
-- répartis sur les cinq districts, pour que la carte soit couverte plutôt que
-- groupée sur un coin. Les coordonnées tiennent dans BOROUGH_BOUNDS
-- (utils/map.ts) : hors de cette boîte, le formulaire refuserait l'épingle et
-- la carte les afficherait à l'extérieur du tracé.
--
-- Un tiers est écrit en anglais. Ce n'est pas de la décoration : NDG est
-- massivement anglophone, la moitié d'une assemblée de quartier s'y tient dans
-- les deux langues, et un forum qui n'aurait que du français dessus ne
-- montrerait ni le bouton « Traduire » ni ce qu'il sert à faire.
--
-- `photo` pointe vers public/demo/ plutôt que vers le seau de stockage :
-- personne ne se connecte comme ces résidents pour téléverser quoi que ce soit,
-- et un jeu de démonstration qui suppose un seau rempli à la main ne fonctionne
-- que sur une machine. Les photos sont réelles et montrent la chose décrite —
-- provenance et licences dans public/demo/CREDITS.md.
--
-- La colonne `appuis` n'est pas écrite dans issues.vote_count : c'est une cible
-- pour la section 5, et le compteur est tenu par le déclencheur.

create temporary table demo_issues (
  key text primary key,
  author text not null,
  title text not null,
  body text not null,
  category text not null,
  days_ago numeric not null,
  lat double precision,
  lon double precision,
  appuis int not null,
  final_status text,
  photo text
) on commit drop;

insert into demo_issues values
  ('van-horne', 'tremblay',
   'Nids-de-poule sur Van Horne, entre Victoria et Décarie',
   'Le tronçon est devenu impraticable depuis le dégel. Il y a au moins six trous profonds sur 400 mètres, et les autobus doivent déborder sur la voie de gauche pour les éviter. J''ai vu deux cyclistes se faire surprendre la semaine dernière. Ce n''est plus une question de confort, c''est une question de sécurité.',
   'voirie', 74, 45.4995, -73.6390, 18, null, '/demo/van-horne.jpg'),

  ('bac-kent', 'belkacem',
   'Le bac de recyclage du parc Kent déborde chaque fin de semaine',
   'Tous les samedis après-midi, le bac est plein et le reste déborde au sol. Le lundi matin il y a du carton mouillé partout dans l''allée. Une collecte de plus le vendredi réglerait probablement le problème, ou simplement un deuxième bac à côté.',
   'proprete', 70, 45.4975, -73.6285, 11, 'resolved', '/demo/bac-kent.jpg'),

  ('traverse-ecole', 'fournier',
   'Traverse piétonne dangereuse devant l''école Saint-Pascal-Baylon',
   'Le matin, les voitures tournent à droite sans ralentir pendant que les enfants traversent. Le brigadier fait ce qu''il peut mais il est seul pour deux coins de rue. Une avancée de trottoir ou un feu pour piétons changerait tout. J''ai deux enfants qui font ce trajet chaque jour et je retiens mon souffle chaque fois.',
   'securite', 68, 45.4960, -73.6255, 17, null, '/demo/traverse-ecole.jpg'),

  ('bus-165', 'wexler',
   'The 165 keeps passing us by at rush hour',
   'Three mornings out of five the bus arrives full and doesn''t stop at Côte-Sainte-Catherine. We wait for the next one, which is also full. In practice that adds twenty minutes to a fifteen-minute trip. The line needs extra departures between 7:30 and 9:00, not a nicer shelter.',
   'transport', 65, 45.4995, -73.6215, 15, null, null),

  ('jeux-eau-mlk', 'haddad',
   'Les jeux d''eau du parc Martin-Luther-King sont fermés depuis juin',
   'Aucune affiche n''explique pourquoi, et aucune date de réouverture n''est donnée. C''est le seul point d''eau du secteur et il fait 30 degrés. Les familles arrivent avec les enfants et repartent. Une simple affiche avec un échéancier serait déjà mieux que rien.',
   'parcs', 61, 45.5039, -73.6320, 16, 'resolved', '/demo/jeux-eau-mlk.jpg'),

  ('barclay-renovictions', 'okonkwo',
   'Rénovictions sur la rue Barclay : cinq logements vides en un an',
   'Le même propriétaire a repris cinq appartements dans deux immeubles voisins, chaque fois pour des travaux majeurs, chaque fois reloués bien plus cher quelques mois plus tard. Les locataires partis étaient des familles installées depuis dix ans. Je voudrais savoir si l''arrondissement suit ces dossiers et ce qui peut être fait.',
   'logement', 58, 45.5010, -73.6360, 14, null, null),

  ('trottoir-snowdon', 'gauthier',
   'Trottoir défoncé à la sortie du métro Snowdon',
   'La dalle est soulevée d''une bonne dizaine de centimètres juste devant la sortie nord. Avec une marchette ou une poussette c''est infranchissable, il faut descendre dans la rue pour contourner. Une voisine de 80 ans est tombée là le mois dernier.',
   'voirie', 55, 45.4845, -73.6320, 13, 'resolved', null),

  ('depot-ruelle-somerled', 'sundaram',
   'Dépôt sauvage de meubles dans la ruelle entre Somerled et Terrebonne',
   'Un divan, deux matelas et un frigo sont là depuis trois semaines. Le frigo a encore sa porte, ce qui est dangereux avec des enfants dans la ruelle. Les collectes d''encombrants passent, mais rien n''est ramassé parce que c''est dans la ruelle et non en bordure de rue.',
   'proprete', 52, 45.4680, -73.6285, 9, null, '/demo/depot-ruelle-somerled.jpg'),

  ('lampadaire-fielding', 'jeanbaptiste',
   'Lampadaire éteint depuis trois semaines au coin Fielding et Cavendish',
   'Le coin est complètement noir à partir de 20 h. C''est un arrêt d''autobus et il y a beaucoup de gens qui rentrent tard du travail. J''ai signalé par le 311 il y a trois semaines, j''ai un numéro de requête, et rien n''a bougé.',
   'securite', 49, 45.4645, -73.6470, 12, 'resolved', '/demo/lampadaire-fielding.jpg'),

  ('piste-csc', 'lavoie',
   'La piste cyclable de Côte-Sainte-Catherine se termine dans le vide',
   'La voie protégée s''arrête net avant l''intersection et on se retrouve à devoir s''insérer dans trois voies de circulation sans aucune transition. C''est le point le plus stressant de mon trajet quotidien, et je vois régulièrement des cyclistes moins à l''aise finir sur le trottoir.',
   'transport', 46, 45.4990, -73.6280, 14, null, '/demo/piste-csc.jpg'),

  ('basket-confederation', 'mendoza',
   'No nets on the basketball court at Confederation Park',
   'Both hoops have been bare since the start of the summer. The kids play anyway, but this is a forty-dollar replacement that would put the court back in working order. The surface itself is fine.',
   'parcs', 44, 45.4728, -73.6414, 8, 'resolved', '/demo/basket-confederation.jpg'),

  ('fontaine-ndg', 'elamrani',
   'Est-ce qu''on peut avoir une fontaine à eau au parc Notre-Dame-de-Grâce ?',
   'Le parc est grand et très fréquenté l''été, et il n''y a aucun point d''eau potable. Les gens ressortent acheter des bouteilles au dépanneur. Une fontaine avec remplissage de gourde, comme celle installée au parc Kent, serait un ajout simple et utile.',
   'general', 41, 45.4715, -73.6135, 10, null, '/demo/fontaine-ndg.jpg'),

  ('marquage-monkland', 'bergeron',
   'Marquage au sol effacé sur Monkland, les autos coupent le virage',
   'Les lignes ont disparu à l''intersection avec Old Orchard. Résultat, les voitures qui tournent à gauche coupent large et se retrouvent dans la voie inverse. C''est un secteur avec beaucoup de piétons à cause des terrasses.',
   'voirie', 38, 45.4682, -73.6260, 11, null, '/demo/marquage-monkland.jpg'),

  ('rats-lacombe', 'nguyen',
   'Rats dans la ruelle derrière l''avenue Lacombe',
   'On en voit maintenant en plein jour, ce qui n''était pas le cas l''an dernier. Le problème semble parti d''un immeuble où les sacs sont sortis plusieurs jours d''avance. Une visite d''inspection et un rappel aux propriétaires aideraient beaucoup.',
   'proprete', 35, 45.5030, -73.6220, 13, null, null),

  ('vitesse-somerled', 'oconnell',
   'Cars are doing 60 on Somerled all day long',
   'The limit is 40 and traffic is visibly doing 60. The street is straight and wide, which is an invitation to accelerate, and there are shops and children along the whole stretch. Speed humps or a narrowing halfway down would settle it.',
   'securite', 33, 45.4670, -73.6280, 15, null, null),

  ('velos-villa-maria', 'petrescu',
   'Manque de supports à vélos autour du métro Villa-Maria',
   'Les huit supports existants sont pleins dès 8 h. Le reste des vélos est attaché aux poteaux, aux clôtures et aux panneaux, ce qui bloque le trottoir. Un support supplémentaire du côté sud réglerait le problème.',
   'transport', 30, 45.4790, -73.6200, 7, null, '/demo/velos-villa-maria.jpg'),

  ('bancs-georges-st-pierre', 'riveros',
   'Bancs brisés au parc Georges-Saint-Pierre',
   'Trois bancs sur cinq ont des lattes cassées ou manquantes. Les personnes âgées du secteur viennent s''asseoir là l''après-midi et se retrouvent debout. Ce sont des lattes de bois à revisser, pas un remplacement complet.',
   'parcs', 28, 45.4685, -73.6078, 9, null, '/demo/bancs-georges-st-pierre.jpg'),

  ('moisissures-vezina', 'whitfield',
   'Mould reported six months ago on Vézina and nothing has moved',
   'An eight-unit building where several tenants have black patches in the bathroom and in the bedrooms. Two children have developed asthma. The borough''s notices went out to the landlord, but nothing has been done and nobody involved knows what the next step in the process is, or how long it is supposed to take.',
   'logement', 26, 45.4885, -73.6355, 16, null, null),

  ('egout-cdn', 'kohn',
   'Bouche d''égout affaissée sur le chemin de la Côte-des-Neiges',
   'Le pourtour s''est enfoncé d''environ cinq centimètres et chaque autobus qui passe fait un bruit sourd qu''on entend jusque dans les appartements. C''est aussi un piège pour les roues de vélo puisque c''est pile dans la trajectoire.',
   'voirie', 24, 45.4930, -73.6250, 12, null, null),

  ('graffitis-decarie', 'tremblay',
   'Graffitis sur les murets du viaduc Décarie',
   'Ce n''est pas une question de goût, c''est que le passage est déjà peu invitant et que cela ajoute à l''impression d''abandon. Le programme de retrait existe et fonctionne bien ailleurs dans l''arrondissement, il suffirait d''y inscrire ce secteur.',
   'proprete', 22, 45.4870, -73.6410, 6, null, '/demo/graffitis-decarie.jpg'),

  ('queen-mary-cdn', 'belkacem',
   'Intersection Queen-Mary et Côte-des-Neiges : trois accrochages ce mois-ci',
   'Le virage à gauche se fait sans feu protégé alors que le volume est énorme aux heures de pointe. J''ai vu trois accrochages depuis le début du mois, dont un avec un piéton qui a eu très peur. Un feu de virage séparé réglerait cela.',
   'securite', 20, 45.4930, -73.6255, 15, null, null),

  ('arret-edouard-montpetit', 'fournier',
   'Les autobus ne s''arrêtent plus à l''arrêt Édouard-Montpetit',
   'L''arrêt a été déplacé pour un chantier, mais l''affiche temporaire est tombée et personne ne sait où attendre. Les gens restent à l''ancien emplacement et regardent le bus passer. Il faudrait au minimum reposer l''affiche.',
   'transport', 18, 45.5060, -73.6180, 8, null, null),

  ('eclairage-loyola', 'haddad',
   'L''éclairage du parc Loyola s''éteint à 21 h, le terrain devient inutilisable',
   'En plein été, il fait encore clair à 21 h mais plus à 21 h 30, et les ligues amicales jouent jusqu''à 22 h. Tout le monde plie bagage en pleine partie. Décaler la minuterie d''une heure de juin à août serait suffisant.',
   'parcs', 16, 45.4665, -73.6420, 11, null, null),

  ('chantier-jean-brillant', 'okonkwo',
   'Bruit de chantier avant 7 h sur Jean-Brillant',
   'Les camions arrivent vers 6 h 15 et le compresseur démarre avant 7 h, ce qui est hors des heures permises. C''est tous les jours depuis deux semaines. Je ne demande pas l''arrêt du chantier, seulement qu''il respecte l''horaire.',
   'general', 14, 45.4975, -73.6215, 9, null, null),

  ('queen-mary-nids', 'gauthier',
   'Nids-de-poule sur Queen-Mary devant l''oratoire',
   'Le tronçon devant l''oratoire est en mauvais état sur toute sa largeur. Avec le volume de touristes en autocar, c''est aussi la première image que beaucoup de visiteurs ont du quartier.',
   'voirie', 12, 45.4915, -73.6180, 10, null, null),

  ('poubelles-westbury', 'sundaram',
   'Not a single public bin on Westbury',
   'There isn''t one public waste bin between Van Horne and Jean-Talon. People walking dogs have nowhere to put anything, and you can see the result in the hedges. Two or three bins would do it.',
   'proprete', 10, 45.4900, -73.6480, 7, null, null),

  ('viaduc-falaise', 'jeanbaptiste',
   'Le passage sous le viaduc près de la falaise Saint-Jacques est très sombre',
   'La moitié des luminaires sont hors service et le passage fait une centaine de mètres. Beaucoup de gens l''évitent le soir et font un détour de dix minutes. C''est un lien piéton important vers le sud du quartier.',
   'securite', 8, 45.4610, -73.6300, 12, null, '/demo/viaduc-falaise.jpg'),

  ('arbres-kent', 'lavoie',
   'Branches non taillées avenue de Kent, elles touchent les fils',
   'Deux érables devant le 3400 ont des branches qui reposent directement sur les câbles. Au premier grand vent, cela va casser quelque chose. Un élagage préventif coûte bien moins cher qu''une panne.',
   'parcs', 6, 45.5015, -73.6320, 8, null, null),

  ('srrr-vezina', 'mendoza',
   'La zone de stationnement réservé ne couvre pas notre bout de rue',
   'La vignette s''arrête à la moitié du tronçon, sans logique apparente. Résultat, tout le stationnement de longue durée du secteur se concentre sur nos cent mètres et les résidents tournent vingt minutes le soir.',
   'transport', 4, 45.4880, -73.6340, 6, null, null),

  ('loyers-udem', 'bergeron',
   'Hausses de loyer autour de l''UdeM : quelqu''un suit-il la situation ?',
   'Trois personnes que je connais ont reçu des hausses de plus de 15 pour cent pour juillet, toutes dans le même secteur près du campus. Est-ce que l''arrondissement a des chiffres là-dessus, et est-ce qu''il existe une ressource locale où orienter les gens ?',
   'logement', 2, 45.5045, -73.6165, 9, null, null);

insert into public.issues (
  id, author_id, title, body, category, created_at, lat, lon, image_path
)
select
  pg_temp.demo_id('issue:' || i.key),
  pg_temp.demo_id('user:' || i.author),
  i.title,
  i.body,
  i.category,
  now() - (i.days_ago || ' days')::interval,
  i.lat,
  i.lon,
  i.photo
from demo_issues i;


-- 3. La discussion -----------------------------------------------------------
--
-- Cent sept messages, en fils plutôt qu'en pile : `parent_key`
-- dit à quel message celui-ci répond, et la migration 0014 en dérive la
-- profondeur. Plusieurs fils descendent jusqu'au maximum autorisé (4), ce qui
-- est exactement ce qu'il faut pour voir travailler le repli automatique de
-- components/issues/comment-thread.tsx : au-delà de deux niveaux, la suite de
-- l'échange est repliée derrière un compteur au lieu de pousser le fil hors de
-- l'écran.
--
-- Les deux langues se mélangent à l'intérieur d'un même fil, comme dans une
-- assemblée de quartier : quelqu'un pose sa question en anglais, la personne
-- suivante répond en français, personne ne s'en formalise et tout le monde
-- suit. C'est aussi le seul moyen de voir à quoi sert le bouton « Traduire »
-- posé sous chaque message.
--
-- Ce que les gens écrivent varie autant que la langue : il y a des messages de
-- six mots, des mises à jour, des corrections, du désaccord poli, des gens qui
-- se trompent, et quelqu'un qui revient dire que c'est réglé. Trente
-- commentaires qui font tous quatre lignes bien construites ne ressemblent pas
-- à un forum, ils ressemblent à un communiqué.
--
-- `is_official` n'est pas écrit à la main : il est lu du rôle de l'auteur au
-- moment de l'insertion. Le drapeau est figé à l'écriture (migration 0002), et
-- le déclencheur fait basculer le signalement en « répondu » dès qu'un élu
-- écrit — les statuts finaux sont donc appliqués après coup, en section 6.

create temporary table demo_comments (
  key text primary key,
  issue_key text not null,
  parent_key text references demo_comments (key),
  author text not null,
  hours_after numeric not null,
  body text not null,
  -- Rempli plus bas par un parcours récursif : sert uniquement à insérer les
  -- parents avant leurs enfants.
  level int
) on commit drop;

insert into demo_comments (key, issue_key, parent_key, author, hours_after, body) values
  -- Van Horne : le fil qui descend jusqu'au fond, avec la question d'argent
  -- que tout le monde finit par poser.
  ('vh1', 'van-horne', null, 'lavoie', 5,
   'Même constat en vélo. Le pire est juste après le viaduc, on ne le voit pas venir parce qu''il est dans l''ombre.'),
  ('vh1a', 'van-horne', 'vh1', 'petrescu', 9,
   'J''ai fait remplacer une jante le mois passé après être passée là. 340 $.'),
  ('vh1a1', 'van-horne', 'vh1a', 'lavoie', 12,
   'Aïe. Est-ce que la ville rembourse dans ces cas-là ? J''ai entendu dire que oui, mais qu''il faut prouver que le trou avait déjà été signalé.'),
  ('vh1a1i', 'van-horne', 'vh1a1', 'kohn', 15,
   'It does, in theory. There''s a claim form on the city site, you have fifteen days from the incident, and they turn down almost everything on the grounds that the defect wasn''t known. I tried in 2023. Not worth the afternoon unless the damage runs into the hundreds.'),
  ('vh1a1i1', 'van-horne', 'vh1a1i', 'petrescu', 20,
   'Merci, je vais essayer quand même. 340 $ c''est au-dessus de ma franchise, alors je n''ai rien à perdre à part une heure.'),
  ('vh2', 'van-horne', null, 'shaw', 14,
   'Same eastbound. I ride it every morning and I''ve started taking Bourret instead — ten minutes longer, but I get there.'),
  ('vh3', 'van-horne', null, 'thiagarajah', 52,
   'Merci pour le signalement précis. Le tronçon est inscrit au programme de rapiéçage de l''arrondissement et les équipes doivent y passer d''ici deux semaines. Une réfection complète de la chaussée est par ailleurs prévue au PDI, mais pas avant l''an prochain. Je reviens ici quand j''ai la date exacte.'),
  ('vh3a', 'van-horne', 'vh3', 'tremblay', 61,
   'Merci pour la réponse. Je reviendrai mettre à jour ici quand les travaux seront faits.'),
  ('vh3b', 'van-horne', 'vh3', 'wexler', 66,
   'Two weeks from today, then. Noting it.'),

  -- Parc Kent : court, réglé, et quelqu'un revient le confirmer.
  ('bk1', 'bac-kent', null, 'mendoza', 14,
   'Same on my side of the park. It''s mostly after the Saturday birthday parties.'),
  ('bk2', 'bac-kent', null, 'thiagarajah', 40,
   'Un deuxième bac a été ajouté à cet emplacement et la collecte du vendredi est rétablie pour la saison estivale.'),
  ('bk3', 'bac-kent', null, 'belkacem', 96,
   'Confirmé, le deuxième bac est là depuis lundi et ça ne déborde plus. Merci.'),
  ('bk3a', 'bac-kent', 'bk3', 'mendoza', 101,
   'Can confirm on this side too. Nice to see one of these actually close.'),

  -- L'école : le fil qui s'organise. Trois personnes se partagent un comptage,
  -- et c'est cette partie-là qui se replie.
  ('te1', 'traverse-ecole', null, 'gauthier', 3,
   'Je fais ce coin deux fois par jour avec ma fille. Le problème est vraiment le virage à droite au feu vert.'),
  ('te1a', 'traverse-ecole', 'te1', 'whitfield', 9,
   'Has anyone actually counted the cars? A week of numbers would give this some weight — the borough listens to counts in a way it doesn''t listen to adjectives.'),
  ('te1a1', 'traverse-ecole', 'te1a', 'okonkwo', 27,
   'Je peux faire deux matins cette semaine si d''autres prennent les autres jours.'),
  ('te1a1i', 'traverse-ecole', 'te1a1', 'whitfield', 31,
   'I''ll take Wednesday and Thursday. 7:30 to 8:30, right-turning vehicles only, or everything?'),
  ('te1a1i1', 'traverse-ecole', 'te1a1i', 'okonkwo', 35,
   'Les virages à droite, et j''ajoute ceux qui s''immobilisent dans la zone de la traverse. C''est l''autre moitié du problème.'),
  ('te1a1ii', 'traverse-ecole', 'te1a1', 'mendoza', 40,
   'Friday''s mine.'),
  ('te2', 'traverse-ecole', null, 'valenzuela', 74,
   'Une étude de sécurisation aux abords de cette école est en cours avec le Service de l''urbanisme et de la mobilité. Les avancées de trottoir font partie des scénarios évalués. Vos observations sont utiles et je peux les faire verser au dossier — un comptage citoyen ne remplace pas le relevé technique, mais il indique où le regarder.'),
  ('te2a', 'traverse-ecole', 'te2', 'fournier', 88,
   'Parfait. J''ajoute que le problème est concentré entre 7 h 45 et 8 h 15, ça peut aider pour le comptage.'),
  ('te3', 'traverse-ecole', null, 'riveros', 20,
   'Le brigadier a demandé du renfort deux fois l''an dernier. Il me l''a dit lui-même.'),

  -- Le 165 : personne n'a tort, personne ne lâche, et ça descend.
  ('b1', 'bus-165', null, 'sundaram', 11,
   'The real problem is that it leaves the terminus full. Adding departures further south wouldn''t change anything.'),
  ('b1a', 'bus-165', 'b1', 'kohn', 30,
   'STM announced extra service on the 165 last September. Never showed up.'),
  ('b1a1', 'bus-165', 'b1a', 'sundaram', 44,
   'They did add buses — to the 165 Express, which doesn''t stop here. Technically the press release was true.'),
  ('b1a1i', 'bus-165', 'b1a1', 'wexler', 50,
   'That''s the detail that makes this so infuriating. Nobody lied, and nothing improved.'),
  ('b1a1i1', 'bus-165', 'b1a1i', 'bergeron', 58,
   'Les données de passage sont publiques, en plus. Illisibles, mais publiques. Si quelqu''un sait les lire, il y a une réponse chiffrée à trouver là-dedans.'),
  ('b2', 'bus-165', null, 'nguyen', 20,
   'Trois matins sur cinq, oui. Et quand il s''arrête, on est douze à essayer de monter par la porte arrière.'),
  ('b3', 'bus-165', null, 'haddad', 33,
   'Ce n''est pas de la compétence de l''arrondissement, mais ça vaut la peine que ce soit écrit quelque part de public.'),

  -- Jeux d'eau : la seule chose qui manquait, c'était l'affiche.
  ('je1', 'jeux-eau-mlk', null, 'haddad', 8,
   'Mise à jour : un employé m''a dit que c''est une pièce de pompe en attente. Toujours aucune affiche sur place.'),
  ('je2', 'jeux-eau-mlk', null, 'jeanbaptiste', 22,
   'On est venus de Darlington exprès samedi avec les enfants. Une affiche aurait évité le déplacement.'),
  ('je3', 'jeux-eau-mlk', null, 'thiagarajah', 63,
   'La pièce est arrivée et l''installation a été faite. Les jeux d''eau sont rouverts depuis vendredi. Vous avez raison sur l''affichage, et la consigne a été rappelée aux équipes : toute fermeture de plus de 48 heures doit être affichée sur place avec une date de retour.'),
  ('je4', 'jeux-eau-mlk', null, 'haddad', 80,
   'Passé hier, c''est ouvert et il y avait foule. Merci !'),
  ('je4a', 'jeux-eau-mlk', 'je4', 'jeanbaptiste', 84,
   'Same, went by with the kids on Sunday. Good outcome.'),

  -- Barclay : le fil où l'on s'échange un numéro de téléphone utile.
  ('br1', 'barclay-renovictions', null, 'nguyen', 16,
   'C''est le même scénario sur ma rue. Le problème est qu''individuellement, chaque dossier a l''air légitime.'),
  ('br2', 'barclay-renovictions', null, 'whitfield', 44,
   'The CDN housing committee does free accompaniment for contesting a repossession. Worth calling before signing anything at all.'),
  ('br2a', 'barclay-renovictions', 'br2', 'okonkwo', 70,
   'Merci, je transmets aux voisins concernés.'),
  ('br2a1', 'barclay-renovictions', 'br2a', 'whitfield', 74,
   'Ask for the intake worker rather than the front desk, otherwise you get a callback in three weeks.'),
  ('br2a1i', 'barclay-renovictions', 'br2a1', 'riveros', 90,
   'Je confirme, j''ai appelé pour ma sœur en mars. Rappel en moins de 48 h quand on demande la bonne personne.'),
  ('br3', 'barclay-renovictions', null, 'shaw', 55,
   'Five units in a year in two adjacent buildings isn''t a coincidence, it''s a business model.'),

  -- Snowdon : réglé en deux messages, ce qui arrive aussi.
  ('ts1', 'trottoir-snowdon', null, 'petrescu', 6,
   'Je l''ai signalé aussi. On m''a répondu que c''était une intervention de la voirie, sans date.'),
  ('ts2', 'trottoir-snowdon', null, 'moroz', 36,
   'Réparation effectuée cette semaine. Merci d''avoir précisé l''emplacement exact : c''est ce qui permet à une requête d''aboutir sans qu''une équipe passe une matinée à chercher la bonne dalle.'),
  ('ts2a', 'trottoir-snowdon', 'ts2', 'gauthier', 44,
   'Réparé effectivement, je suis passée hier. Merci, c''est allé vite.'),

  -- La ruelle : deux personnes qui savent comment le système fonctionne.
  ('dr1', 'depot-ruelle-somerled', null, 'riveros', 19,
   'Le frigo est le vrai problème. Il faudrait au moins enlever la porte en attendant.'),
  ('dr2', 'depot-ruelle-somerled', null, 'lavoie', 40,
   'Les encombrants ne passent effectivement pas dans les ruelles. Il faut une requête spécifique au 311 avec la mention « ruelle ».'),
  ('dr2a', 'depot-ruelle-somerled', 'dr2', 'sundaram', 46,
   'Filed it that way this morning, thanks. Got a request number this time instead of a shrug.'),

  -- Fielding : un circuit, pas des ampoules.
  ('lf1', 'lampadaire-fielding', null, 'oconnell', 12,
   'Two more are out further along Fielding. Might be the same circuit.'),
  ('lf2', 'lampadaire-fielding', null, 'teodoresco', 45,
   'Il s''agissait bien d''une défaillance de circuit et non d''ampoules individuelles, ce qui explique que trois lampadaires soient tombés ensemble. Le secteur a été rétabli mardi.'),
  ('lf2a', 'lampadaire-fielding', 'lf2', 'oconnell', 52,
   'Back on as of last night. Thanks — and good to know it was the circuit, that explains why the 311 call went nowhere.'),

  -- Côte-Sainte-Catherine : le fil des cyclistes.
  ('pc1', 'piste-csc', null, 'bergeron', 9,
   'Le pire est que la fin de piste arrive juste après une descente, donc on y arrive vite.'),
  ('pc2', 'piste-csc', null, 'sundaram', 26,
   'A bike box at the light would already help a lot, and it''s paint.'),
  ('pc2a', 'piste-csc', 'pc2', 'lavoie', 50,
   'D''accord. Je ne demande pas une piste complète, juste une transition qui existe.'),
  ('pc2a1', 'piste-csc', 'pc2a', 'shaw', 58,
   'Honestly the scariest forty metres of my commute, and I rode in Toronto for six years.'),
  ('pc2a1i', 'piste-csc', 'pc2a1', 'bergeron', 66,
   'Et on n''a pas le temps de décider quoi faire, c''est ça le problème. On sort de la descente et il faut déjà être dans la bonne voie.'),

  -- Confédération : quarante dollars.
  ('bc1', 'basket-confederation', null, 'riveros', 15,
   'Les jeunes ont attaché une corde à un des paniers. Ça dit tout.'),
  ('bc2', 'basket-confederation', null, 'teodoresco', 38,
   'Les filets ont été remplacés sur les deux paniers. Merci du signalement.'),

  -- La fontaine : quelqu'un finit par proposer d'écrire la demande.
  ('fn1', 'fontaine-ndg', null, 'whitfield', 18,
   'Simple and useful. I''d add a bowl at ground level for dogs, like the one at Jarry.'),
  ('fn2', 'fontaine-ndg', null, 'kohn', 34,
   'Le budget participatif de l''arrondissement pourrait couvrir exactement ce genre de projet.'),
  ('fn2a', 'fontaine-ndg', 'fn2', 'elamrani', 60,
   'Bonne piste, je vais regarder les dates du prochain appel à projets.'),
  ('fn2a1', 'fontaine-ndg', 'fn2a', 'kohn', 68,
   'Deadline is usually late September. Happy to help write it up if you want a second pair of hands.'),
  ('fn2a1i', 'fontaine-ndg', 'fn2a1', 'elamrani', 75,
   'Je prends. On se reparle en septembre.'),
  ('fn3', 'fontaine-ndg', null, 'gauthier', 30,
   'Oui. Et une fontaine, c''est aussi moins de bouteilles dans le bac.'),

  -- Monkland : personne ne se souvient de la dernière fois.
  ('mm1', 'marquage-monkland', null, 'gauthier', 21,
   'Même chose à l''intersection suivante. Le marquage de tout le tronçon est à refaire.'),
  ('mm2', 'marquage-monkland', null, 'oconnell', 47,
   'Repainting normally happens in spring. This stretch looks like it got skipped.'),

  -- Lacombe : le fil qui se transforme en campagne de signalements.
  ('rl1', 'rats-lacombe', null, 'petrescu', 10,
   'On en a aussi derrière Côte-Sainte-Catherine. Ça s''est nettement aggravé cet été.'),
  ('rl2', 'rats-lacombe', null, 'elamrani', 29,
   'L''arrondissement a un programme de dératisation sur demande, mais il faut que plusieurs adresses signalent pour déclencher une intervention de secteur.'),
  ('rl2a', 'rats-lacombe', 'rl2', 'nguyen', 53,
   'Alors signalons tous. Ça prend deux minutes au 311 et ça compte.'),
  ('rl2a1', 'rats-lacombe', 'rl2a', 'shaw', 60,
   'Done. I''ll post the request number here so anyone else calling can reference the same file.'),
  ('rl2a1i', 'rats-lacombe', 'rl2a1', 'petrescu', 70,
   'Fait aussi. Ça fait quatre adresses.'),
  ('rl3', 'rats-lacombe', null, 'thiagarajah', 80,
   'Merci — quatre signalements sur le même tronçon, c''est précisément ce qui permet de demander une intervention de secteur plutôt qu''une visite adresse par adresse. Je transmets à la Division de l''inspection avec les numéros de requête.'),

  -- Somerled : le désaccord poli sur la bonne solution.
  ('vs1', 'vitesse-somerled', null, 'mendoza', 7,
   'The feedback radar they put up last year worked, and then it was taken down after a month.'),
  ('vs2', 'vitesse-somerled', null, 'tremblay', 25,
   'Un radar seul ne suffit pas de toute façon. C''est la largeur de la rue qui envoie le signal, et aucun panneau ne va contredire ça.'),
  ('vs2a', 'vitesse-somerled', 'vs2', 'oconnell', 49,
   'Exactly my point. Narrowing it by eye is cheaper than permanent enforcement.'),
  ('vs2b', 'vitesse-somerled', 'vs2', 'jeanbaptiste', 55,
   'Je ne suis pas sûre. Des dos d''âne sur une rue d''autobus, ça se retourne vite contre nous.'),

  -- Villa-Maria : une réponse, et elle suffit.
  ('vv1', 'velos-villa-maria', null, 'bergeron', 23,
   'Il y a de la place le long du muret au sud, ce serait facile à installer.'),

  -- Georges-Saint-Pierre : des lattes.
  ('bg1', 'bancs-georges-st-pierre', null, 'jeanbaptiste', 17,
   'Mon père y va tous les jours. Il apporte maintenant sa propre chaise pliante.'),
  ('bg2', 'bancs-georges-st-pierre', null, 'riveros', 41,
   'J''ai pris des photos des trois bancs, je peux les joindre à une requête si ça aide.'),

  -- Vézina : le dossier où l'élue ne peut pas tout dire, et le dit.
  ('mv1', 'moisissures-vezina', null, 'nguyen', 13,
   'Six mois, c''est bien au-delà des délais normaux pour un avis d''insalubrité.'),
  ('mv2', 'moisissures-vezina', null, 'whitfield', 31,
   'Tenants are entitled to a copy of the inspection report. That''s the first thing to ask for, in writing.'),
  ('mv3', 'moisissures-vezina', null, 'valenzuela', 58,
   'The file is active with the Inspection Division. I can''t comment publicly on an individual case, but I''d encourage you to write to the borough office with the request number: we can check where the process stands and set out what recourse exists at each stage. Six months is long, and you are right to say so here.'),
  ('mv3a', 'moisissures-vezina', 'mv3', 'whitfield', 76,
   'Thank you. Passing this to the tenants tonight.'),
  ('mv3b', 'moisissures-vezina', 'mv3', 'okonkwo', 82,
   'C''est la première fois que je vois écrit noir sur blanc où en est un dossier de ce genre. Ça devrait être la norme.'),

  -- Côte-des-Neiges : le bruit qu'on entend chez soi.
  ('ec1', 'egout-cdn', null, 'tremblay', 20,
   'Je l''entends de chez moi la nuit. Je pensais que c''était un camion mal chargé.'),
  ('ec2', 'egout-cdn', null, 'kohn', 44,
   'C''est le cadre qui a bougé, pas le couvercle. Ça se remet à niveau en une demi-journée.'),

  ('gd1', 'graffitis-decarie', null, 'riveros', 26,
   'Le programme d''enlèvement existe et il est gratuit pour les propriétaires, mais peu de gens le savent.'),

  -- Queen-Mary : compétence partagée, et l'élu le dit plutôt que de promettre.
  ('qm1', 'queen-mary-cdn', null, 'haddad', 9,
   'J''ai assisté à un des trois. Le conducteur ne voyait rien à cause des véhicules en attente.'),
  ('qm2', 'queen-mary-cdn', null, 'wexler', 28,
   'A protected left is the only fix here. The volume is too high for anything based on courtesy.'),
  ('qm3', 'queen-mary-cdn', null, 'moroz', 55,
   'Cette intersection relève d''une compétence partagée avec la Ville-centre pour la signalisation lumineuse, ce qui veut dire que je ne peux pas la faire modifier seul. Je porte la demande au comité de circulation avec vos observations et je reviendrai ici avec la réponse, même si c''est un refus.'),
  ('qm3a', 'queen-mary-cdn', 'qm3', 'belkacem', 70,
   'Merci. Même un refus documenté vaut mieux que le silence.'),

  ('ae1', 'arret-edouard-montpetit', null, 'lavoie', 15,
   'L''affiche est par terre derrière la clôture du chantier. Je l''ai vue en passant.'),
  ('ae2', 'arret-edouard-montpetit', null, 'fournier', 33,
   'Merci, je le mentionne dans la requête. Au moins on sait où elle est.'),

  ('el1', 'eclairage-loyola', null, 'mendoza', 11,
   'The Thursday soccer league is affected too. We finish by phone light.'),
  ('el2', 'eclairage-loyola', null, 'petrescu', 30,
   'Une minuterie saisonnière existe déjà dans d''autres parcs, donc ça doit être faisable ici.'),
  ('el3', 'eclairage-loyola', null, 'teodoresco', 44,
   'La minuterie est effectivement réglable par parc. J''ai demandé le décalage d''une heure pour juin à août ; ça devrait être en place d''ici la fin de la semaine prochaine.'),

  ('cj1', 'chantier-jean-brillant', null, 'kohn', 8,
   'Le règlement fixe 7 h en semaine. Avant, c''est une infraction et ça se constate au 311.'),
  ('cj2', 'chantier-jean-brillant', null, 'okonkwo', 24,
   'Merci, je ne savais pas que c''était constatable. Je note les heures à partir de demain.'),

  ('qn1', 'queen-mary-nids', null, 'belkacem', 18,
   'Les autocars de tourisme ralentissent maintenant à cet endroit, ce qui bloque toute la voie.'),

  ('pw1', 'poubelles-westbury', null, 'gauthier', 14,
   'Il y en avait une devant le dépanneur avant. Elle a été retirée et jamais remplacée.'),

  -- La falaise : quelqu'un devine mal, et l'élue corrige sans humilier.
  ('vf1', 'viaduc-falaise', null, 'oconnell', 10,
   'I take the Saint-Jacques detour in the evening, which is ironic given it''s no better lit.'),
  ('vf2', 'viaduc-falaise', null, 'bergeron', 27,
   'Le passage relève peut-être du MTQ plutôt que de l''arrondissement, ce qui expliquerait l''immobilisme.'),
  ('vf2a', 'viaduc-falaise', 'vf2', 'valenzuela', 40,
   'Le passage lui-même est bien à nous — c''est la structure au-dessus qui ne l''est pas, et c''est ce qui a fait tourner en rond les requêtes précédentes. Les luminaires sont commandés. La date, je ne l''ai pas encore, et je préfère le dire plutôt que d''en inventer une.'),
  ('vf2a1', 'viaduc-falaise', 'vf2a', 'bergeron', 48,
   'Autant pour moi, et merci pour la précision. C''était exactement la question que personne n''arrivait à faire répondre.'),

  ('ak1', 'arbres-kent', null, 'nguyen', 12,
   'Même situation deux rues plus loin. L''élagage semble en retard partout cette année.'),

  ('sv1', 'srrr-vezina', null, 'riveros', 9,
   'La limite de zone suit une ancienne découpe qui ne correspond plus à rien.'),

  ('lu1', 'loyers-udem', null, 'wexler', 7,
   'The housing tribunal publishes figures by sector, but they run about a year behind.'),
  ('lu2', 'loyers-udem', null, 'whitfield', 19,
   'The housing committee keeps its own numbers and they''re more current. They answer the phone, which helps.'),
  ('lu2a', 'loyers-udem', 'lu2', 'bergeron', 26,
   'Merci à vous deux. Je vais appeler cette semaine et je reviens dire ce qu''ils m''ont répondu.');

-- La profondeur de chaque message, calculée depuis la structure plutôt que
-- tenue à la main : une colonne de plus à maintenir sur cent sept lignes
-- serait fausse à la première réorganisation d'un fil.
with recursive walk as (
  select key, 0 as level from demo_comments where parent_key is null
  union all
  select c.key, w.level + 1
    from demo_comments c
    join walk w on c.parent_key = w.key
)
update demo_comments c set level = w.level from walk w where w.key = c.key;

/*
 * Insérés niveau par niveau. Une seule instruction couvrant tout le jeu ferait
 * chercher au déclencheur set_comment_depth (migration 0014) un parent que la
 * même instruction n'a pas encore écrit ; en commençant par les racines, chaque
 * parent est déjà là quand son enfant arrive.
 *
 * La boucle s'arrête à 4 parce que la contrainte s'arrête là : un commentaire
 * de niveau 5 serait refusé par le déclencheur, et il vaut mieux que ce jeu de
 * données ne puisse pas en contenir.
 */
do $$
declare
  lvl int;
begin
  for lvl in 0..4 loop
    insert into public.comments (
      id, issue_id, author_id, body, is_official, created_at, parent_id
    )
    select
      pg_temp.demo_id('comment:' || c.key),
      pg_temp.demo_id('issue:' || c.issue_key),
      pg_temp.demo_id('user:' || c.author),
      c.body,
      p.role = 'official',
      i.created_at + (c.hours_after || ' hours')::interval,
      case when c.parent_key is null
        then null
        else pg_temp.demo_id('comment:' || c.parent_key)
      end
    from demo_comments c
    join public.issues i on i.id = pg_temp.demo_id('issue:' || c.issue_key)
    join public.profiles p on p.id = pg_temp.demo_id('user:' || c.author)
    where c.level = lvl;
  end loop;
end;
$$;


-- 4. Vérification ------------------------------------------------------------
--
-- Deux choses que le reste du fichier ne peut pas garantir tout seul, et qui
-- ne se voient qu'à l'écran si personne ne les vérifie ici.

do $$
declare
  orphelins int;
  anachroniques int;
begin
  -- Un commentaire dont le parent est sur un autre signalement serait refusé
  -- par le déclencheur ; celui dont le parent n'existe pas du tout remonterait
  -- silencieusement en tête de fil à l'affichage.
  select count(*) into orphelins
    from demo_comments c
   where c.parent_key is not null
     and not exists (
       select 1 from demo_comments p
        where p.key = c.parent_key and p.issue_key = c.issue_key
     );
  if orphelins > 0 then
    raise exception '% commentaire(s) répondent à un message absent ou d''un autre signalement', orphelins;
  end if;

  -- Une réponse écrite avant le message qu'elle répond : le fil se lit alors à
  -- l'envers, sans que rien ne signale l'erreur.
  select count(*) into anachroniques
    from demo_comments c
    join demo_comments p on p.key = c.parent_key
   where c.hours_after <= p.hours_after;
  if anachroniques > 0 then
    raise exception '% réponse(s) précèdent le message auquel elles répondent', anachroniques;
  end if;
end;
$$;


-- 5. Les appuis --------------------------------------------------------------
--
-- Écrits plutôt que listés : trois cents lignes à la main n'apprendraient rien
-- à personne. Chaque signalement reçoit sa cible d'appuis, distribuée sur les
-- résidents par un hachage de (personne, signalement) — déterministe, donc la
-- même pile de visages à chaque exécution, et pas toujours les mêmes visages
-- d'un signalement à l'autre.
--
-- Les élus sont exclus : un appui est une voix de résident, et voir la mairesse
-- apparaître dans la pile de visages sous « 18 personnes soutiennent ce sujet »
-- brouille exactement la distinction que le drapeau « réponse officielle »
-- établit. Leur position se lit dans leurs réponses, pas dans un compteur.
--
-- L'auteur ne s'appuie pas lui-même, et les dates sont étalées sur la durée de
-- vie du signalement pour que « appuyé il y a deux jours » veuille dire quelque
-- chose — à partir de la plus tardive des deux dates, celle du signalement et
-- celle de l'inscription, sinon quelqu'un finit par avoir appuyé un rapport
-- avant d'avoir eu un compte. issues.vote_count n'est pas touché : le
-- déclencheur s'en charge.

insert into public.votes (issue_id, user_id, created_at)
select
  s.issue_id,
  s.user_id,
  s.depuis + (now() - s.depuis) * (s.rn::numeric / (s.appuis + 1))
from (
  select
    i.id as issue_id,
    p.id as user_id,
    greatest(i.created_at, p.created_at) as depuis,
    d.appuis,
    row_number() over (
      partition by i.id order by md5(p.id::text || i.id::text)
    ) as rn
  from demo_issues d
  join public.issues i on i.id = pg_temp.demo_id('issue:' || d.key)
  join auth.users u on u.raw_app_meta_data ->> 'seed' = 'villemtl-demo'
  join public.profiles p on p.id = u.id
  where p.id <> i.author_id
    and p.role = 'citizen'
) s
where s.rn <= s.appuis;


-- 6. Les dossiers clos -------------------------------------------------------
--
-- Appliqué en dernier : une réponse officielle a déjà fait passer ces
-- signalements de « ouvert » à « répondu » via le déclencheur, et « réglé » est
-- l'état qu'ils ont atteint ensuite. Sans une liste où tout est résolu et sans
-- une liste où rien ne l'est, on ne voit pas à quoi servent les étiquettes.

update public.issues i
   set status = d.final_status
  from demo_issues d
 where i.id = pg_temp.demo_id('issue:' || d.key)
   and d.final_status is not null;
