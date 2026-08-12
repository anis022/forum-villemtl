# Onglet Conseils, état

État au 11 août 2026, déployé en production sur `cdnndg.vercel.app`. Le build
passe, le lint est propre sur les fichiers touchés. Rien n'est commité depuis
`05db353`.

## Ce que l'onglet est

Un chatbot, et rien d'autre. `/fr/conseils` et `/en/conseils` ouvrent sur une
question. La réponse arrive avec les passages qui l'appuient, la personne qui
les a dits, la date, et le moment exact dans la vidéo.

Ouvert à tout le monde, connecté ou non. Supprimés : la liste des séances, la
page d'une séance, les quatre cartes, `/conseils/recherche`, `corpusStats()`,
`agendaChapter()`, `isSection()`, et le vocabulaire i18n qui ne servait qu'à ces
pages.

## Gratuit, et conçu pour le rester

Contrainte posée explicitement : aucune dépense, jamais, et un nombre d'usagers
inconnu. Le gateway Vercel est écarté parce qu'il exige une carte même pour
dépenser ses propres crédits gratuits. Le modèle est donc appelé en direct chez
Google, avec une clé de développeur gratuite.

Un palier gratuit se compte en requêtes par jour pour tout le site, pas par
personne, et une question coûte plusieurs requêtes (chercher, parfois
rechercher, puis rédiger). La route est donc ordonnée par ce que chaque étape
coûte, pas par ce qu'elle produit :

1. **Une réponse déjà écrite**, servie depuis le cache. Coût nul. Le corpus est
   figé et les résidents posent les mêmes questions.
2. **Le modèle**, si cette adresse n'a pas déjà pris plus que sa part
   (5 questions par minute, 40 par jour).
3. **Le corpus lui-même**, sans modèle. Coût nul, aucun plafond, insensible à
   la charge.

L'étape 3 est inconditionnelle. **Tout échec au-dessus retombe dessus**, y
compris l'absence totale de clé. Il n'existe aucune situation où quelqu'un pose
une question et n'obtient rien.

## La clé

`GOOGLE_GENERATIVE_AI_API_KEY` est posée en production et dans `.env.local`.
La rédaction fonctionne, vérifiée en production en français et en anglais.

Si le palier gratuit cesse un jour de couvrir le modèle choisi, la correction
est la variable `COUNCIL_MODEL_ID` dans le tableau de bord, pas un déploiement.
Le défaut est `gemini-3.6-flash`. Aucun autre endroit du code ne nomme un
modèle.

**À faire : révoquer cette clé et en générer une autre.** Elle a été transmise
en clair dans une conversation, donc elle est à considérer comme divulguée.
Remplacement : `npx vercel env rm GOOGLE_GENERATIVE_AI_API_KEY production`
puis `npx vercel env add`, et la même ligne dans `.env.local`.

## Comment les sources tiennent

1. Chaque ligne renvoyée au modèle porte un numéro dans son champ `source`.
2. Le prompt oblige le modèle à écrire ce numéro entre crochets après la phrase
   qu'il appuie : « Trois personnes en ont parlé le 13 avril [2]. »
3. La route lit le texte fini, garde les seules sources dont le numéro y figure,
   et les renumérote dans l'ordre d'usage.
4. Le client remplace `[2]` par un lien vers l'appui.

Le modèle n'écrit donc jamais une URL, un nom ni une date de source : il choisit
dans une liste que le serveur a remplie. Un numéro inventé ne résout rien et
disparaît au rendu.

## La qualité de la rédaction

Gemini suit les consignes de style moins docilement que le modèle pour lequel le
prompt avait été écrit. Deux tours ont été nécessaires : il ouvrait sur « Au
total », disait « j'ai compté », et redonnait le même chiffre dans deux phrases.
Le prompt interdit maintenant ces tournures nommément.

Une règle n'a pas été laissée au modèle. Il cite toutes les lignes sur
lesquelles une phrase repose, y compris neuf d'un coup, parce qu'un chiffre
appuyé sur trois lignes laisse six personnes invérifiables. C'est **l'affichage**
qui replie : au-delà de trois marqueurs à la suite, `MAX_RUN` dans
`council-chat.tsx` affiche « 1 2 3 +6 », et les neuf restent dans la liste. Une
règle de mise en page tenue seulement par une consigne n'est pas une règle.

## Trois bugs de recherche corrigés au passage

Ils touchaient aussi l'ancienne recherche, et le repli les rendait visibles.

1. **`neige` retiré du dictionnaire de synonymes.** Le radical français de
   « neige » et de « Neiges » est le même, donc étendre une question sur le
   déneigement avec ce mot faisait correspondre le nom de l'arrondissement.
   Chaque passage disant « Côte-des-Neiges » revenait comme un résultat sur le
   déneigement, c'est-à-dire presque tous.
2. **La question est réduite à ses mots-clés** avant d'atteindre la recherche
   (`keywordsFrom`). « Qui a parlé de déneigement ? » cherchait aussi « parlé »,
   qui apparaît dans presque tous les passages de onze heures d'enregistrement.
3. **Le repli cherche en mots seulement**, décidé avant le classement et non
   après. Le classement fusionne mots et voisinage sémantique, et un voisin
   existe toujours : « cryptomonnaie et blockchain » renvoyait six passages
   confiants sur autre chose. Il renvoie maintenant zéro, ce qui est la vérité.
   C'est aussi le chemin le moins cher, puisqu'il ne charge aucun modèle
   d'embedding.

## À reprendre, dans l'ordre

1. **Remplacer la clé Google**, voir ci-dessus.
2. **`components/auth/account-button.tsx`.** Les contrôles du compte devraient
   être en indigo `#2a2a86` avec `font-nav`. Trois classes à remettre.
3. **Purger le cache après un ingest**, sinon une réponse d'avant la nouvelle
   séance survit un mois : `npx vercel cache invalidate --tag conseils-answers`.

## Problèmes de fond, pas encore réglés

**1. La fenêtre d'alignement contient la réponse du conseil.**
`scripts/py/align.py:405-413` va de l'appel du nom d'un résident jusqu'au nom
suivant, plafonnée à 600 s, donc elle contient la question **et** la réponse de
l'administration, sous le nom du résident. La vraie correction est de couper au
premier changement de locuteur et d'étiqueter les deux moitiés.

**2. 34 % des questions orales ne s'alignent pas.** Ces sources s'affichent avec
« Ce passage n'est pas repéré dans l'enregistrement ».

**3. Les remarques d'élus n'ont pas de `start_s`.**
`scripts/ingest/record.ts:341` n'en insère pas. 171 lignes sans rien à écouter.

**4. Aucun index par sujet, aucune page par personne.**

**5. Les migrations 0019 à 0021 n'ont pas été appliquées à la production.**
