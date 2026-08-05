-- Une communaute de demonstration : 20 comptes, 30 signalements, la discussion
-- qui va avec.
--
--   npm run migrate -- supabase/demo-seed.sql
--
-- Pourquoi ce fichier existe : une page de forum vide ne se juge pas. On ne
-- voit ni le classement par appuis, ni la pile de visages, ni ce que devient
-- une carte avec trente epingles dessus, ni a quoi ressemble un fil ou un elu
-- a repondu. Il faut du monde dedans pour que les ecrans disent quelque chose.
--
-- Ce ne sont PAS de vraies personnes. Les noms sont inventes, les adresses sont
-- en @exemple.test (TLD reserve, rien n'est livrable), et chaque compte porte
-- raw_app_meta_data->>'seed' = 'villemtl-demo'. C'est cette marque, et non
-- l'adresse, qui sert au menage :
--
--   delete from auth.users where raw_app_meta_data->>'seed' = 'villemtl-demo';
--
-- Tout le reste part en cascade : profils, signalements, commentaires, appuis.
-- Le fichier commence d'ailleurs par exactement cette ligne, donc le rejouer
-- remplace la communaute au lieu de la doubler.
--
-- Les comptes sont utilisables : mot de passe 'demo-villemtl-2026' pour tout le
-- monde, ce qui permet de se connecter comme resident ordinaire et de voir le
-- site sans les pouvoirs d'un elu.
--
-- Les identifiants sont derives des cles textuelles (uuid v5), pas tires au
-- hasard : deux executions produisent les memes lignes, donc les couleurs
-- d'avatar et les liens de profil ne bougent pas d'une fois a l'autre.

-- Efface la fournee precedente, s'il y en a une.
delete from auth.users where raw_app_meta_data ->> 'seed' = 'villemtl-demo';

create or replace function pg_temp.demo_id(key text) returns uuid
language sql immutable as $$
  select extensions.uuid_generate_v5(
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'villemtl-demo:' || key
  )
$$;


-- 1. Les gens ----------------------------------------------------------------
--
-- Dix-neuf residents et une conseillere d'arrondissement. La conseillere a une
-- adresse @montreal.ca confirmee, parce que c'est de la que le role 'official'
-- est derive (migration 0003) : il ne s'ecrit pas a la main.
--
-- Les dates d'inscription sont etalees sur quatorze mois. Vingt profils crees
-- le meme jour ne ressemblent pas a une communaute, ils ressemblent a un import.
-- Chacune precede la premiere contribution de la personne : rien n'a l'air plus
-- faux qu'un « membre depuis 3 semaines » sous un commentaire vieux de deux mois.

create temporary table demo_people (
  key text primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  joined_days int not null
) on commit drop;

insert into demo_people values
  ('tremblay',   'Marie-Claude', 'Tremblay',     'marie-claude.tremblay@exemple.test', 412),
  ('belkacem',   'Ahmed',        'Belkacem',     'ahmed.belkacem@exemple.test',        389),
  ('fournier',   'Rosalie',      'Fournier',     'rosalie.fournier@exemple.test',      356),
  ('wexler',     'Jonathan',     'Wexler',       'jonathan.wexler@exemple.test',       341),
  ('haddad',     'Farah',        'Haddad',       'farah.haddad@exemple.test',          318),
  ('okonkwo',    'Daniel',       'Okonkwo',      'daniel.okonkwo@exemple.test',        295),
  ('gauthier',   'Mylene',       'Gauthier',     'mylene.gauthier@exemple.test',       274),
  ('sundaram',   'Ravi',         'Sundaram',     'ravi.sundaram@exemple.test',         251),
  ('jeanbaptiste','Claudette',   'Jean-Baptiste','claudette.jean-baptiste@exemple.test',233),
  ('lavoie',     'Simon',        'Lavoie',       'simon.lavoie@exemple.test',          208),
  ('mendoza',    'Grace',        'Mendoza',      'grace.mendoza@exemple.test',         186),
  ('elamrani',   'Youssef',      'El Amrani',    'youssef.elamrani@exemple.test',      164),
  ('bergeron',   'Lea',          'Bergeron',     'lea.bergeron@exemple.test',          141),
  ('nguyen',     'Thanh',        'Nguyen',       'thanh.nguyen@exemple.test',          119),
  ('oconnell',   'Patrick',      'O''Connell',   'patrick.oconnell@exemple.test',       98),
  ('petrescu',   'Nadia',        'Petrescu',     'nadia.petrescu@exemple.test',         76),
  ('riveros',    'Carlos',       'Riveros',      'carlos.riveros@exemple.test',         54),
  ('whitfield',  'Emma',         'Whitfield',    'emma.whitfield@exemple.test',         85),
  ('kohn',       'Samuel',       'Kohn',         'samuel.kohn@exemple.test',            79),
  ('doucet',     'Helene',       'Doucet',       'demo.conseillere@montreal.ca',       430);

-- Les colonnes de jetons sont mises a '' plutot que laissees nulles : GoTrue les
-- lit comme des chaines et une valeur nulle fait echouer la connexion avec une
-- erreur de conversion qui ne pointe vers rien de comprehensible.
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
  extensions.crypt('demo-villemtl-2026', extensions.gen_salt('bf')),
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

-- Sans ligne d'identite, GoTrue refuse la connexion par mot de passe meme quand
-- le hash est bon.
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

-- Le profil est cree par le declencheur on_auth_user_created, avec created_at a
-- maintenant. La page profil affiche « membre depuis », alors on la reajuste sur
-- la date d'inscription reelle du compte.
update public.profiles p
   set created_at = u.created_at
  from auth.users u
 where u.id = p.id
   and u.raw_app_meta_data ->> 'seed' = 'villemtl-demo';


-- 2. Les signalements --------------------------------------------------------
--
-- Trente rapports etales sur onze semaines, tous localises dans CDN-NDG et
-- repartis sur les cinq districts, pour que la carte soit couverte plutot que
-- groupee sur un coin. Les coordonnees tiennent dans BOROUGH_BOUNDS
-- (utils/map.ts) : hors de cette boite, le formulaire refuserait l'epingle et
-- la carte les afficherait a l'exterieur du trace.
--
-- La colonne `appuis` n'est pas ecrite dans issues.vote_count : c'est une cible
-- pour la section 4, et le compteur est tenu par le declencheur.

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
  final_status text
) on commit drop;

insert into demo_issues values
  ('van-horne', 'tremblay',
   'Nids-de-poule sur Van Horne, entre Victoria et Decarie',
   'Le troncon est devenu impraticable depuis le degel. Il y a au moins six trous profonds sur 400 metres, et les autobus doivent deborder sur la voie de gauche pour les eviter. J''ai vu deux cyclistes se faire surprendre la semaine derniere. Ce n''est plus une question de confort, c''est une question de securite.',
   'voirie', 74, 45.4995, -73.6390, 18, null),

  ('bac-kent', 'belkacem',
   'Le bac de recyclage du parc Kent deborde chaque fin de semaine',
   'Tous les samedis apres-midi, le bac est plein et le reste deborde au sol. Le lundi matin il y a du carton mouille partout dans l''allee. Une collecte de plus le vendredi reglerait probablement le probleme, ou simplement un deuxieme bac a cote.',
   'proprete', 70, 45.4975, -73.6285, 11, 'resolved'),

  ('traverse-ecole', 'fournier',
   'Traverse pietonne dangereuse devant l''ecole Saint-Pascal-Baylon',
   'Le matin, les voitures tournent a droite sans ralentir pendant que les enfants traversent. Le brigadier fait ce qu''il peut mais il est seul pour deux coins de rue. Une avancee de trottoir ou un feu pour pietons changerait tout. J''ai deux enfants qui font ce trajet chaque jour et je retiens mon souffle chaque fois.',
   'securite', 68, 45.4960, -73.6255, 17, null),

  ('bus-165', 'wexler',
   'Le 165 passe tout droit aux heures de pointe',
   'Trois matins sur cinq, le bus arrive plein et ne s''arrete pas a Cote-Sainte-Catherine. On attend le suivant, qui est plein aussi. En pratique cela ajoute vingt minutes a un trajet de quinze. La ligne aurait besoin de departs supplementaires entre 7 h 30 et 9 h.',
   'transport', 65, 45.4995, -73.6215, 15, null),

  ('jeux-eau-mlk', 'haddad',
   'Les jeux d''eau du parc Martin-Luther-King sont fermes depuis juin',
   'Aucune affiche n''explique pourquoi, et aucune date de reouverture n''est donnee. C''est le seul point d''eau du secteur et il fait 30 degres. Les familles arrivent avec les enfants et repartent. Une simple affiche avec un echeancier serait deja mieux que rien.',
   'parcs', 61, 45.5039, -73.6320, 16, 'resolved'),

  ('barclay-renovictions', 'okonkwo',
   'Renovictions sur la rue Barclay : cinq logements vides en un an',
   'Le meme proprietaire a repris cinq appartements dans deux immeubles voisins, chaque fois pour des travaux majeurs, chaque fois reloues bien plus cher quelques mois plus tard. Les locataires partis etaient des familles installees depuis dix ans. Je voudrais savoir si l''arrondissement suit ces dossiers et ce qui peut etre fait.',
   'logement', 58, 45.5010, -73.6360, 14, null),

  ('trottoir-snowdon', 'gauthier',
   'Trottoir defonce a la sortie du metro Snowdon',
   'La dalle est soulevee d''une bonne dizaine de centimetres juste devant la sortie nord. Avec une marchette ou une poussette c''est infranchissable, il faut descendre dans la rue pour contourner. Une voisine de 80 ans est tombee la le mois dernier.',
   'voirie', 55, 45.4845, -73.6320, 13, 'resolved'),

  ('depot-ruelle-somerled', 'sundaram',
   'Depot sauvage de meubles dans la ruelle entre Somerled et Terrebonne',
   'Un divan, deux matelas et un frigo sont la depuis trois semaines. Le frigo a encore sa porte, ce qui est dangereux avec des enfants dans la ruelle. Les collectes d''encombrants passent, mais rien n''est ramasse parce que c''est dans la ruelle et non en bordure de rue.',
   'proprete', 52, 45.4680, -73.6285, 9, null),

  ('lampadaire-fielding', 'jeanbaptiste',
   'Lampadaire eteint depuis trois semaines au coin Fielding et Cavendish',
   'Le coin est completement noir a partir de 20 h. C''est un arret d''autobus et il y a beaucoup de gens qui rentrent tard du travail. J''ai signale par le 311 il y a trois semaines, j''ai un numero de requete, et rien n''a bouge.',
   'securite', 49, 45.4645, -73.6470, 12, 'resolved'),

  ('piste-csc', 'lavoie',
   'La piste cyclable de Cote-Sainte-Catherine se termine dans le vide',
   'La voie protegee s''arrete net avant l''intersection et on se retrouve a devoir s''inserer dans trois voies de circulation sans aucune transition. C''est le point le plus stressant de mon trajet quotidien, et je vois regulierement des cyclistes moins a l''aise finir sur le trottoir.',
   'transport', 46, 45.4990, -73.6280, 14, null),

  ('basket-confederation', 'mendoza',
   'Le terrain de basket du parc de la Confederation n''a plus de filets',
   'Les deux paniers sont nus depuis le debut de l''ete. Les jeunes jouent quand meme, mais c''est un remplacement a 40 dollars qui remettrait le terrain en etat. Le revetement lui-meme est correct.',
   'parcs', 44, 45.4728, -73.6414, 8, 'resolved'),

  ('fontaine-ndg', 'elamrani',
   'Est-ce qu''on peut avoir une fontaine a eau au parc Notre-Dame-de-Grace ?',
   'Le parc est grand et tres frequente l''ete, et il n''y a aucun point d''eau potable. Les gens ressortent acheter des bouteilles au depanneur. Une fontaine avec remplissage de gourde, comme celle installee au parc Kent, serait un ajout simple et utile.',
   'general', 41, 45.4715, -73.6135, 10, null),

  ('marquage-monkland', 'bergeron',
   'Marquage au sol efface sur Monkland, les autos coupent le virage',
   'Les lignes ont disparu a l''intersection avec Old Orchard. Resultat, les voitures qui tournent a gauche coupent large et se retrouvent dans la voie inverse. C''est un secteur avec beaucoup de pietons a cause des terrasses.',
   'voirie', 38, 45.4682, -73.6260, 11, null),

  ('rats-lacombe', 'nguyen',
   'Rats dans la ruelle derriere l''avenue Lacombe',
   'On en voit maintenant en plein jour, ce qui n''etait pas le cas l''an dernier. Le probleme semble parti d''un immeuble ou les sacs sont sortis plusieurs jours d''avance. Une visite d''inspection et un rappel aux proprietaires aideraient beaucoup.',
   'proprete', 35, 45.5030, -73.6220, 13, null),

  ('vitesse-somerled', 'oconnell',
   'Exces de vitesse constants sur l''avenue Somerled',
   'La limite est a 40 et la circulation roule visiblement a 60. La rue est droite et large, ce qui invite a accelerer, et il y a des commerces et des enfants tout le long. Des dos d''ane ou un retrecissement a mi-troncon calmeraient le jeu.',
   'securite', 33, 45.4670, -73.6280, 15, null),

  ('velos-villa-maria', 'petrescu',
   'Manque de supports a velos autour du metro Villa-Maria',
   'Les huit supports existants sont pleins des 8 h. Le reste des velos est attache aux poteaux, aux cloture et aux panneaux, ce qui bloque le trottoir. Un support supplementaire du cote sud reglerait le probleme.',
   'transport', 30, 45.4790, -73.6200, 7, null),

  ('bancs-georges-st-pierre', 'riveros',
   'Bancs brises au parc Georges-Saint-Pierre',
   'Trois bancs sur cinq ont des lattes cassees ou manquantes. Les personnes agees du secteur viennent s''asseoir la l''apres-midi et se retrouvent debout. Ce sont des lattes de bois a revisser, pas un remplacement complet.',
   'parcs', 28, 45.4685, -73.6078, 9, null),

  ('moisissures-vezina', 'whitfield',
   'Insalubrite : moisissures signalees depuis six mois sur Vezina',
   'Un immeuble de huit logements ou plusieurs locataires ont des taches noires dans la salle de bain et dans les chambres. Deux enfants ont developpe de l''asthme. Les avis de l''arrondissement ont ete envoyes au proprietaire, mais rien n''a ete fait et les gens ne savent pas quelle est la suite du processus.',
   'logement', 26, 45.4885, -73.6355, 16, null),

  ('egout-cdn', 'kohn',
   'Bouche d''egout affaissee sur le chemin de la Cote-des-Neiges',
   'Le pourtour s''est enfonce d''environ cinq centimetres et chaque autobus qui passe fait un bruit sourd qu''on entend jusque dans les appartements. C''est aussi un piege pour les roues de velo puisque c''est pile dans la trajectoire.',
   'voirie', 24, 45.4930, -73.6250, 12, null),

  ('graffitis-decarie', 'tremblay',
   'Graffitis sur les murets du viaduc Decarie',
   'Ce n''est pas une question de gout, c''est que le passage est deja peu invitant et que cela ajoute a l''impression d''abandon. Le programme de retrait existe et fonctionne bien ailleurs dans l''arrondissement, il suffirait d''y inscrire ce secteur.',
   'proprete', 22, 45.4870, -73.6410, 6, null),

  ('queen-mary-cdn', 'belkacem',
   'Intersection Queen-Mary et Cote-des-Neiges : trois accrochages ce mois-ci',
   'Le virage a gauche se fait sans feu protege alors que le volume est enorme aux heures de pointe. J''ai vu trois accrochages depuis le debut du mois, dont un avec un pieton qui a eu tres peur. Un feu de virage separe reglerait cela.',
   'securite', 20, 45.4930, -73.6255, 15, null),

  ('arret-edouard-montpetit', 'fournier',
   'Les autobus ne s''arretent plus a l''arret Edouard-Montpetit',
   'L''arret a ete deplace pour un chantier, mais l''affiche temporaire est tombee et personne ne sait ou attendre. Les gens restent a l''ancien emplacement et regardent le bus passer. Il faudrait au minimum reposer l''affiche.',
   'transport', 18, 45.5060, -73.6180, 8, null),

  ('eclairage-loyola', 'haddad',
   'L''eclairage du parc Loyola s''eteint a 21 h, le terrain devient inutilisable',
   'En plein ete, il fait encore clair a 21 h mais plus a 21 h 30, et les ligues amicales jouent jusqu''a 22 h. Tout le monde plie bagage en pleine partie. Decaler la minuterie d''une heure de juin a aout serait suffisant.',
   'parcs', 16, 45.4665, -73.6420, 11, null),

  ('chantier-jean-brillant', 'okonkwo',
   'Bruit de chantier avant 7 h sur Jean-Brillant',
   'Les camions arrivent vers 6 h 15 et le compresseur demarre avant 7 h, ce qui est hors des heures permises. C''est tous les jours depuis deux semaines. Je ne demande pas l''arret du chantier, seulement qu''il respecte l''horaire.',
   'general', 14, 45.4975, -73.6215, 9, null),

  ('queen-mary-nids', 'gauthier',
   'Nids-de-poule sur Queen-Mary devant l''oratoire',
   'Le troncon devant l''oratoire est en mauvais etat sur toute sa largeur. Avec le volume de touristes en autocar, c''est aussi la premiere image que beaucoup de visiteurs ont du quartier.',
   'voirie', 12, 45.4915, -73.6180, 10, null),

  ('poubelles-westbury', 'sundaram',
   'Aucune poubelle sur toute l''avenue Westbury',
   'Il n''y a pas une seule poubelle publique entre Van Horne et Jean-Talon. Les gens qui promenent leur chien n''ont nulle part ou jeter, et cela se voit dans les haies. Deux ou trois corbeilles suffiraient.',
   'proprete', 10, 45.4900, -73.6480, 7, null),

  ('viaduc-falaise', 'jeanbaptiste',
   'Le passage sous le viaduc pres de la falaise Saint-Jacques est tres sombre',
   'La moitie des luminaires sont hors service et le passage fait une centaine de metres. Beaucoup de gens l''evitent le soir et font un detour de dix minutes. C''est un lien pieton important vers le sud du quartier.',
   'securite', 8, 45.4610, -73.6300, 12, null),

  ('arbres-kent', 'lavoie',
   'Branches non taillees avenue de Kent, elles touchent les fils',
   'Deux erables devant le 3400 ont des branches qui reposent directement sur les cables. Au premier grand vent, cela va casser quelque chose. Un elagage preventif coute bien moins cher qu''une panne.',
   'parcs', 6, 45.5015, -73.6320, 8, null),

  ('srrr-vezina', 'mendoza',
   'La zone de stationnement reserve ne couvre pas notre bout de rue',
   'La vignette s''arrete a la moitie du troncon, sans logique apparente. Resultat, tout le stationnement de longue duree du secteur se concentre sur nos cent metres et les residents tournent vingt minutes le soir.',
   'transport', 4, 45.4880, -73.6340, 6, null),

  ('loyers-udem', 'bergeron',
   'Hausses de loyer autour de l''UdeM : quelqu''un suit-il la situation ?',
   'Trois personnes que je connais ont recu des hausses de plus de 15 pour cent pour juillet, toutes dans le meme secteur pres du campus. Est-ce que l''arrondissement a des chiffres la-dessus, et est-ce qu''il existe une ressource locale ou orienter les gens ?',
   'logement', 2, 45.5045, -73.6165, 9, null);

insert into public.issues (
  id, author_id, title, body, category, created_at, lat, lon
)
select
  pg_temp.demo_id('issue:' || i.key),
  pg_temp.demo_id('user:' || i.author),
  i.title,
  i.body,
  i.category,
  now() - (i.days_ago || ' days')::interval,
  i.lat,
  i.lon
from demo_issues i;


-- 3. La discussion -----------------------------------------------------------
--
-- `is_official` est fige a l'ecriture (migration 0002) et une reponse officielle
-- bascule le signalement en « repondu » via le declencheur. Les commentaires de
-- Helene Doucet portent donc le drapeau, et les statuts finaux sont appliques
-- apres coup en section 5 pour les dossiers qui sont alles jusqu'au bout.

create temporary table demo_comments (
  issue_key text not null,
  author text not null,
  hours_after numeric not null,
  is_official boolean not null,
  body text not null
) on commit drop;

insert into demo_comments values
  ('van-horne', 'lavoie', 5, false, 'Meme constat en velo. Le pire est juste apres le viaduc, on ne le voit pas venir parce qu''il est dans l''ombre.'),
  ('van-horne', 'petrescu', 20, false, 'J''ai fait remplacer une jante le mois dernier apres etre passee la. 340 dollars.'),
  ('van-horne', 'doucet', 52, true, 'Merci pour le signalement precis. Le troncon est inscrit au programme de rapiecage de l''arrondissement et les equipes doivent y passer d''ici deux semaines. Une refection complete de la chaussee est par ailleurs prevue au PDI, mais pas avant l''an prochain.'),
  ('van-horne', 'tremblay', 61, false, 'Merci pour la reponse. Je reviendrai mettre a jour ici quand les travaux seront faits.'),

  ('bac-kent', 'mendoza', 14, false, 'Pareil de mon cote du parc. C''est surtout apres les fetes d''enfants le samedi.'),
  ('bac-kent', 'doucet', 40, true, 'Un deuxieme bac a ete ajoute a cet emplacement et la collecte du vendredi est retablie pour la saison estivale.'),
  ('bac-kent', 'belkacem', 96, false, 'Confirme, le deuxieme bac est la depuis lundi et ca ne deborde plus. Merci.'),

  ('traverse-ecole', 'gauthier', 3, false, 'Je fais ce coin deux fois par jour avec ma fille. Le probleme est vraiment le virage a droite au feu vert.'),
  ('traverse-ecole', 'whitfield', 9, false, 'Est-ce que quelqu''un a deja compte les vehicules ? Un decompte sur une semaine donnerait du poids a la demande.'),
  ('traverse-ecole', 'okonkwo', 27, false, 'Je peux faire deux matins cette semaine si d''autres prennent les autres jours.'),
  ('traverse-ecole', 'doucet', 74, true, 'Une etude de securisation aux abords de cette ecole est en cours avec le Service de l''urbanisme et de la mobilite. Les avancees de trottoir font partie des scenarios evalues. Je peux transmettre vos observations au dossier, elles sont utiles.'),
  ('traverse-ecole', 'fournier', 88, false, 'Parfait. J''ajoute que le probleme est concentre entre 7 h 45 et 8 h 15, ca peut aider pour le comptage.'),

  ('bus-165', 'sundaram', 11, false, 'Le probleme vient surtout du fait que la ligne est deja pleine en partant du terminus. Ajouter des departs plus au sud ne changerait rien.'),
  ('bus-165', 'kohn', 30, false, 'La STM avait annonce du renfort sur la 165 en septembre dernier. Ca n''a jamais ete visible.'),
  ('bus-165', 'wexler', 55, false, 'J''ai ecrit a la STM, reponse type. C''est pour ca que je poste ici, au moins ca laisse une trace publique.'),

  ('jeux-eau-mlk', 'haddad', 8, false, 'Mise a jour : un employe m''a dit que c''est une piece de pompe en attente. Toujours aucune affiche sur place.'),
  ('jeux-eau-mlk', 'jeanbaptiste', 22, false, 'On est venus de Darlington exprès samedi avec les enfants. Une affiche aurait evite le deplacement.'),
  ('jeux-eau-mlk', 'doucet', 63, true, 'La piece est arrivee et l''installation a ete faite. Les jeux d''eau sont rouverts depuis vendredi. Vous avez raison sur l''affichage, la consigne a ete rappelee aux equipes : toute fermeture de plus de 48 heures doit etre affichee sur place avec une date de retour.'),
  ('jeux-eau-mlk', 'haddad', 80, false, 'Passe hier, c''est ouvert et il y avait foule. Merci !'),

  ('barclay-renovictions', 'nguyen', 16, false, 'C''est le meme scenario sur ma rue. Le probleme est qu''individuellement chaque dossier a l''air legitime.'),
  ('barclay-renovictions', 'whitfield', 44, false, 'Le comite logement de CDN offre de l''accompagnement gratuit pour contester une reprise. Ca vaut la peine d''appeler avant de signer quoi que ce soit.'),
  ('barclay-renovictions', 'okonkwo', 70, false, 'Merci, je transmets aux voisins concernes.'),

  ('trottoir-snowdon', 'petrescu', 6, false, 'Je l''ai signale aussi. On m''a repondu que c''etait une intervention de la voirie, sans date.'),
  ('trottoir-snowdon', 'doucet', 36, true, 'Reparation effectuee cette semaine. Merci d''avoir precise l''emplacement exact, cela accelere beaucoup le traitement des requetes.'),

  ('depot-ruelle-somerled', 'riveros', 19, false, 'Le frigo est le vrai probleme. Il faudrait au moins enlever la porte en attendant.'),
  ('depot-ruelle-somerled', 'lavoie', 40, false, 'Les encombrants ne passent effectivement pas dans les ruelles. Il faut une requete specifique au 311 avec la mention « ruelle ».'),

  ('lampadaire-fielding', 'oconnell', 12, false, 'Deux autres lampadaires sont eteints plus loin sur Fielding. Peut-etre le meme circuit.'),
  ('lampadaire-fielding', 'doucet', 45, true, 'Il s''agissait bien d''une defaillance de circuit et non d''ampoules individuelles. Le secteur a ete retabli mardi.'),

  ('piste-csc', 'bergeron', 9, false, 'Le pire est que la fin de piste arrive juste apres une descente, donc on y arrive vite.'),
  ('piste-csc', 'sundaram', 26, false, 'Un simple sas velo au feu ameliorerait deja beaucoup les choses.'),
  ('piste-csc', 'lavoie', 50, false, 'D''accord. Je ne demande pas une piste complete, juste une transition qui existe.'),

  ('basket-confederation', 'riveros', 15, false, 'Les jeunes ont mis une corde a un des paniers. Ca dit tout.'),
  ('basket-confederation', 'doucet', 38, true, 'Les filets ont ete remplaces sur les deux paniers. Merci du signalement.'),

  ('fontaine-ndg', 'whitfield', 18, false, 'Idee simple et utile. J''ajouterais un bol au sol pour les chiens, comme au parc Jarry.'),
  ('fontaine-ndg', 'kohn', 34, false, 'Le budget participatif de l''arrondissement pourrait couvrir exactement ce genre de projet.'),
  ('fontaine-ndg', 'elamrani', 60, false, 'Bonne piste, je vais regarder les dates du prochain appel a projets.'),

  ('marquage-monkland', 'gauthier', 21, false, 'Meme chose a l''intersection suivante. Le marquage de tout le troncon est a refaire.'),
  ('marquage-monkland', 'oconnell', 47, false, 'Le repeinturage se fait normalement au printemps. Celui-ci semble avoir ete saute.'),

  ('rats-lacombe', 'petrescu', 10, false, 'On en a aussi derriere Cote-Sainte-Catherine. Ca s''est nettement aggrave cet ete.'),
  ('rats-lacombe', 'elamrani', 29, false, 'L''arrondissement a un programme de deratisation sur demande, mais il faut que plusieurs adresses signalent pour declencher une intervention de secteur.'),
  ('rats-lacombe', 'nguyen', 53, false, 'Alors signalons tous. Ca prend deux minutes au 311 et ca compte.'),

  ('vitesse-somerled', 'mendoza', 7, false, 'Le radar pedagogique installe l''an dernier avait un effet, mais il a ete retire apres un mois.'),
  ('vitesse-somerled', 'tremblay', 25, false, 'Un radar seul ne suffit pas de toute facon. C''est la largeur de la rue qui envoie le signal.'),
  ('vitesse-somerled', 'oconnell', 49, false, 'Exactement mon point. Retrecir a l''oeil coute moins cher que de la surveillance permanente.'),

  ('velos-villa-maria', 'bergeron', 23, false, 'Il y a de la place le long du muret au sud, ce serait facile a installer.'),

  ('bancs-georges-st-pierre', 'jeanbaptiste', 17, false, 'Mon pere y va tous les jours. Il apporte maintenant sa propre chaise pliante.'),
  ('bancs-georges-st-pierre', 'riveros', 41, false, 'J''ai pris des photos des trois bancs, je peux les joindre a une requete si ca aide.'),

  ('moisissures-vezina', 'nguyen', 13, false, 'Six mois est bien au-dela des delais normaux pour un avis d''insalubrite.'),
  ('moisissures-vezina', 'whitfield', 31, false, 'Les locataires ont droit a une copie du rapport d''inspection. C''est la premiere chose a demander.'),
  ('moisissures-vezina', 'doucet', 58, true, 'Le dossier est actif a la Division de l''inspection. Je ne peux pas commenter un cas precis publiquement, mais je vous invite a ecrire au bureau d''arrondissement avec le numero de requete : nous pouvons verifier ou en est le processus et les recours prevus a chaque etape.'),
  ('moisissures-vezina', 'whitfield', 76, false, 'Merci. Je transmets aux locataires concernes.'),

  ('egout-cdn', 'tremblay', 20, false, 'Je l''entends de chez moi la nuit. Je pensais que c''etait un camion mal charge.'),
  ('egout-cdn', 'kohn', 44, false, 'C''est le cadre qui a bouge, pas le couvercle. Ca se remet a niveau en une demi-journee.'),

  ('graffitis-decarie', 'riveros', 26, false, 'Le programme d''enlevement existe et il est gratuit pour les proprietaires, mais peu de gens le savent.'),

  ('queen-mary-cdn', 'haddad', 9, false, 'J''ai assiste a un des trois. Le conducteur ne voyait rien a cause des vehicules en attente.'),
  ('queen-mary-cdn', 'wexler', 28, false, 'Un feu de virage protege est la seule solution ici. Le volume est trop eleve pour du partage.'),
  ('queen-mary-cdn', 'doucet', 55, true, 'Cette intersection est de competence partagee avec la Ville-centre pour la signalisation lumineuse. Je porte la demande au comite de circulation avec vos observations, et je reviendrai ici avec la reponse.'),

  ('arret-edouard-montpetit', 'lavoie', 15, false, 'L''affiche est par terre derriere la cloture du chantier. Je l''ai vue en passant.'),
  ('arret-edouard-montpetit', 'fournier', 33, false, 'Merci, je le mentionne dans la requete. Au moins on sait ou elle est.'),

  ('eclairage-loyola', 'mendoza', 11, false, 'La ligue de soccer du jeudi est touchee aussi. On finit a la lumiere des telephones.'),
  ('eclairage-loyola', 'petrescu', 30, false, 'Une minuterie saisonniere existe deja dans d''autres parcs, donc ca doit etre faisable ici.'),

  ('chantier-jean-brillant', 'kohn', 8, false, 'Le reglement fixe 7 h en semaine. Avant, c''est une infraction et ca se constate au 311.'),
  ('chantier-jean-brillant', 'okonkwo', 24, false, 'Merci, je ne savais pas que c''etait constatable. Je note les heures a partir de demain.'),

  ('queen-mary-nids', 'belkacem', 18, false, 'Les autocars de tourisme ralentissent maintenant a cet endroit, ce qui bloque toute la voie.'),

  ('poubelles-westbury', 'gauthier', 14, false, 'Il y en avait une devant le depanneur avant, elle a ete retiree et jamais remplacee.'),

  ('viaduc-falaise', 'oconnell', 10, false, 'Je fais le detour par Saint-Jacques le soir, ce qui est ironique parce que ce n''est pas mieux eclaire.'),
  ('viaduc-falaise', 'bergeron', 27, false, 'Le passage releve peut-etre du MTQ plutot que de l''arrondissement, ce qui expliquerait l''immobilisme.'),

  ('arbres-kent', 'nguyen', 12, false, 'Meme situation deux rues plus loin. L''elagage semble en retard partout cette annee.'),

  ('srrr-vezina', 'riveros', 9, false, 'La limite de zone suit une ancienne decoupe qui ne correspond plus a rien.'),

  ('loyers-udem', 'wexler', 7, false, 'Le tribunal administratif du logement publie des donnees par secteur, mais elles ont un an de retard.'),
  ('loyers-udem', 'whitfield', 19, false, 'Le comite logement tient ses propres statistiques et elles sont plus a jour. Ils repondent au telephone.');

insert into public.comments (issue_id, author_id, body, is_official, created_at)
select
  pg_temp.demo_id('issue:' || c.issue_key),
  pg_temp.demo_id('user:' || c.author),
  c.body,
  c.is_official,
  i.created_at + (c.hours_after || ' hours')::interval
from demo_comments c
join public.issues i on i.id = pg_temp.demo_id('issue:' || c.issue_key)
order by c.issue_key, c.hours_after;


-- 4. Les appuis --------------------------------------------------------------
--
-- Ecrits plutot que listes : trois cents lignes a la main n'apprendraient rien
-- a personne. Chaque signalement recoit sa cible d'appuis, distribuee sur les
-- residents par un hachage de (personne, signalement) — deterministe, donc la
-- meme pile de visages a chaque execution, et pas toujours les memes visages
-- d'un signalement a l'autre.
--
-- L'elue est exclue : un appui est une voix de resident, et la voir apparaitre
-- dans la pile de visages sous « 18 personnes soutiennent ce sujet » brouille
-- exactement la distinction que le drapeau « reponse officielle » etablit. Sa
-- position se lit dans ses reponses, pas dans un compteur.
--
-- L'auteur ne s'appuie pas lui-meme, et les dates sont etalees sur la duree de
-- vie du signalement pour que « appuye il y a deux jours » veuille dire quelque
-- chose — a partir de la plus tardive des deux dates, celle du signalement et
-- celle de l'inscription, sinon quelqu'un finit par avoir appuye un rapport
-- avant d'avoir eu un compte. issues.vote_count n'est pas touche : le
-- declencheur s'en charge.

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


-- 5. Les dossiers clos -------------------------------------------------------
--
-- Applique en dernier : une reponse officielle a deja fait passer ces
-- signalements de « ouvert » a « repondu » via le declencheur, et « regle » est
-- l'etat qu'ils ont atteint ensuite. Sans une liste ou tout est resolu et sans
-- une liste ou rien ne l'est, on ne voit pas a quoi servent les etiquettes.

update public.issues i
   set status = d.final_status
  from demo_issues d
 where i.id = pg_temp.demo_id('issue:' || d.key)
   and d.final_status is not null;
