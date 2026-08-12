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
2. **Les modèles**, dans l'ordre de l'échelle ci-dessous, et seulement si cette
   adresse n'a pas déjà pris plus que sa part (5 questions par minute, 40 par
   jour).
3. **Le corpus lui-même**, sans modèle. Coût nul, aucun plafond, insensible à
   la charge.

L'étape 3 est inconditionnelle. **Tout échec au-dessus retombe dessus**, y
compris l'absence totale de clé. Il n'existe aucune situation où quelqu'un pose
une question et n'obtient rien.

## L'échelle des modèles

**Une dizaine de questions de test ont épuisé l'allocation gratuite du jour**
sur `gemini-3.6-flash`. Le site a tourné en repli depuis, ce qui valide la
conception et dit surtout que Google seul n'est pas tenable pour du public.

Le défaut n'est plus un modèle mais une liste, essayée dans l'ordre, définie
dans `COUNCIL_MODELS` (`utils/council-agent.ts`). Aucun autre endroit du code
ne nomme un modèle.

| Rang | Fournisseur | Ce que le palier gratuit compte | Clé |
| --- | --- | --- | --- |
| 1 | Mistral | ~1 G de jetons par **mois** | `MISTRAL_API_KEY` |
| 2 | au choix, compatible OpenAI | selon la maison | `COUNCIL_COMPATIBLE_*` |
| 3 | Google | quelques dizaines de requêtes par **jour** | `GOOGLE_GENERATIVE_AI_API_KEY` |

Mistral passe devant à cause de l'unité. Chez Google le palier se compte en
requêtes par jour, et une question d'ici n'est pas une requête : l'agent
cherche, recherche parfois, puis rédige. Chez Mistral il se compte en jetons par
mois, de l'ordre du milliard, soit la même question posée mille fois par jour au
lieu de dix. C'est aussi une maison qui écrit le français en première langue, ce
que sont ce corpus et cet arrondissement.

Le rang 2 est volontairement anonyme : une adresse, une clé, un identifiant de
modèle, les trois lus dans l'environnement (`COUNCIL_COMPATIBLE_BASE_URL`,
`COUNCIL_COMPATIBLE_API_KEY`, `COUNCIL_COMPATIBLE_MODEL_ID`). Tout palier
gratuit sérieux parle la forme d'OpenAI, donc glisser Groq, Cerebras ou
OpenRouter derrière cette page est trois réglages dans le tableau de bord, pas
un déploiement. Sans ces trois variables le rang est simplement sauté, et c'est
l'état livré.

Google reste, en dernier. Son allocation est petite mais elle se remplit à
minuit, sa clé est déjà posée, et un rang qui répond à une question sur dix vaut
mieux que pas de rang.

L'ordre lui-même est une variable, `COUNCIL_PROVIDERS`, par défaut
`mistral,compatible,google`.

### Ce que « descendre d'un rang » veut dire

Un palier épuisé se refuse **au début** d'une requête, pas au milieu. Donc un
rang qui échoue avant d'avoir écrit un mot n'a coûté au lecteur qu'une seconde,
et le rang suivant reçoit la même question. Dès que des mots sont partis, ce
n'est plus vrai : la page ajoute ce qui arrive, donc un deuxième rang écrirait
sa réponse à la suite de la demi-phrase du premier. À partir de là le seul geste
honnête est celui que la page fait déjà d'une réponse cassée, l'abandonner et
montrer les passages.

`maxRetries: 0` est posé dans la route. Par défaut le SDK réessayait trois fois,
et sur une erreur de quota les trois échouent à coup sûr en étant facturées :
une panne de quota coûtait quatre requêtes au lieu d'une, avant même de songer
au rang suivant.

Le cache et la limite par adresse restent les deux vraies défenses. Sur un
corpus figé et des questions qui se répètent, c'est le cache qui décidera si
l'allocation tient la journée.

## Les clés

À poser en production et dans `.env.local` :

```
npx vercel env add MISTRAL_API_KEY
```

Chez Mistral, le palier gratuit se sert par défaut des questions et des réponses
pour entraîner ses modèles. **Le couper** : console d'administration, menu
Privacy, section « Anonymous improvement data ». À faire avant d'ouvrir la page
au public : ce sont des questions de résidents sur leur rue.

**À faire : révoquer `GOOGLE_GENERATIVE_AI_API_KEY` et en générer une autre.**
Elle a été transmise en clair dans une conversation, donc elle est à considérer
comme divulguée. Remplacement :
`npx vercel env rm GOOGLE_GENERATIVE_AI_API_KEY production` puis
`npx vercel env add`, et la même ligne dans `.env.local`.

## La disposition

Conversation à gauche, appuis dans un panneau à droite. Les deux étaient dans
une seule colonne : trois lignes de prose, un filet, huit passages, puis la
question suivante. Chaque réponse poussait ses propres preuves entre elle et la
relance, donc un fil de trois questions faisait trente écrans.

Les deux colonnes sont **indépendantes** : la hauteur du panneau ne décide plus
d'où se trouve la boîte de question. C'est fait avec `display: contents` sur
l'enveloppe de gauche, qui se dissout sur téléphone pour que les trois éléments
deviennent frères et que `order` les range en échange, preuves, boîte. Une
grille ne peut pas faire ça : une cellule haute pousse sa voisine vers le bas.

Sur téléphone le panneau **arrive replié**. Déplié il fait quatre mille pixels
et enterre la boîte de question. Un `details` plutôt qu'un défilement interne :
sur téléphone un défilement imbriqué avale le glissement et la page semble
bloquée. Cliquer un marqueur déplie le panneau et y amène l'appui.

Le panneau montre les appuis de la dernière réponse. Une réponse plus ancienne
garde un bouton « Voir les N appuis » qui y ramène le panneau.

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
