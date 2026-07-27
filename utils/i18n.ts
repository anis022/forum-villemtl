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
  | "badCredentials";

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
    forumDesc: "Discutez des enjeux de votre quartier et appuyez les sujets prioritaires.",
    projectsDesc: "Suivez l'avancement des chantiers et des projets en cours.",
    eventsDesc: "Repérez les activités et les événements à venir près de chez vous.",
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
      "Signalez un enjeu, appuyez les sujets qui comptent pour vous. Les sujets les plus appuyés sont traités en priorité par les élu·e·s.",
    report: "Signaler un enjeu",
    signInPrompt: "Connectez-vous pour publier un sujet ou appuyer un enjeu.",
    topTitle: "Sujets les plus appuyés",
    newTitle: "Sujets récents",
    sortTop: "Populaires",
    sortNew: "Récents",
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
      "Décrivez la situation le plus précisément possible. Les autres citoyen·ne·s pourront appuyer votre sujet et les élu·e·s pourront y répondre.",
    fieldTitle: "Titre du sujet",
    fieldTitleHint: "Entre 5 et 150 caractères.",
    fieldTitlePlaceholder: "Ex. : Nids-de-poule sur la rue Sherbrooke",
    fieldCategory: "Catégorie",
    fieldBody: "Description",
    fieldBodyHint: "Au moins 20 caractères.",
    fieldBodyPlaceholder:
      "Décrivez la situation, l'endroit précis et son impact sur le quartier.",
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
  },
  vote: {
    add: "Appuyer ce sujet",
    remove: "Retirer mon appui",
    signInFirst: "Connectez-vous pour appuyer ce sujet",
  },
  auth: {
    signIn: "Se connecter",
    signUp: "Créer un compte",
    signInSubtitle: "Accédez à votre compte pour participer au forum.",
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
    forumDesc: "Discuss issues in your neighbourhood and back the topics that matter.",
    projectsDesc: "Follow the progress of construction and current projects.",
    eventsDesc: "Find activities and upcoming events near you.",
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
      "Report an issue and back the topics that matter to you. The most-backed topics are prioritized by elected officials.",
    report: "Report an issue",
    signInPrompt: "Sign in to post a topic or back an issue.",
    topTitle: "Most-backed topics",
    newTitle: "Recent topics",
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
  },
  vote: {
    add: "Back this topic",
    remove: "Remove my backing",
    signInFirst: "Sign in to back this topic",
  },
  auth: {
    signIn: "Sign in",
    signUp: "Create an account",
    signInSubtitle: "Access your account to take part in the forum.",
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
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

/** fr-CA / en-CA so dates format per locale. */
export const dateLocale = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");
