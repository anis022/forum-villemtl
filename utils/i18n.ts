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
  | "passwordTooShort"
  | "passwordMismatch"
  | "badCredentials"
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
    forumDesc: "Discutez des enjeux de votre quartier et soutenez les sujets prioritaires.",
    projectsDesc: "Suivez l'avancement des chantiers et des projets en cours.",
    eventsDesc: "Repérez les activités et les événements à venir près de chez vous.",
    councilDesc: "Explorez ce qui a été dit lors des séances du conseil, avec liens vers la vidéo.",
  },
  council: {
    title: "Recherche dans les conseils d'arrondissement",
    intro:
      "Posez votre question en toutes lettres. La recherche porte sur la transcription des séances et renvoie les passages correspondants, avec le moment exact dans la vidéo.",
    searchLabel: "Rechercher dans les séances",
    searchPlaceholder: "ex. pistes cyclables sur Terrebonne, déneigement, tramway…",
    searchButton: "Rechercher",
    examplesLabel: "Essayez par exemple :",
    examples: ["pistes cyclables", "déneigement", "tramway", "logement", "sécurité routière"],
    corpusNote: (meetings: number, segments: number) =>
      `${meetings} séance${meetings > 1 ? "s" : ""} indexée${meetings > 1 ? "s" : ""}, ${segments} passages consultables.`,
    passageOne: "passage trouvé",
    passageMany: "passages trouvés",
    bothMatch: "Mots-clés + sens",
    lexicalOnly:
      "Recherche par mots-clés seulement — la recherche par sens est temporairement indisponible.",
    weakTitle: "Aucun passage ne correspond clairement à votre recherche.",
    weakBody:
      "Les passages ci-dessous sont les plus proches trouvés, mais ce sujet ne semble pas avoir été abordé dans les séances indexées. Vérifiez toujours la vidéo.",
    noResultsTitle: "Aucun passage trouvé",
    noResultsBody:
      "Reformulez avec d'autres mots. La recherche ne couvre que les séances déjà indexées.",
    emptyCorpusTitle: "Aucune séance indexée",
    emptyCorpusBody:
      "Les transcriptions n'ont pas encore été traitées. Revenez après l'exécution du pipeline d'ingestion.",
    topic: "Sujet",
    allTopics: "Tous les sujets",
    type: "Type d'intervention",
    allTypes: "Tous les types",
    range: "Période",
    apply: "Filtrer",
    types: {
      complaint: "Plaintes",
      question: "Questions",
      support: "Soutiens",
      info: "Informations",
      response: "Réponses",
    },
    ranges: {
      m3: "3 derniers mois",
      m6: "6 derniers mois",
      m12: "12 derniers mois",
      all: "Depuis le début",
    },
    roles: {
      resident: "Résident·e",
      councillor: "Conseiller·ère",
      mayor: "Maire·sse",
      staff: "Personnel",
      unknown: "Intervenant·e",
    },
    resultOne: "intervention",
    resultMany: "interventions",
    across: "réparties sur",
    meetingOne: "séance",
    meetingMany: "séances",
    byMeeting: "Par séance",
    watch: "Voir dans la vidéo",
    emptyTitle: "Aucune intervention trouvée",
    emptyBody: "Essayez un autre sujet, type ou une période plus longue.",
    noData:
      "Aucune séance n'a encore été indexée. Les données apparaîtront après l'exécution du pipeline d'ingestion.",
    disclaimer:
      "Les passages affichés proviennent des sous-titres automatiques de YouTube, qui comportent des erreurs de transcription — notamment sur les noms propres. Ce ne sont pas des verbatim officiels. Consultez toujours la vidéo pour vérifier les propos et leur contexte.",
  },
  events: {
    intro:
      "Les activités et événements en cours ou à venir dans Côte-des-Neiges–Notre-Dame-de-Grâce, situés sur la carte. Filtrez par district ou par type.",
    district: "District",
    allDistricts: "Tous les districts",
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
    free: "Gratuit",
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
    addComment: "Ajouter un commentaire",
    replyAsOfficial: "Répondre en tant qu'élu·e",
    officialHint:
      "Votre réponse sera identifiée comme officielle et le sujet passera à « Répondu ».",
    commentPlaceholder: "Votre message…",
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
      "L'endroit et la photo ne sont pas modifiables ici : les changer ferait un autre signalement. Retirez celui-ci et publiez-en un nouveau si l'endroit était erroné.",
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
  },
  profile: {
    topics: "Sujets",
    replies: "Réponses",
    backings: "Soutiens",
    changePhoto: "Changer la photo",
    removePhoto: "Retirer",
    photoHint: "JPEG, PNG ou WebP, 5 Mo maximum.",
    saving: "Envoi…",
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
    signInSubtitle: "Accédez à votre compte pour participer au forum.",
    forgotLink: "Mot de passe oublié?",
    forgotTitle: "Réinitialiser le mot de passe",
    forgotSubtitle:
      "Entrez votre courriel et nous vous enverrons un lien pour choisir un nouveau mot de passe.",
    submitReset: "Envoyer le lien",
    resetSentTitle: "Vérifiez vos courriels",
    resetSentBody:
      "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'y être envoyé. Le lien expire après une heure.",
    signUpSubtitle: "Créez un compte pour participer au forum.",
    firstName: "Prénom",
    lastName: "Nom",
    email: "Courriel",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    submitSignIn: "Se connecter",
    submitSignUp: "Créer mon compte",
    working: "Un instant…",
    noAccount: "Vous n'avez pas de compte?",
    hasAccount: "Vous avez déjà un compte?",
    checkEmailTitle: "Vérifiez vos courriels",
    checkEmailBody:
      "Nous vous avons envoyé un lien de confirmation. Cliquez sur ce lien pour activer votre compte, puis revenez vous connecter.",
    backToSignIn: "Retour à la connexion",
  },
  footer: {
    backToTop: "Haut de page",
    participate: "Participer",
    borough: "Arrondissement",
    follow: "Nous suivre",
    newWindow: "(nouvelle fenêtre)",
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
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères.",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
    badCredentials: "Courriel ou mot de passe invalide.",
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
    forumDesc: "Discuss issues in your neighbourhood and back the topics that matter.",
    projectsDesc: "Follow the progress of construction and current projects.",
    eventsDesc: "Find activities and upcoming events near you.",
    councilDesc: "Explore what was said at council meetings, with links to the video.",
  },
  council: {
    title: "Search borough council meetings",
    intro:
      "Ask in plain language. The search runs over meeting transcripts and returns matching passages, each linked to the exact moment in the video.",
    searchLabel: "Search the meetings",
    searchPlaceholder: "e.g. bike lanes on Terrebonne, snow removal, tramway…",
    searchButton: "Search",
    examplesLabel: "For example:",
    examples: ["bike lanes", "snow removal", "tramway", "housing", "road safety"],
    corpusNote: (meetings: number, segments: number) =>
      `${meetings} meeting${meetings > 1 ? "s" : ""} indexed, ${segments} passages searchable.`,
    passageOne: "passage found",
    passageMany: "passages found",
    bothMatch: "Keywords + meaning",
    lexicalOnly: "Keyword search only — meaning-based search is temporarily unavailable.",
    weakTitle: "Nothing clearly matches your search.",
    weakBody:
      "The passages below are the closest found, but this topic does not appear to have been discussed in the indexed meetings. Always check the video.",
    noResultsTitle: "No passages found",
    noResultsBody:
      "Try different wording. The search only covers meetings that have been indexed.",
    emptyCorpusTitle: "No meetings indexed",
    emptyCorpusBody:
      "Transcripts have not been processed yet. Check back once the ingestion pipeline has run.",
    topic: "Topic",
    allTopics: "All topics",
    type: "Intervention type",
    allTypes: "All types",
    range: "Period",
    apply: "Filter",
    types: {
      complaint: "Complaints",
      question: "Questions",
      support: "Support",
      info: "Information",
      response: "Responses",
    },
    ranges: {
      m3: "Last 3 months",
      m6: "Last 6 months",
      m12: "Last 12 months",
      all: "All time",
    },
    roles: {
      resident: "Resident",
      councillor: "Councillor",
      mayor: "Mayor",
      staff: "Staff",
      unknown: "Speaker",
    },
    resultOne: "intervention",
    resultMany: "interventions",
    across: "across",
    meetingOne: "meeting",
    meetingMany: "meetings",
    byMeeting: "By meeting",
    watch: "Watch in the video",
    emptyTitle: "No interventions found",
    emptyBody: "Try another topic, type, or a longer period.",
    noData:
      "No meetings have been indexed yet. Data will appear once the ingestion pipeline has run.",
    disclaimer:
      "Passages come from YouTube's automatic captions, which contain transcription errors — particularly on proper nouns. They are not official verbatim records. Always check the video to verify what was said and its context.",
  },
  events: {
    intro:
      "Activities and events happening now or soon in Côte-des-Neiges–Notre-Dame-de-Grâce, placed on the map. Filter by district or type.",
    district: "District",
    allDistricts: "All districts",
    type: "Activity type",
    allTypes: "All types",
    eventOne: "event",
    eventMany: "events",
    noneTitle: "No events",
    noneBody: "No events match these filters. Try another district or type.",
    details: "View details",
    online: "Online",
    unmapped: "with no location on the map",
    showAll: "Show all",
    free: "Free",
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
    addComment: "Add a comment",
    replyAsOfficial: "Reply as an elected official",
    officialHint:
      "Your reply will be marked as official and the topic will move to “Answered”.",
    commentPlaceholder: "Your message…",
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
      "The location and photo cannot be changed here: changing them would make this a different report. Withdraw this one and post a new one if the location was wrong.",
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
  },
  profile: {
    topics: "Topics",
    replies: "Replies",
    backings: "Support",
    changePhoto: "Change photo",
    removePhoto: "Remove",
    photoHint: "JPEG, PNG or WebP, 5 MB maximum.",
    saving: "Uploading…",
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
    signInSubtitle: "Access your account to take part in the forum.",
    forgotLink: "Forgot password?",
    forgotTitle: "Reset your password",
    forgotSubtitle:
      "Enter your email and we will send you a link to choose a new password.",
    submitReset: "Send the link",
    resetSentTitle: "Check your email",
    resetSentBody:
      "If an account exists for that address, a reset link has just been sent to it. The link expires after one hour.",
    signUpSubtitle: "Create an account to take part in the forum.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    submitSignIn: "Sign in",
    submitSignUp: "Create my account",
    working: "One moment…",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    checkEmailTitle: "Check your email",
    checkEmailBody:
      "We sent you a confirmation link. Click it to activate your account, then come back to sign in.",
    backToSignIn: "Back to sign in",
  },
  footer: {
    backToTop: "Back to top",
    participate: "Take part",
    borough: "Borough",
    follow: "Follow us",
    newWindow: "(opens in a new window)",
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
    passwordTooShort: "The password must be at least 8 characters.",
    passwordMismatch: "The passwords do not match.",
    badCredentials: "Invalid email or password.",
    locationRequired: "Point out the spot by clicking the map.",
    locationOutside:
      "That spot is outside Côte-des-Neiges–Notre-Dame-de-Grâce. Pick a point inside the borough.",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

/** fr-CA / en-CA so dates format per locale. */
export const dateLocale = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");
