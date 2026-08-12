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
  | "locationOutside"
  | "messageRefused";

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
    council: "Vos questions sur le conseil d'arrondissement",
    officials: "Personnes élues de l'arrondissement",
    forumDesc: "Discutez des enjeux de votre quartier et soutenez les sujets prioritaires.",
    projectsDesc: "Suivez l'avancement des chantiers et des projets en cours.",
    eventsDesc: "Repérez les activités et les événements à venir près de chez vous.",
    councilDesc: "Posez une question sur les séances et lisez le passage qui y répond, dans la vidéo.",
    officialsDesc: "Voyez qui vous représente, dans quel district, et comment les joindre.",
    // The inline navigation in the masthead is one line of six links; the long
    // labels above are what the mega-menu panel shows, where there is room to
    // say what each section actually is.
    short: {
      forum: "Forum",
      officials: "Élus",
      council: "Conseils",
      projects: "Projets",
      events: "Événements",
      moderation: "Modération",
    },
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
    // Copy rules for this whole block, learned the hard way: no em dashes, no
    // sentence built out of three items, and never explain how the search works
    // to someone who wants to know what the council said about their street.
    title: "Demandez ce qui s'est dit au conseil",
    intro:
      "Posez votre question en une phrase. La réponse arrive avec les passages qui l'appuient et le moment exact dans la vidéo de la séance.",

    emptyLead: "Demandez ce que vous chercheriez vous-même dans les procès-verbaux.",
    examples: [
      "Qui s'est plaint des parcomètres sur Sherbrooke ?",
      "Combien de personnes ont parlé de déneigement ?",
      "Qu'est-ce que le conseil a décidé sur le logement ?",
    ],
    placeholder: "Votre question",
    send: "Demander",
    sending: "En cours",
    hint: "Entrée pour envoyer, Maj et Entrée pour aller à la ligne.",

    // One quiet line while the model works, driven off the tool it just
    // started. Each says what is being read, never how the search works.
    thinking: "Je cherche dans les séances…",
    tools: {
      chercher_dans_les_enregistrements: "J'écoute les enregistrements…",
      chercher_questions_du_public: "Je regarde les questions du public…",
      chercher_resolutions: "Je lis les décisions du conseil…",
      chercher_interventions_elus: "Je regarde ce que les élus ont soulevé…",
      liste_des_seances: "Je parcours les séances…",
      detail_seance: "J'ouvre le détail de la séance…",
    },

    sources: "Ce sur quoi la réponse s'appuie",
    sourceNumber: (n: number) => `Appui ${n}`,
    moreSources: (n: number) => (n === 1 ? "1 appui de plus" : `${n} appuis de plus`),
    sourceCount: (n: number) => (n === 1 ? "Revoir l'appui" : `Revoir les ${n} appuis`),
    sourcesPlaceholder: "Les appuis de la réponse s'affichent ici, avec le passage et le moment dans la vidéo.",
    watch: "Voir dans la vidéo",
    readPv: "Procès-verbal (PDF)",
    noMoment: "Ce passage n'est pas repéré dans l'enregistrement.",
    kinds: {
      passage: "Ce qui a été dit",
      question: "Question du public",
      resolution: "Décision du conseil",
      remark: "Point soulevé par un élu",
      meeting: "Séance",
    },

    // Quand la rédaction n'a pas lieu, la recherche répond quand même. Ces
    // phrases disent ce qui manque sans faire porter au lecteur une panne qui
    // n'est pas la sienne, et sans promettre un retour à une heure inconnue.
    passagesTitle: "Ce que les archives contiennent",
    fallbackQuota:
      "Le service de rédaction a atteint sa limite gratuite du jour. La recherche, elle, reste ouverte : voici les passages où vos mots apparaissent.",
    fallbackLimit:
      "Plusieurs questions coup sur coup. Voici directement les passages où vos mots apparaissent.",
    fallbackError:
      "Je n'ai pas réussi à rédiger de réponse. Voici directement les passages où vos mots apparaissent.",
    nothingFound:
      "Ces mots n'apparaissent dans aucune séance enregistrée. Essayez un mot plus simple, ou le nom d'une rue.",

    network: "La demande n'a pas abouti. Réessayez.",
    errorGeneric: "La question n'a pas pu être traitée. Réessayez.",

    // Said once, at the foot of the page, where somebody who has read an answer
    // will meet it. Repeating it under every reply would train people to stop
    // seeing it.
    disclaimer:
      "Les réponses sont écrites par une machine à partir des procès-verbaux de l'arrondissement et de la transcription automatique des enregistrements. Le passage cité peut contenir des erreurs de transcription : avant de le reprendre, écoutez le moment dans la vidéo.",
  },
  events: {
    intro:
      "Les activités et événements en cours ou à venir dans Côte-des-Neiges–Notre-Dame-de-Grâce, situés sur la carte. Cherchez-y, ou filtrez par date, par type et par emplacement.",
    mapLabel: "Carte des événements de l'arrondissement",
    searchPlaceholder: "Rechercher un événement, un lieu…",
    filterWhen: "Date",
    filterSetting: "Emplacement",
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
  account: {
    heading: "Vos renseignements",
    downloadTitle: "Télécharger mes données",
    downloadBody:
      "Un fichier contenant tout ce que le forum détient sur vous : votre compte, votre profil, vos signalements, vos réponses et vos appuis.",
    download: "Télécharger",
    closeTitle: "Fermer mon compte",
    closeBody:
      "Votre courriel, votre nom et votre photo sont supprimés, et vos appuis retirés. Vos signalements et vos réponses restent en ligne mais ne portent plus votre nom, pour ne pas effacer les échanges auxquels d'autres ont participé. Retirez d'abord ceux que vous ne voulez pas laisser. C'est irréversible.",
    close: "Fermer mon compte",
    closing: "Fermeture…",
    confirmWord: "fermer",
    confirmPrompt: "Écrivez « fermer » pour confirmer.",
    confirmYes: "Fermer définitivement",
    cancel: "Annuler",
    failed: "La fermeture a échoué. Réessayez, ou écrivez à la personne responsable.",
  },
  privacy: {
    title: "Confidentialité",
    updated: "À jour au",
    contactHeading: "Exercer vos droits",
    contactBody:
      "Pour obtenir copie de vos renseignements, faire corriger une erreur, demander la révision d'un message refusé ou fermer votre compte, écrivez à la personne responsable de l'accès aux documents et de la protection des renseignements personnels.",
    contactMissing:
      "Les coordonnées de la personne responsable ne sont pas encore inscrites sur cette page. En attendant, adressez votre demande au bureau de l'arrondissement.",
    contactCai:
      "Si notre réponse ne vous satisfait pas, vous pouvez vous adresser à la Commission d'accès à l'information du Québec :",
  },
  moderation: {
    title: "Messages signalés",
    intro:
      "Ce que le filtre a laissé passer mais veut faire relire. Un message n'arrive ici qu'à cause des mots qu'il contient : c'est un soupçon, pas un verdict. Lisez-le en contexte avant de décider.",
    navLabel: "Modération",
    empty: "Rien en attente.",
    emptyBody: "Aucun message n'attend d'être relu.",
    forbidden: "Cette page est réservée aux personnes élues.",
    reportKind: "Sujet",
    replyKind: "Réponse",
    terms: "Mots repérés",
    open: "Lire en contexte",
    dismiss: "Laisser passer",
    dismissing: "En cours…",
    dismissHint:
      "Le message reste publié et sort de cette liste. Pour le retirer, ouvrez-le et supprimez-le.",
    waiting: (n: number) =>
      n === 1 ? "1 message en attente" : `${n} messages en attente`,
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
    report: "Signaler un enjeu",
    ctaTitle: "Un problème dans votre quartier?",
    signInPrompt: "Connectez-vous pour publier un sujet ou soutenir un enjeu.",
    topTitle: "Sujets les plus soutenus",
    topicsTitle: "Sujets",
    showMore: "Afficher plus de sujets",
    newTitle: "Sujets récents",
    mapTitle: "Signalements sur la carte",
    sortTop: "Populaires",
    sortNew: "Récents",
    sortLabel: "Trier par",
    viewList: "Liste",
    viewMap: "Carte",
    filters: "Filtres",
    filterCategories: "Catégories",
    resetFilters: "Réinitialiser",
    applyFilters: "Appliquer",
    filterStatuses: "Statut",
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
    activeMembers: "Membres actifs",
    popularCategories: "Catégories populaires",
    trending: "Tendances",
    discover: "À découvrir",
    contentEvent: "Événement",
    contentProject: "Projet",
    contributionCount: (n: number) => (n === 1 ? "1 contrib." : `${n} contrib.`),
    trafficCount: (n: number) => (n === 1 ? "1 consultation" : `${n} consultations`),
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
    // « Annuler » sort d'une confirmation de retrait, la seule qui reste.
    cancelEdit: "Annuler",
    collectionNotice:
      "Votre nom, le texte, la photo et l'épingle seront publics et resteront en ligne tant que vous ne les retirerez pas. Si vous publiez depuis chez vous, l'épingle indique où vous habitez.",
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
    collectionNotice:
      "Votre prénom et votre nom seront publics à côté de ce que vous publierez. Votre courriel sert uniquement à vous connecter et n'est jamais affiché.",
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
    tagline:
      "Un espace pour parler de Côte-des-Neiges–Notre-Dame-de-Grâce : soulevez un enjeu, appuyez celui d'une voisine ou d'un voisin, suivez ce que fait l'arrondissement.",
    // Said plainly and on every page, because the site used to wear the city's
    // masthead and someone who saw it then could reasonably still think so.
    legal: "Forum CDN-NDG, projet à code ouvert. Ce site n'est pas un service de la Ville de Montréal.",
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
    // Ce qui est refusé, et pourquoi — sans nommer les mots en cause, qui
    // seraient autant d'indications pour recommencer autrement.
    //
    // La deuxième phrase n'est pas de la politesse : le refus est décidé par un
    // traitement automatisé, et l'article 12.1 de la Loi 25 oblige à le dire au
    // moment de la décision et à ouvrir une porte vers une personne.
    messageRefused:
      "Ce message n'a pas été publié : un filtre automatique y a repéré des propos injurieux ou menaçants. Reformulez-le sans viser personne, ou demandez qu'une personne le relise. Voir la page Confidentialité.",
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
    council: "Your questions about the borough council",
    officials: "Your elected officials",
    forumDesc: "Discuss issues in your neighbourhood and back the topics that matter.",
    projectsDesc: "Follow the progress of construction and current projects.",
    eventsDesc: "Find activities and upcoming events near you.",
    councilDesc: "Ask about the meetings and read the passage that answers you, in the video.",
    officialsDesc: "See who represents you, in which district, and how to reach them.",
    short: {
      forum: "Forum",
      officials: "Officials",
      council: "Councils",
      projects: "Projects",
      events: "Events",
      moderation: "Moderation",
    },
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
    title: "Ask what was said at council",
    intro:
      "Ask your question in one sentence. The answer comes back with the passages behind it and the exact moment in the video of the meeting.",

    emptyLead: "Ask what you would go looking for in the minutes yourself.",
    examples: [
      "Who complained about the Sherbrooke parking meters?",
      "How many people raised snow clearing?",
      "What did the council decide about housing?",
    ],
    placeholder: "Your question",
    send: "Ask",
    sending: "Working",
    hint: "Enter to send, Shift and Enter for a new line.",

    thinking: "Looking through the meetings…",
    tools: {
      chercher_dans_les_enregistrements: "Listening to the recordings…",
      chercher_questions_du_public: "Reading the public question periods…",
      chercher_resolutions: "Reading the council's decisions…",
      chercher_interventions_elus: "Reading what the councillors raised…",
      liste_des_seances: "Going through the meetings…",
      detail_seance: "Opening the meeting…",
    },

    sources: "What this answer rests on",
    sourceNumber: (n: number) => `Source ${n}`,
    moreSources: (n: number) => (n === 1 ? "1 more source" : `${n} more sources`),
    sourceCount: (n: number) => (n === 1 ? "See the source again" : `See the ${n} sources again`),
    sourcesPlaceholder: "The sources behind an answer show up here, with the passage and the moment in the video.",
    watch: "Watch in the video",
    readPv: "Minutes (PDF)",
    noMoment: "This passage is not pinned to a moment in the recording.",
    kinds: {
      passage: "What was said",
      question: "Public question",
      resolution: "Council decision",
      remark: "Raised by a councillor",
      meeting: "Meeting",
    },

    passagesTitle: "What the archive holds",
    fallbackQuota:
      "The writing service has used up its free allowance for the day. The search has not: here are the passages where your words come up.",
    fallbackLimit:
      "Several questions in a row. Here are the passages where your words come up, straight from the archive.",
    fallbackError:
      "I could not write an answer. Here are the passages where your words come up, straight from the archive.",
    nothingFound:
      "These words do not come up in any recorded meeting. Try a simpler word, or a street name.",

    network: "The request did not go through. Try again.",
    errorGeneric: "The question could not be handled. Try again.",

    disclaimer:
      "Answers are machine-written from the borough's official minutes and from an automatic transcription of the recordings. A quoted passage may carry transcription mistakes, so listen to the moment in the video before repeating it.",
  },
  events: {
    intro:
      "Activities and events happening now or soon in Côte-des-Neiges–Notre-Dame-de-Grâce, placed on the map. Search them, or narrow by date, type and setting.",
    mapLabel: "Map of borough events",
    searchPlaceholder: "Search an event, a place…",
    filterWhen: "Date",
    filterSetting: "Setting",
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
  account: {
    heading: "Your information",
    downloadTitle: "Download my data",
    downloadBody:
      "A file with everything the forum holds about you: your account, your profile, your reports, your replies and your backing.",
    download: "Download",
    closeTitle: "Close my account",
    closeBody:
      "Your email, name and photo are deleted, and your backing withdrawn. Your reports and replies stay online but no longer carry your name, so the conversations other people took part in are not torn up. Withdraw the ones you do not want to leave behind first. This cannot be undone.",
    close: "Close my account",
    closing: "Closing…",
    confirmWord: "close",
    confirmPrompt: "Type “close” to confirm.",
    confirmYes: "Close permanently",
    cancel: "Cancel",
    failed: "Closing failed. Try again, or write to the responsible person.",
  },
  privacy: {
    title: "Privacy",
    updated: "Up to date as of",
    contactHeading: "Exercising your rights",
    contactBody:
      "To get a copy of your information, have an error corrected, ask for a refused message to be reviewed, or close your account, write to the person responsible for access to documents and the protection of personal information.",
    contactMissing:
      "The responsible person's contact details are not yet on this page. In the meantime, address your request to the borough office.",
    contactCai:
      "If our answer does not satisfy you, you can take it to the Commission d'accès à l'information du Québec:",
  },
  moderation: {
    title: "Flagged messages",
    intro:
      "What the filter let through but wants read again. A message lands here because of the words in it, which is a suspicion and not a verdict. Read it in context before deciding.",
    navLabel: "Moderation",
    empty: "Nothing waiting.",
    emptyBody: "No message is waiting to be read.",
    forbidden: "This page is for elected officials.",
    reportKind: "Topic",
    replyKind: "Reply",
    terms: "Words matched",
    open: "Read in context",
    dismiss: "Let it stand",
    dismissing: "Working…",
    dismissHint:
      "The message stays published and leaves this list. To take it down, open it and delete it.",
    waiting: (n: number) => (n === 1 ? "1 message waiting" : `${n} messages waiting`),
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
    report: "Report an issue",
    ctaTitle: "Something wrong in your neighbourhood?",
    signInPrompt: "Sign in to post a topic or support an issue.",
    topTitle: "Most-backed topics",
    topicsTitle: "Topics",
    showMore: "Show more topics",
    newTitle: "Recent topics",
    mapTitle: "Reports on the map",
    viewList: "List",
    viewMap: "Map",
    filters: "Filters",
    filterCategories: "Categories",
    resetFilters: "Reset",
    applyFilters: "Apply",
    filterStatuses: "Status",
    mapAll: "All",
    mapOpen: "Unresolved",
    mapSettled: "Resolved",
    mapLocated: "on the map",
    mapUnlocated: "without a location",
    mapEmpty: "No report has a location on the map yet.",
    mapOpenIssue: "Open the topic",
    sortTop: "Popular",
    sortNew: "Recent",
    sortLabel: "Sort by",
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
    activeMembers: "Active members",
    popularCategories: "Popular categories",
    trending: "Trending",
    discover: "Discover",
    contentEvent: "Event",
    contentProject: "Project",
    contributionCount: (n: number) => (n === 1 ? "1 contribution" : `${n} contributions`),
    trafficCount: (n: number) => (n === 1 ? "1 view" : `${n} views`),
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
    cancelEdit: "Cancel",
    collectionNotice:
      "Your name, the text, the photo and the pin will be public and stay online until you withdraw them. If you post from home, the pin says where you live.",
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
    collectionNotice:
      "Your first and last name will be public beside anything you post. Your email only signs you in and is never displayed.",
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
    tagline:
      "A place to talk about Côte-des-Neiges–Notre-Dame-de-Grâce: raise an issue, back a neighbour's, and follow what the borough is doing.",
    legal: "Forum CDN-NDG, an open-source project. This site is not a Ville de Montréal service.",
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
    messageRefused:
      "This message was not published: an automatic filter found abusive or threatening language in it. Rewrite it without targeting anyone, or ask for a person to review it. See the Privacy page.",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

/** fr-CA / en-CA so dates format per locale. */
export const dateLocale = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");
