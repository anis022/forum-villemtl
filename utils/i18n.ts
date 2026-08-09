// UI strings only. User-written content (issue titles, bodies, comments) is
// never translated — it is shown exactly as the author wrote it.

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** Error codes returned by server actions, translated at render time. */
export type ErrorCode =
  | "notSignedIn"
  | "titleTooShort"
  | "titleTooLong"
  | "bodyTooShort"
  | "bodyTooLong"
  | "badCategory"
  | "publishFailed"
  | "commentTooShort"
  | "commentTooLong"
  | "commentFailed"
  | "voteFailed"
  | "notAuthorized"
  | "imageType"
  | "imageTooBig"
  | "uploadFailed"
  | "nameRequired"
  | "emailInvalid"
  | "noAccount"
  | "codeInvalid"
  | "codeSendFailed"
  | "tooManyCodes"
  | "locationRequired"
  | "locationOutside";

const fr = {
  header: {
    menu: "Menu",
    search: "Recherche",
    closeMenu: "Fermer le menu",
    account: "Mon profil",
    signOut: "Se déconnecter",
    otherLanguage: "English",
  },
  nav: {
    sections: "Sections",
    forum: "Forum",
    projects: "État d'avancement des projets",
    events: "Carte des événements dans l'arrondissement",
    council: "Recherche dans les conseils d'arrondissement",
    officials: "Personnes élues de l'arrondissement",
    forumDesc: "Discutez des enjeux de votre quartier et soutenez les sujets prioritaires.",
    projectsDesc: "Suivez l'avancement des chantiers et des projets en cours.",
    eventsDesc: "Repérez les activités et les événements à venir près de chez vous.",
    councilDesc: "Explorez ce qui a été dit lors des séances du conseil, avec liens vers la vidéo.",
    officialsDesc: "Voyez qui vous représente, dans quel district, et comment les joindre.",
  },
  officials: {
    title: "Personnes élues de l'arrondissement",
    intro:
      "Voici l'équipe élue de Côte-des-Neiges–Notre-Dame-de-Grâce. C'est à elle que s'adressent les sujets publiés sur ce forum.",
    roles: {
      mayor: "Mairesse d'arrondissement",
      councillorF: "Conseillère de la Ville",
      councillorM: "Conseiller de la Ville",
    },
    district: (name: string) => `District de ${name}`,
    mandatesTitle: "Fonctions et mandats",
    sourceNote: "Liste vérifiée le 4 août 2026 auprès de",
  },
  council: {
    title: "Recherche dans les conseils d'arrondissement",
    intro:
      "Posez votre question en toutes lettres. La recherche croise les procès-verbaux officiels de l'arrondissement avec la transcription des enregistrements : elle vous dit combien de personnes ont abordé un sujet, qui elles sont, et à quel moment exact de la vidéo.",
    searchLabel: "Rechercher dans les séances",
    searchPlaceholder: "ex. trottoir sur Wilson, piste cyclable de Terrebonne, déneigement…",
    searchButton: "Rechercher",
    examplesLabel: "Essayez par exemple :",
    examples: [
      "piste cyclable de Terrebonne",
      "trottoir",
      "logement social",
      "déneigement",
      "sécurité aux abords des écoles",
    ],
    corpusNote: (meetings: number, questions: number, resolutions: number) =>
      `${meetings} séance${meetings > 1 ? "s" : ""} de 2026 — ${questions} interventions citoyennes et ${resolutions} résolutions, tirées des procès-verbaux officiels.`,

    // The filter residents asked for: what the public raised, or what the
    // council decided.
    sectionAll: "Tout",
    sectionQuestions: "Questions du public",
    sectionResolutions: "Ordre du jour et résolutions",
    modeAll: "Orales et écrites",
    modeOrale: "Questions orales",
    modeEcrite: "Questions écrites",
    badgeOrale: "Question orale",
    badgeEcrite: "Question écrite",

    // The headline. Phrased as a count of people, because that is the question
    // being asked — "how many people", not "how many passages".
    peopleCount: (n: number) =>
      n === 1 ? "1 personne a abordé ce sujet" : `${n} personnes ont abordé ce sujet`,
    acrossMeetings: (n: number) =>
      n === 1 ? "lors d'une séance" : `lors de ${n} séances`,
    interventionsCount: (n: number) =>
      n === 1 ? "1 intervention" : `${n} interventions`,
    resolutionsCount: (n: number) =>
      n === 1 ? "1 résolution correspond" : `${n} résolutions correspondent`,

    countedNote:
      "Ces personnes ont employé les mots recherchés. Chaque source renvoie au procès-verbal officiel et au moment exact de l'enregistrement.",
    relatedLabel: "Sujets proches",
    relatedNote:
      "Ces interventions ne contiennent pas les mots recherchés mais portent sur un sujet voisin. Elles ne sont pas comptées.",
    expandedNote: (expanded: string) => `Recherche élargie : ${expanded}`,

    subjectLabel: "Sujet inscrit au procès-verbal",
    verbatimLabel: "Ce qui a été dit",
    notAligned: "Moment non encore repéré dans l'enregistrement",
    watch: "Voir dans la vidéo",
    readPv: "Procès-verbal (PDF)",
    readOdj: "Ordre du jour (PDF)",
    movedBy: "Proposé par",
    secondedBy: "appuyé par",
    debate: "Débat",

    lexicalOnly:
      "Recherche par mots-clés seulement — la recherche par sens est temporairement indisponible. Le décompte, lui, est inchangé : il repose toujours sur les mots.",
    noResultsTitle: "Personne n'a abordé ce sujet",
    noResultsBody:
      "Aucune intervention ni résolution de 2026 ne contient ces mots. Reformulez, ou essayez un terme plus courant.",
    emptyCorpusTitle: "Aucune séance indexée",
    emptyCorpusBody:
      "Les procès-verbaux et les transcriptions n'ont pas encore été traités. Revenez après l'exécution du pipeline d'ingestion.",

    roles: {
      resident: "Résident·e",
      councillor: "Conseiller·ère",
      mayor: "Maire·sse",
      staff: "Personnel",
      unknown: "Intervenant·e",
    },
    disclaimer:
      "Les noms, les sujets et les résolutions proviennent des procès-verbaux publiés par l'arrondissement : ce sont des données officielles. Les extraits de paroles proviennent d'une transcription automatique de l'enregistrement, qui peut comporter des erreurs. Consultez la vidéo pour vérifier les propos et leur contexte.",
  },
  events: {
    intro:
      "Les activités et événements en cours ou à venir dans Côte-des-Neiges–Notre-Dame-de-Grâce, situés sur la carte. Cherchez-y, ou filtrez par date, par type et par emplacement.",
    mapLabel: "Carte des événements de l'arrondissement",
    searchPlaceholder: "Rechercher un événement, un lieu…",
    when: {
      all: "Tout",
      today: "Aujourd'hui",
      week: "7 prochains jours",
      month: "30 prochains jours",
    },
    settings: { outdoor: "À l'extérieur", indoor: "En salle", online: "En ligne" },
    allSettings: "Partout",
    // Autour d'un point : l'invitation, puis les distances une fois le point posé.
    nearbyHint: "Cliquez sur la carte pour voir ce qui se passe autour d'un endroit.",
    nearbyLabel: "Autour du point",
    nearbyClear: "Enlever le point",
    nearbyNoneTitle: "Rien à cet endroit",
    nearbyNoneBody:
      "Aucun événement dans ce rayon. Élargissez-le, ou cliquez ailleurs sur la carte.",
    todayPill: "Aujourd'hui",
    type: "Type d'activité",
    allTypes: "Tous les types",
    eventOne: "événement",
    eventMany: "événements",
    noneTitle: "Aucun événement",
    noneBody: "Aucun événement ne correspond à ces filtres. Essayez un autre district ou type.",
    details: "Voir la fiche",
    online: "En ligne",
    unmapped: "sans lieu sur la carte",
    showAll: "Tout afficher",
    showMore: "Afficher plus",
    emptyTitle: "Aucun événement chargé",
    emptyBody:
      "Les données n'ont pas encore été synchronisées. Revenez après l'exécution du script de synchronisation.",
    source:
      "Source : données ouvertes de la Ville de Montréal (événements publics), synchronisées quotidiennement. Le district est déterminé à partir des coordonnées, et le nom du lieu retrouvé à partir du parc contenant le point lorsque l'adresse est absente.",
  },
  pages: {
    projectsTitle: "État d'avancement des projets",
    projectsIntro:
      "Suivez l'avancement des chantiers et des projets en cours dans l'arrondissement.",
    eventsTitle: "Carte des événements dans l'arrondissement",
    eventsIntro: "Découvrez les événements à venir près de chez vous.",
    comingSoon: "Cette section sera bientôt disponible.",
  },
  projects: {
    back: "← Tous les projets",
    status: {
      study: "À l'étude",
      decided: "Décidé",
      underway: "En cours",
      done: "Terminé",
    },
    timeline: "Chronologie",
    photos: "Images",
    upcoming: "À venir",
    resolutionLabel: (number: string) => `Résolution ${number}`,
    atCouncil: "Au conseil d'arrondissement",
    // Le lien entre la fiche et le registre : ce que les gens ont demandé.
    raisedIntro: (people: number, sittings: number) =>
      `${people} ${people === 1 ? "personne a soulevé" : "personnes ont soulevé"} ce dossier à la période de questions, sur ${sittings} ${sittings === 1 ? "séance" : "séances"}.`,
    noResolutions:
      "Aucune résolution du conseil d'arrondissement ne porte sur ce dossier dans les séances indexées.",
    questionOrale: "Question orale",
    questionEcrite: "Question écrite",
    readMinutes: "Procès-verbal",
    sources: "Sources",
    credits: "Crédits photo",
    emptyTitle: "Aucun projet suivi pour l'instant",
    emptyBody:
      "Un projet apparaît ici lorsqu'il a une description, des images du lieu et une chronologie vérifiable. Les dossiers qui n'ont encore qu'une date ne sont pas listés.",
    milestoneCount: (n: number) => (n === 1 ? "1 étape" : `${n} étapes`),
  },
  home: {
    welcome: "Bienvenue sur le forum",
    title: "Échangez sur votre quartier et les services municipaux.",
    subtitle:
      "Cherchez si quelqu'un a déjà signalé ce qui vous préoccupe, suivez les dossiers en cours et soutenez les sujets qui comptent pour vous.",
    report: "Signaler un enjeu",
    ctaTitle: "Un problème dans votre quartier?",
    ctaBody:
      "Nid-de-poule, lampadaire brisé, ruelle mal entretenue : décrivez la situation en quelques minutes. Les sujets les plus soutenus par les résident·e·s sont traités en priorité par les élu·e·s.",
    signInPrompt: "Connectez-vous pour publier un sujet ou soutenir un enjeu.",
    topTitle: "Sujets les plus soutenus",
    showMore: "Afficher plus de sujets",
    newTitle: "Sujets récents",
    mapTitle: "Signalements sur la carte",
    sortTop: "Populaires",
    sortNew: "Récents",
    viewList: "Liste",
    viewMap: "Carte",
    mapAll: "Tous",
    mapOpen: "Non résolus",
    mapSettled: "Résolus",
    mapLocated: "sur la carte",
    mapUnlocated: "sans emplacement",
    mapEmpty: "Aucun signalement n'a encore d'emplacement sur la carte.",
    mapOpenIssue: "Voir le sujet",
    emptyTitle: "Aucun sujet pour le moment",
    emptyBody: "Soyez la première personne à signaler un enjeu dans votre quartier.",
    searchPlaceholder: "Que cherchez-vous?",
    noResultsTitle: "Aucun résultat",
    noResultsBody: "Essayez d'autres mots-clés ou consultez tous les sujets.",
    clearSearch: "Effacer la recherche",
    closeSearch: "Fermer la recherche",
    browseLabel: "Sujets fréquents",
    allCategories: "Tous les sujets",
    resultOne: "résultat",
    resultMany: "résultats",
  },
  issue: {
    back: "← Retour au forum",
    newTitle: "Signaler un enjeu",
    newSubtitle:
      "Décrivez la situation le plus précisément possible. Les autres citoyen·ne·s pourront soutenir votre sujet et les élu·e·s pourront y répondre.",
    fieldTitle: "Titre du sujet",
    fieldTitleHint: "Entre 5 et 150 caractères.",
    fieldTitlePlaceholder: "Ex. : Nids-de-poule sur la rue Sherbrooke",
    fieldCategory: "Catégorie",
    fieldBody: "Description",
    fieldBodyHint: "Au moins 20 caractères.",
    fieldBodyPlaceholder:
      "Décrivez la situation, l'endroit précis et son impact sur le quartier.",
    fieldLocation: "Endroit",
    locationHint: "Cliquez sur la carte pour indiquer où se trouve le problème.",
    locationChosen: "Endroit indiqué",
    locationUseMine: "Utiliser ma position",
    locationLocating: "Localisation…",
    locationOutside: "Cet endroit est hors de l'arrondissement.",
    locationDenied: "Position indisponible. Cliquez sur la carte à la place.",
    locationClear: "Effacer",
    fieldPhoto: "Photo",
    fieldPhotoOptional: "(facultatif)",
    fieldPhotoHint: "JPEG, PNG ou WebP, 5 Mo maximum.",
    photoPreviewAlt: "Aperçu de la photo sélectionnée",
    publish: "Publier le sujet",
    publishing: "Publication…",
    anonymousAuthor: "Citoyen·ne",
    replyOne: "réponse",
    replyMany: "réponses",
    noReplies: "Aucune réponse pour le moment.",
    showMoreReplies: "Afficher plus de réponses",
    // Le repli d'un fil trop profond : ce qu'on ouvre, et ce qu'on referme.
    expandThread: (n: number) =>
      n === 1 ? "Afficher 1 réponse" : `Afficher ${n} réponses`,
    collapseThread: "Masquer ce fil",
    addComment: "Ajouter un commentaire",
    replyAsOfficial: "Répondre en tant qu'élu·e",
    officialHint:
      "Votre réponse sera identifiée comme officielle et le sujet passera à « Répondu ».",
    commentPlaceholder: "Votre message…",
    reply: "Répondre",
    replyingTo: (name: string) => `Réponse à ${name}`,
    replyPlaceholder: "Votre réponse…",
    sendReply: "Répondre",
    cancelReply: "Annuler",
    send: "Publier",
    sending: "Envoi…",
    signInToComment: "Connectez-vous pour participer à la discussion.",
    officialAnswer: "Réponse officielle",
    officialSpace: "Espace élu·e",
    officialSpaceHint:
      "Vous pouvez changer l'état de ce sujet et publier une réponse officielle.",
    close: "Clore le sujet",
    reopen: "Rouvrir le sujet",
    photoAlt: "Photo jointe",
    share: "Partager",
    copied: "Lien copié",
    backToIssue: "← Retour au sujet",
    edit: "Modifier",
    editTitle: "Modifier le sujet",
    editSubtitle:
      "Corrigez le titre, la catégorie ou la description. L'historique du sujet indiquera qu'il a été modifié.",
    editLocationNote:
      "L'endroit n'est pas modifiable : l'épingle est ce que le signalement désigne, et la déplacer en ferait un autre. Retirez celui-ci et publiez-en un nouveau si l'endroit était erroné.",
    removePhoto: "Retirer la photo",
    photoWillBeRemoved: "La photo sera retirée à l'enregistrement.",
    undo: "Annuler",
    replacePhotoHint: "Choisissez un fichier pour remplacer la photo actuelle.",
    editOfficialWarning:
      "Vous modifiez le texte d'une autre personne à titre d'élu·e. La page indiquera publiquement que le sujet a été modifié par un·e élu·e.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    cancelEdit: "Annuler",
    editedByAuthor: (date: string) => `modifié le ${date}`,
    editedByOfficial: (date: string) => `modifié par un·e élu·e le ${date}`,
    withdraw: "Retirer",
    withdrawing: "Retrait…",
    withdrawConfirmTitle: "Retirer ce sujet?",
    withdrawConfirmBody:
      "Le sujet, ses réponses et ses soutiens seront supprimés définitivement. Cette action est irréversible.",
    withdrawConfirmYes: "Retirer définitivement",
    withdrawOfficialNote:
      "Ce sujet a été publié par une autre personne. Vous agissez ici à titre d'élu·e.",
    moderateNote:
      "Cette réponse a été publiée par une autre personne. Vous agissez ici à titre d'élu·e.",
    deleteReply: "Supprimer",
    deleteReplyTitle: "Supprimer cette réponse?",
    deleteReplyBody:
      "Les réponses qui y sont rattachées seront supprimées avec elle. Cette action est irréversible.",
    deleteReplyYes: "Supprimer définitivement",
    deleting: "Suppression…",
  },
  profile: {
    topics: "Sujets",
    replies: "Réponses",
    backings: "Soutiens",
    changePhoto: "Changer la photo",
    removePhoto: "Retirer",
    photoHint: "JPEG, PNG ou WebP, 5 Mo maximum.",
    saving: "Envoi…",
    aboutTitle: "À propos",
    yourActivity: "Votre activité",
    activityOf: (name: string) => `L'activité de ${name}`,
    joined: (date: string) => `Membre depuis le ${date}`,
    emptyTitle: "Rien pour le moment",
    emptyBodySelf:
      "Publiez un sujet, répondez ou soutenez un enjeu : votre activité apparaîtra ici.",
    emptyBodyOther: "Cette personne n'a pas encore participé au forum.",
    verbs: {
      issue: "a publié",
      comment: "a répondu dans",
      vote: "a soutenu",
    },
  },
  vote: {
    add: "Soutenir ce sujet",
    remove: "Retirer mon soutien",
    signInFirst: "Connectez-vous pour soutenir ce sujet",
    youAndOthers: (others: number) => {
      if (others <= 0) return "Vous soutenez ce sujet";
      const s = others > 1 ? "s" : "";
      return `Vous et ${others} autre${s} personne${s} soutenez ce sujet`;
    },
    othersSupport: (n: number) =>
      n === 1 ? "1 personne soutient ce sujet" : `${n} personnes soutiennent ce sujet`,
  },
  auth: {
    signIn: "Se connecter",
    signUp: "Créer un compte",
    firstName: "Prénom",
    lastName: "Nom",
    email: "Courriel",
    submitSignIn: "Continuer",
    submitSignUp: "Créer le compte",
    working: "Un instant…",
    noAccount: "Vous n'avez pas de compte?",
    hasAccount: "Vous avez déjà un compte?",
    codeTitle: "Code de vérification",
    codeSentTo: (email: string) => `Code envoyé à ${email}.`,
    codeLabel: "Code de vérification",
    submitCode: "Confirmer",
    resend: "Renvoyer le code",
    resendIn: (seconds: number) => `Renvoyer le code (${seconds} s)`,
    resendDone: "Nouveau code envoyé.",
    changeEmail: "Modifier l'adresse",
    backToSignIn: "Retour à la connexion",
  },
  footer: {
    backToTop: "Haut de page",
    participate: "Participer",
    sourceCode: "Code source",
    follow: "Nous suivre",
    newWindow: "(nouvelle fenêtre)",
  },
  translate: {
    action: "Traduire",
    original: "Voir l'original",
    working: "Traduction…",
    auto: "Traduction automatique",
    same: "Déjà en français",
    failed: "Traduction indisponible",
  },
  official: { badge: "Élu·e de la Ville de Montréal" },
  categories: {
    general: "Général",
    voirie: "Voirie",
    proprete: "Propreté",
    securite: "Sécurité",
    transport: "Transport",
    parcs: "Parcs et espaces verts",
    logement: "Logement",
  },
  statuses: { open: "Ouvert", answered: "Répondu", resolved: "Résolu" },
  errors: {
    notSignedIn: "Vous devez être connecté pour effectuer cette action.",
    titleTooShort: "Le titre doit contenir au moins 5 caractères.",
    titleTooLong: "Le titre ne peut pas dépasser 150 caractères.",
    bodyTooShort: "La description doit contenir au moins 20 caractères.",
    bodyTooLong: "La description ne peut pas dépasser 5000 caractères.",
    badCategory: "Veuillez choisir une catégorie valide.",
    publishFailed: "La publication a échoué. Veuillez réessayer.",
    commentTooShort: "Votre commentaire est trop court.",
    commentTooLong: "Votre commentaire ne peut pas dépasser 5000 caractères.",
    commentFailed: "L'envoi a échoué. Veuillez réessayer.",
    voteFailed: "Votre vote n'a pas pu être enregistré.",
    notAuthorized: "Vous n'êtes pas autorisé·e à modifier ce sujet.",
    imageType: "Formats acceptés : JPEG, PNG ou WebP.",
    imageTooBig: "L'image ne doit pas dépasser 5 Mo.",
    uploadFailed: "Le téléversement de l'image a échoué.",
    nameRequired: "Veuillez indiquer votre prénom et votre nom.",
    emailInvalid: "Veuillez saisir une adresse courriel valide.",
    noAccount: "Aucun compte n'est associé à cette adresse.",
    codeInvalid: "Code invalide ou expiré.",
    codeSendFailed: "L'envoi du code a échoué. Veuillez réessayer.",
    tooManyCodes: "Trop de demandes. Veuillez patienter une minute.",
    locationRequired: "Indiquez l'endroit sur la carte en cliquant dessus.",
    locationOutside:
      "Cet endroit est hors de Côte-des-Neiges–Notre-Dame-de-Grâce. Choisissez un point dans l'arrondissement.",
  },
};

export type Dictionary = typeof fr;

const en: Dictionary = {
  header: {
    menu: "Menu",
    search: "Search",
    closeMenu: "Close menu",
    account: "My profile",
    signOut: "Sign out",
    otherLanguage: "Français",
  },
  nav: {
    sections: "Sections",
    forum: "Forum",
    projects: "Project progress",
    events: "Map of events in the borough",
    council: "Search the borough council meetings",
    officials: "Your elected officials",
    forumDesc: "Discuss issues in your neighbourhood and back the topics that matter.",
    projectsDesc: "Follow the progress of construction and current projects.",
    eventsDesc: "Find activities and upcoming events near you.",
    councilDesc: "Explore what was said at council meetings, with links to the video.",
    officialsDesc: "See who represents you, in which district, and how to reach them.",
  },
  officials: {
    title: "Your elected officials",
    intro:
      "The elected team for Côte-des-Neiges–Notre-Dame-de-Grâce. They are who the topics posted on this forum are addressed to.",
    roles: {
      mayor: "Borough mayor",
      councillorF: "City councillor",
      councillorM: "City councillor",
    },
    district: (name: string) => `${name} district`,
    mandatesTitle: "Seats and mandates",
    sourceNote: "List checked on 4 August 2026 against",
  },
  council: {
    title: "Search borough council meetings",
    intro:
      "Ask in plain language. The search cross-references the borough's official minutes with a transcript of the recordings: it tells you how many people raised a subject, who they were, and the exact moment in the video.",
    searchLabel: "Search the meetings",
    searchPlaceholder: "e.g. sidewalk on Wilson, Terrebonne bike path, snow removal…",
    searchButton: "Search",
    examplesLabel: "For example:",
    examples: [
      "Terrebonne bike path",
      "sidewalk",
      "social housing",
      "snow removal",
      "safety around schools",
    ],
    corpusNote: (meetings: number, questions: number, resolutions: number) =>
      `${meetings} sitting${meetings > 1 ? "s" : ""} from 2026 — ${questions} resident interventions and ${resolutions} resolutions, taken from the official minutes.`,

    sectionAll: "Everything",
    sectionQuestions: "Public questions",
    sectionResolutions: "Agenda and resolutions",
    modeAll: "Spoken and written",
    modeOrale: "Spoken questions",
    modeEcrite: "Written questions",
    badgeOrale: "Spoken question",
    badgeEcrite: "Written question",

    peopleCount: (n: number) =>
      n === 1 ? "1 person raised this subject" : `${n} people raised this subject`,
    acrossMeetings: (n: number) =>
      n === 1 ? "at one sitting" : `across ${n} sittings`,
    interventionsCount: (n: number) =>
      n === 1 ? "1 intervention" : `${n} interventions`,
    resolutionsCount: (n: number) =>
      n === 1 ? "1 resolution matches" : `${n} resolutions match`,

    countedNote:
      "These people used the words you searched for. Every source links to the official minutes and to the exact moment in the recording.",
    relatedLabel: "Related subjects",
    relatedNote:
      "These interventions do not contain the words you searched for but cover a nearby subject. They are not counted.",
    expandedNote: (expanded: string) => `Search widened to: ${expanded}`,

    subjectLabel: "Subject as recorded in the minutes",
    verbatimLabel: "What was said",
    notAligned: "Moment not yet located in the recording",
    watch: "Watch in the video",
    readPv: "Minutes (PDF)",
    readOdj: "Agenda (PDF)",
    movedBy: "Moved by",
    secondedBy: "seconded by",
    debate: "Debate",

    lexicalOnly:
      "Keyword search only — meaning-based search is temporarily unavailable. The count is unaffected: it always rests on the words themselves.",
    noResultsTitle: "Nobody raised this subject",
    noResultsBody:
      "No 2026 intervention or resolution contains these words. Try rewording, or a more common term.",
    emptyCorpusTitle: "No sittings indexed",
    emptyCorpusBody:
      "The minutes and transcripts have not been processed yet. Check back once the ingestion pipeline has run.",

    roles: {
      resident: "Resident",
      councillor: "Councillor",
      mayor: "Mayor",
      staff: "Staff",
      unknown: "Speaker",
    },
    disclaimer:
      "Names, subjects and resolutions come from the minutes published by the borough: this is official data. Spoken excerpts come from an automatic transcript of the recording, which may contain errors. Check the video to verify what was said and its context.",
  },
  events: {
    intro:
      "Activities and events happening now or soon in Côte-des-Neiges–Notre-Dame-de-Grâce, placed on the map. Search them, or narrow by date, type and setting.",
    mapLabel: "Map of borough events",
    searchPlaceholder: "Search an event, a place…",
    when: {
      all: "All",
      today: "Today",
      week: "Next 7 days",
      month: "Next 30 days",
    },
    settings: { outdoor: "Outdoors", indoor: "Indoors", online: "Online" },
    allSettings: "Anywhere",
    nearbyHint: "Click the map to see what is on around a spot.",
    nearbyLabel: "Around the spot",
    nearbyClear: "Remove the spot",
    nearbyNoneTitle: "Nothing here",
    nearbyNoneBody:
      "No events within this radius. Widen it, or click somewhere else on the map.",
    todayPill: "Today",
    type: "Activity type",
    allTypes: "All types",
    eventOne: "event",
    eventMany: "events",
    noneTitle: "No events",
    noneBody: "No events match these filters. Try a wider date range, or clear the search.",
    details: "View details",
    online: "Online",
    unmapped: "with no location on the map",
    showAll: "Show all",
    showMore: "Show more",
    emptyTitle: "No events loaded",
    emptyBody:
      "Data has not been synced yet. Check back once the sync script has run.",
    source:
      "Source: City of Montréal open data (public events), synced daily. The district is derived from the coordinates, and the venue name resolved from the park containing the point when no address is given.",
  },
  pages: {
    projectsTitle: "Project progress",
    projectsIntro: "Follow the progress of construction and projects under way in the borough.",
    eventsTitle: "Map of events in the borough",
    eventsIntro: "Discover upcoming events near you.",
    comingSoon: "This section will be available soon.",
  },
  projects: {
    back: "← All projects",
    status: {
      study: "Under study",
      decided: "Decided",
      underway: "Under way",
      done: "Completed",
    },
    timeline: "Timeline",
    photos: "Images",
    upcoming: "Upcoming",
    resolutionLabel: (number: string) => `Resolution ${number}`,
    atCouncil: "At the borough council",
    raisedIntro: (people: number, sittings: number) =>
      `${people} ${people === 1 ? "person raised" : "people raised"} this at question period, across ${sittings} ${sittings === 1 ? "sitting" : "sittings"}.`,
    noResolutions:
      "No borough council resolution covers this file in the indexed sittings.",
    questionOrale: "Spoken question",
    questionEcrite: "Written question",
    readMinutes: "Minutes",
    sources: "Sources",
    credits: "Photo credits",
    emptyTitle: "No projects tracked yet",
    emptyBody:
      "A project appears here once it has a description, photographs of the place and a verifiable timeline. Files with only a single date are not listed.",
    milestoneCount: (n: number) => (n === 1 ? "1 milestone" : `${n} milestones`),
  },
  home: {
    welcome: "Welcome to the forum",
    title: "Discuss your neighbourhood and city services.",
    subtitle:
      "Check whether someone has already reported what is bothering you, follow open topics, and support the ones that matter to you.",
    report: "Report an issue",
    ctaTitle: "Something wrong in your neighbourhood?",
    ctaBody:
      "A pothole, a broken streetlight, an alley left untended: describe it in a couple of minutes. The topics residents support most are prioritized by elected officials.",
    signInPrompt: "Sign in to post a topic or support an issue.",
    topTitle: "Most-backed topics",
    showMore: "Show more topics",
    newTitle: "Recent topics",
    mapTitle: "Reports on the map",
    viewList: "List",
    viewMap: "Map",
    mapAll: "All",
    mapOpen: "Unresolved",
    mapSettled: "Resolved",
    mapLocated: "on the map",
    mapUnlocated: "without a location",
    mapEmpty: "No report has a location on the map yet.",
    mapOpenIssue: "Open the topic",
    sortTop: "Popular",
    sortNew: "Recent",
    emptyTitle: "No topics yet",
    emptyBody: "Be the first to report an issue in your neighbourhood.",
    searchPlaceholder: "What are you looking for?",
    noResultsTitle: "No results",
    noResultsBody: "Try different keywords or browse all topics.",
    clearSearch: "Clear search",
    closeSearch: "Close search",
    browseLabel: "Frequent topics",
    allCategories: "All topics",
    resultOne: "result",
    resultMany: "results",
  },
  issue: {
    back: "← Back to the forum",
    newTitle: "Report an issue",
    newSubtitle:
      "Describe the situation as precisely as possible. Other residents can back your topic and elected officials can reply to it.",
    fieldTitle: "Topic title",
    fieldTitleHint: "Between 5 and 150 characters.",
    fieldTitlePlaceholder: "E.g. Potholes on Sherbrooke Street",
    fieldCategory: "Category",
    fieldBody: "Description",
    fieldBodyHint: "At least 20 characters.",
    fieldBodyPlaceholder:
      "Describe the situation, the exact location and its impact on the neighbourhood.",
    fieldLocation: "Location",
    locationHint: "Click the map to show where the problem is.",
    locationChosen: "Location set",
    locationUseMine: "Use my location",
    locationLocating: "Locating…",
    locationOutside: "That spot is outside the borough.",
    locationDenied: "Location unavailable. Click the map instead.",
    locationClear: "Clear",
    fieldPhoto: "Photo",
    fieldPhotoOptional: "(optional)",
    fieldPhotoHint: "JPEG, PNG or WebP, 5 MB maximum.",
    photoPreviewAlt: "Preview of the selected photo",
    publish: "Publish topic",
    publishing: "Publishing…",
    anonymousAuthor: "Resident",
    replyOne: "reply",
    replyMany: "replies",
    noReplies: "No replies yet.",
    showMoreReplies: "Show more replies",
    expandThread: (n: number) => (n === 1 ? "Show 1 reply" : `Show ${n} replies`),
    collapseThread: "Hide this thread",
    addComment: "Add a comment",
    replyAsOfficial: "Reply as an elected official",
    officialHint:
      "Your reply will be marked as official and the topic will move to “Answered”.",
    commentPlaceholder: "Your message…",
    reply: "Reply",
    replyingTo: (name: string) => `Replying to ${name}`,
    replyPlaceholder: "Your reply…",
    sendReply: "Reply",
    cancelReply: "Cancel",
    send: "Post",
    sending: "Sending…",
    signInToComment: "Sign in to join the discussion.",
    officialAnswer: "Official answer",
    officialSpace: "Official area",
    officialSpaceHint: "You can change this topic's status and post an official reply.",
    close: "Close topic",
    reopen: "Reopen topic",
    photoAlt: "Attached photo",
    share: "Share",
    copied: "Link copied",
    backToIssue: "← Back to the topic",
    edit: "Edit",
    editTitle: "Edit the topic",
    editSubtitle:
      "Correct the title, category or description. The topic will show that it was edited.",
    editLocationNote:
      "The location cannot be changed: the pin is what the report points at, and moving it would make this a different report. Withdraw this one and post a new one if the location was wrong.",
    removePhoto: "Remove the photo",
    photoWillBeRemoved: "The photo will be removed when you save.",
    undo: "Undo",
    replacePhotoHint: "Choose a file to replace the current photo.",
    editOfficialWarning:
      "You are editing someone else's words as an elected official. The page will state publicly that the topic was edited by an official.",
    save: "Save",
    saving: "Saving…",
    cancelEdit: "Cancel",
    editedByAuthor: (date: string) => `edited on ${date}`,
    editedByOfficial: (date: string) => `edited by an official on ${date}`,
    withdraw: "Withdraw",
    withdrawing: "Withdrawing…",
    withdrawConfirmTitle: "Withdraw this topic?",
    withdrawConfirmBody:
      "The topic, its replies and its support will be deleted permanently. This cannot be undone.",
    withdrawConfirmYes: "Withdraw permanently",
    withdrawOfficialNote:
      "This topic was posted by someone else. You are acting here as an elected official.",
    moderateNote:
      "This reply was posted by someone else. You are acting here as an elected official.",
    deleteReply: "Delete",
    deleteReplyTitle: "Delete this reply?",
    deleteReplyBody:
      "Any replies attached to it will be deleted with it. This cannot be undone.",
    deleteReplyYes: "Delete permanently",
    deleting: "Deleting…",
  },
  profile: {
    topics: "Topics",
    replies: "Replies",
    backings: "Support",
    changePhoto: "Change photo",
    removePhoto: "Remove",
    photoHint: "JPEG, PNG or WebP, 5 MB maximum.",
    saving: "Uploading…",
    aboutTitle: "About",
    yourActivity: "Your activity",
    activityOf: (name: string) => `${name}'s activity`,
    joined: (date: string) => `Member since ${date}`,
    emptyTitle: "Nothing yet",
    emptyBodySelf:
      "Post a topic, reply, or back an issue and your activity will show up here.",
    emptyBodyOther: "This person has not taken part in the forum yet.",
    verbs: {
      issue: "posted",
      comment: "replied in",
      vote: "supported",
    },
  },
  vote: {
    add: "Support this topic",
    remove: "Remove my support",
    signInFirst: "Sign in to support this topic",
    youAndOthers: (others: number) => {
      if (others <= 0) return "You support this topic";
      return `You and ${others} other${others > 1 ? "s" : ""} support this topic`;
    },
    othersSupport: (n: number) =>
      n === 1 ? "1 person supports this topic" : `${n} people support this topic`,
  },
  auth: {
    signIn: "Sign in",
    signUp: "Create an account",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    submitSignIn: "Continue",
    submitSignUp: "Create account",
    working: "One moment…",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    codeTitle: "Verification code",
    codeSentTo: (email: string) => `Code sent to ${email}.`,
    codeLabel: "Verification code",
    submitCode: "Confirm",
    resend: "Resend code",
    resendIn: (seconds: number) => `Resend code (${seconds}s)`,
    resendDone: "New code sent.",
    changeEmail: "Change address",
    backToSignIn: "Back to sign in",
  },
  footer: {
    backToTop: "Back to top",
    participate: "Take part",
    sourceCode: "Source code",
    follow: "Follow us",
    newWindow: "(opens in a new window)",
  },
  translate: {
    action: "Translate",
    original: "See original",
    working: "Translating…",
    auto: "Automatic translation",
    same: "Already in English",
    failed: "Translation unavailable",
  },
  official: { badge: "Elected official, Ville de Montréal" },
  categories: {
    general: "General",
    voirie: "Roads",
    proprete: "Cleanliness",
    securite: "Safety",
    transport: "Transport",
    parcs: "Parks and green spaces",
    logement: "Housing",
  },
  statuses: { open: "Open", answered: "Answered", resolved: "Resolved" },
  errors: {
    notSignedIn: "You must be signed in to do that.",
    titleTooShort: "The title must be at least 5 characters.",
    titleTooLong: "The title cannot exceed 150 characters.",
    bodyTooShort: "The description must be at least 20 characters.",
    bodyTooLong: "The description cannot exceed 5000 characters.",
    badCategory: "Please choose a valid category.",
    publishFailed: "Publishing failed. Please try again.",
    commentTooShort: "Your comment is too short.",
    commentTooLong: "Your comment cannot exceed 5000 characters.",
    commentFailed: "Sending failed. Please try again.",
    voteFailed: "Your vote could not be recorded.",
    notAuthorized: "You are not allowed to modify this topic.",
    imageType: "Accepted formats: JPEG, PNG or WebP.",
    imageTooBig: "The image must not exceed 5 MB.",
    uploadFailed: "The image upload failed.",
    nameRequired: "Please enter your first and last name.",
    emailInvalid: "Please enter a valid email address.",
    noAccount: "No account is linked to that address.",
    codeInvalid: "Invalid or expired code.",
    codeSendFailed: "The code could not be sent. Please try again.",
    tooManyCodes: "Too many requests. Please wait one minute.",
    locationRequired: "Point out the spot by clicking the map.",
    locationOutside:
      "That spot is outside Côte-des-Neiges–Notre-Dame-de-Grâce. Pick a point inside the borough.",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

/** fr-CA / en-CA so dates format per locale. */
export const dateLocale = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");
