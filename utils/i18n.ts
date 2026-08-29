// UI strings only. User-written content (issue titles, bodies, comments) is
// never translated. It is shown exactly as the author wrote it.

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** Error codes returned by server actions, translated at render time. */
export type ErrorCode =
  /**
   * The submission never reached the server -- the device dropped off the
   * network mid-action, which on a phone in a basement or on the metro is an
   * ordinary Tuesday rather than an exceptional event.
   */
  | "networkFailed"
  | "notSignedIn"
  | "memberRequired"
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
  | "videoType"
  | "videoTooBig"
  | "videoTooLong"
  | "uploadFailed"
  | "emailInvalid"
  | "notMember"
  | "membershipExpired"
  | "codeInvalid"
  | "codeSendFailed"
  | "tooManyCodes"
  | "locationRequired"
  | "locationOutside"
  | "boroughUnknown"
  | "boroughFailed"
  | "pollQuestionTooShort"
  | "pollQuestionTooLong"
  | "pollDescriptionTooLong"
  | "pollOptionsCount"
  | "pollOptionEmpty"
  | "pollOptionTooLong"
  | "pollOptionDuplicate"
  | "pollPublishFailed"
  | "pollChoiceRequired"
  | "pollVoteFailed"
  | "pollKindInvalid"
  | "pollPinLimitInvalid"
  | "pollPinRequired"
  | "pollSettingMismatch"
  | "pollPinDescriptionTooLong"
  | "pollPinLimitReached"
  | "pollPinFailed"
  | "messageRefused";

const fr = {
  meta: {
    siteName: "Forum CDN-NDG",
    siteDescription:
      "Le forum des membres d'Ensemble Montréal dans Côte-des-Neiges–Notre-Dame-de-Grâce. Signalez un enjeu de quartier, suivez les projets et lisez ce que le conseil d'arrondissement y répond.",
  },
  header: {
    menu: "Menu",
    search: "Recherche",
    closeMenu: "Fermer le menu",
    account: "Mon profil",
    signOut: "Se déconnecter",
    otherLanguage: "English",
    beta: "Version bêta",
    betaShort: "Bêta",
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
      "L'équipe élue de Côte-des-Neiges–Notre-Dame-de-Grâce. Les sujets publiés sur ce forum lui sont adressés.",
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

    emptyLead: "Quelques questions pour commencer.",
    examples: [
      "Qui s'est plaint des parcomètres sur Sherbrooke ?",
      "Combien de personnes ont parlé de déneigement ?",
      "Qu'est-ce que le conseil a décidé sur le logement ?",
    ],
    placeholder: "Votre question",
    membersOnly: "Seuls les membres d’Ensemble Montréal peuvent envoyer une question.",
    membersOnlyPlaceholder: "Réservé aux membres d’Ensemble Montréal",
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
    // Said under an extract that carries a name but is not that person's words.
    // The recording runs from the moment the name is called to the next name,
    // so the borough's reply sits inside it and nothing separates the voices.
    aroundMoment: "Enregistrement à ce moment de la séance. On ne sait pas qui parle : la réponse de l'administration s'y trouve aussi.",
    moreSources: (n: number) => (n === 1 ? "1 appui de plus" : `${n} appuis de plus`),
    sourceCount: (n: number) => (n === 1 ? "Voir l'appui" : `Voir les ${n} appuis`),
    hideSources: "Replier",
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
      "Les activités et événements en cours ou à venir dans Côte-des-Neiges–Notre-Dame-de-Grâce, situés sur la carte. Cherchez-y, ou filtrez par date et par type.",
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
    boroughTitle: "Votre arrondissement",
    boroughBody:
      "L'arrondissement dont vous suivez les sujets, les projets et les séances du conseil.",
    // Dit une fois, sous le choix. Un seul arrondissement est ouvert et
    // quelqu'un qui n'y habite pas doit savoir pourquoi il ne se voit pas dans
    // la liste, plutôt que de croire le site cassé.
    boroughOnly:
      "Le forum ne couvre pour l'instant que Côte-des-Neiges–Notre-Dame-de-Grâce. D'autres arrondissements s'ajouteront à cette liste.",
    boroughSaved: "Arrondissement enregistré.",
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
    title: "Modération",
    intro:
      "Gérez les accès administrateurs et relisez les messages signalés depuis un seul espace réservé au cabinet.",
    navLabel: "Modération",
    accessTitle: "Accès administrateur",
    accessIntro:
      "Une adresse active peut ouvrir les outils internes, modérer le forum et publier les projets. Son compte devient administrateur dès que son adresse est confirmée.",
    accessEmail: "Adresse courriel",
    accessEmailPlaceholder: "prenom.nom@exemple.org",
    accessAdd: "Accorder l’accès",
    accessAdding: "Ajout…",
    accessActive: "Accès actif",
    accessSuspended: "Accès suspendu",
    accessYou: "Vous",
    accessElected: "Personne élue",
    accessFirstSignIn: "Le compte sera créé à la première connexion.",
    accessAccountReady: "Compte confirmé et accès administrateur appliqué.",
    accessConfirmationPending: "Le compte doit encore confirmer son adresse.",
    accessCurrentAccount: "Compte actuel",
    accessRemove: "Retirer l’accès",
    accessConfirmRemove: "Confirmer le retrait",
    accessRemoving: "Retrait…",
    accessRestore: "Réactiver",
    accessRestoring: "Réactivation…",
    accessGranted: (email: string) => `Accès accordé à ${email}.`,
    accessAlreadyGranted: (email: string) => `${email} avait déjà accès.`,
    accessRevoked: (email: string) => `Accès retiré à ${email}.`,
    accessRestored: (email: string) => `Accès réactivé pour ${email}.`,
    accessInvalidEmail: "Entrez une adresse courriel valide.",
    accessCannotRemoveSelf: "Vous ne pouvez pas retirer votre propre accès.",
    accessNotFound: "Cette adresse ne figure pas dans la liste des accès.",
    accessNotSignedIn: "Votre session a expiré. Reconnectez-vous pour continuer.",
    accessFailed: "La modification n’a pas pu être enregistrée.",
    messagesTitle: "Messages signalés",
    messagesIntro:
      "Ces messages sont publiés. Le filtre y a repéré des mots qui méritent une relecture. Lisez le message en contexte avant de décider.",
    empty: "Rien en attente.",
    emptyBody: "Aucun message n'attend d'être relu.",
    forbidden: "Cette page est réservée au cabinet de l'arrondissement.",
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
  notifications: {
    title: "Notifications",
    intro:
      "Ce que les résidentes et résidents publient sur le forum, du plus récent au plus ancien.",
    navLabel: "Notifications",
    open: "Ouvrir les notifications",
    unread: (n: number) =>
      n === 1 ? "1 notification non lue" : `${n} notifications non lues`,
    markAllRead: "Tout marquer comme lu",
    newBadge: "Nouveau",
    newTopic: (name: string) => `${name} a publié un nouveau sujet`,
    someone: "Une résidente ou un résident",
    empty: "Rien de nouveau.",
    emptyBody:
      "Vous verrez ici chaque sujet publié par une résidente ou un résident de l'arrondissement.",
    forbidden: "Cette page est réservée au cabinet de l'arrondissement.",
  },
  /**
   * The borough office's own screens for the projects page.
   *
   * Internal, and still translated: five of the nine people on `public.staff`
   * work in English every day, and a review queue in one language is a review
   * queue half the office reads slowly.
   */
  projectAdmin: {
    queueTitle: "Projets en attente",
    queueIntro:
      "Ce que le relevé automatique des séances a proposé, et ce que le cabinet a commencé à écrire. Rien ici n'est visible par les résidentes et résidents avant d'être publié.",
    empty: "Rien en attente.",
    fromCron: "Relevé automatique",
    fromStaff: "Écrit par le cabinet",
    newProject: "Nouveau projet",
    editProject: "Modifier ce projet",
    editing: "Modifie",
    creating: "Crée",
    incomplete: "Incomplet : il manque une photo, un texte dans les deux langues ou une deuxième date.",
    ready: "Prêt à publier",
    open: "Ouvrir",
    approve: "Publier",
    reject: "Écarter",
    save: "Enregistrer sans publier",
    saveAndPublish: "Enregistrer et publier",
    working: "Enregistrement…",
    visualEditor: "Modifier la fiche",
    visualEditorHint:
      "Modifiez directement ce que les citoyennes et citoyens verront, puis publiez lorsque la fiche est prête.",
    citizenPreview: "Aperçu de la fiche publique",
    editLanguage: "Langue du contenu à modifier",
    languageReady: "Cette langue semble complète",
    languageIncomplete: "Il reste du contenu à compléter dans cette langue",
    advanced: "Adresse de page et réglages avancés",
    basics: "L'essentiel",
    title: "Titre",
    summary: "Résumé",
    slug: "Adresse de la page",
    address: "Adresse municipale",
    addressPlaceholder: "5560, rue Sherbrooke Ouest",
    status: "Étape",
    titleFr: "Titre (français)",
    titleEn: "Titre (anglais)",
    summaryFr: "Résumé (français)",
    summaryEn: "Résumé (anglais)",
    descriptionLabel: "Description",
    paragraph: "Paragraphe",
    addParagraph: "Ajouter un paragraphe",
    emptyDescription: "Ajoutez un paragraphe pour présenter le projet.",
    photosLabel: "Photos",
    addPhoto: "Téléverser une photo",
    uploading: "Téléversement…",
    uploadFailed: "Téléversement impossible.",
    mainPhoto: "Image principale",
    galleryPhoto: "Galerie",
    emptyPhotos: "Ajoutez au moins une photo du lieu ou du projet.",
    photoCaption: "Légende",
    photoCredit: "Crédit et licence",
    milestonesLabel: "Dates",
    addMilestone: "Ajouter une date",
    milestoneOn: "Date (AAAA, AAAA-MM ou AAAA-MM-JJ)",
    milestoneDateLabel: "Date affichée",
    milestoneDateLabelPlaceholder: "Été 2026 (facultatif)",
    milestoneBody: "Détails",
    milestoneReferences: "Résolution et source de cette étape",
    milestoneResolution: "Résolution",
    addMilestoneSource: "Ajouter une source à cette étape",
    removeMilestoneSource: "Retirer cette source",
    emptyMilestones: "Ajoutez les dates qui racontent l'avancement du projet.",
    sourcesLabel: "Sources",
    addSource: "Ajouter une source",
    emptySources: "Ajoutez les liens qui permettent de vérifier la fiche.",
    sourceUrl: "Lien",
    label: "Intitulé",
    optional: "Facultatif",
    remove: "Retirer",
    moveUp: "Déplacer vers le haut",
    moveDown: "Déplacer vers le bas",
    councilTerm: "Mot à chercher dans le registre du conseil",
    whatTheCronRead: "Ce que le relevé a lu",
    onlyOffice: "Cette page est réservée au cabinet de l'arrondissement.",
  },
  errorPage: {
    title: "Cette page n'a pas pu s'afficher",
    body: "Quelque chose s'est mal passé de notre côté. Réessayez, ou revenez au forum.",
    retry: "Réessayer",
    home: "Retour au forum",
    reference: "Code de l'erreur",
    referenceHint: "Donnez ce code si vous nous signalez le problème.",
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
    timeline: "Avancement du projet",
    latestUpdate: "Dernière mise à jour",
    nextSteps: "Prochaines étapes",
    previousSteps: "Étapes précédentes",
    historyCount: (n: number, since: string) =>
      n === 1 ? `1 étape depuis ${since}` : `${n} étapes depuis ${since}`,
    about: "Le projet",
    viewProject: "Voir le projet",
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
      "Un projet apparaît ici une fois qu'il a une description et une chronologie vérifiable. Les dossiers qui n'ont encore qu'une date ne sont pas listés.",
    milestoneCount: (n: number) => (n === 1 ? "1 étape" : `${n} étapes`),
  },
  home: {
    welcome: "Bienvenue sur le forum",
    title: "Échangez sur votre quartier et les services municipaux.",
    report: "Signaler un enjeu",
    ctaTitle: "Un problème dans votre quartier?",
    signInPrompt:
      "Tout le monde peut lire le forum. Seuls les membres d’Ensemble Montréal peuvent publier, répondre ou soutenir un sujet.",
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
      "Décrivez la situation le plus précisément possible. Les autres citoyen·ne·s pourront soutenir votre sujet et le cabinet de l'arrondissement pourra y répondre.",
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
    fieldPhoto: "Photo ou vidéo",
    fieldPhotoOptional: "(facultatif)",
    fieldPhotoChoose: "Choisir un fichier",
    fieldPhotoHint:
      "Photo : JPEG, PNG ou WebP, 5 Mo maximum. Vidéo : MP4, WebM ou MOV, 60 secondes et 50 Mo maximum.",
    photoPreviewAlt: "Aperçu de la photo sélectionnée",
    mediaUploading: "Envoi de la vidéo",
    mediaUploaded: "Vidéo envoyée",
    mediaRemove: "Retirer",
    mediaWait: "Attendez la fin de l'envoi",
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
    replyAsOfficial: "Répondre au nom du cabinet",
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
    signInToComment:
      "Tout le monde peut lire la discussion. Seuls les membres d’Ensemble Montréal peuvent y répondre.",
    officialAnswer: "Réponse officielle",
    officialSpace: "Espace du cabinet",
    officialSpaceHint:
      "Vous pouvez changer l'état de ce sujet et publier une réponse officielle.",
    close: "Clore le sujet",
    reopen: "Rouvrir le sujet",
    photoAlt: "Photo jointe",
    videoAlt: "Vidéo jointe",
    // A .mov recorded by an iPhone is HEVC, which Safari plays and Chrome
    // and Firefox generally do not. Nothing here re-encodes it, so the honest
    // thing is to say so and hand over the file rather than show a dead frame.
    videoUnsupported: "Cette vidéo ne peut pas être lue dans votre navigateur.",
    videoOpen: "Ouvrir la vidéo",
    share: "Partager",
    copied: "Lien copié",
    backToIssue: "← Retour au sujet",
    // « Annuler » sort d'une confirmation de retrait, la seule qui reste.
    cancelEdit: "Annuler",
    collectionNotice:
      "Votre nom, le texte, la photo et l'épingle seront publics et resteront en ligne tant que vous ne les retirerez pas.",
    editedByAuthor: (date: string) => `modifié le ${date}`,
    editedByOfficial: (date: string) => `modifié par le cabinet le ${date}`,
    editPost: "Modifier",
    saveEdit: "Enregistrer les modifications",
    savingEdit: "Enregistrement…",
    editNote: "Les réponses déjà publiées restent en place. La date de modification s'affiche sous le sujet.",
    withdraw: "Retirer",
    withdrawing: "Retrait…",
    withdrawConfirmTitle: "Retirer ce sujet?",
    withdrawConfirmBody:
      "Le sujet, ses réponses et ses soutiens seront supprimés définitivement. Cette action est irréversible.",
    withdrawConfirmYes: "Retirer définitivement",
    withdrawOfficialNote:
      "Ce sujet a été publié par une autre personne. Vous agissez ici au nom du cabinet.",
    moderateNote:
      "Cette réponse a été publiée par une autre personne. Vous agissez ici au nom du cabinet.",
    deleteReply: "Supprimer",
    deleteReplyTitle: "Supprimer cette réponse?",
    deleteReplyBody:
      "Les réponses qui y sont rattachées seront supprimées avec elle. Cette action est irréversible.",
    deleteReplyYes: "Supprimer définitivement",
    deleting: "Suppression…",
  },
  poll: {
    label: "Sondage citoyen",
    ctaTitle: "Vous souhaitez plutôt consulter les citoyen·ne·s?",
    ctaBody: "Créez un sondage et recueillez l’avis des membres sur une question précise.",
    ctaButton: "Créer un sondage",
    backToForum: "← Retour au forum",
    backToPolls: "← Retour aux sondages",
    listTitle: "Sondages citoyens",
    listSubtitle:
      "Répondez aux questions publiées par l’équipe d’Ensemble Montréal et consultez les résultats en temps réel.",
    latestTitle: "Sondages citoyens",
    seeAll: "Voir tous les sondages",
    emptyTitle: "Aucun sondage pour le moment",
    emptyBody: "Les nouveaux sondages publiés par l’équipe apparaîtront ici.",
    newTitle: "Créer un sondage citoyen",
    newSubtitle:
      "Posez une question claire, puis choisissez un vote classique ou une consultation interactive sur la carte. Le sondage sera visible par tout le monde dès sa publication.",
    modeTitle: "Type de sondage",
    modeHint: "Choisissez la manière dont les membres pourront répondre.",
    choiceModeTitle: "Sondage classique",
    choiceModeBody: "Les citoyen·ne·s choisissent une réponse parmi votre liste.",
    mapModeTitle: "Sondage sur la carte",
    mapModeBody: "Les citoyen·ne·s répondent en déposant un point à un endroit précis.",
    questionLabel: "Question du sondage",
    questionPlaceholder: "Ex. : Quelle amélioration devrait être priorisée dans ce parc?",
    descriptionLabel: "Contexte",
    optional: "(facultatif)",
    descriptionPlaceholder: "Ajoutez les renseignements utiles pour aider les citoyen·ne·s à répondre.",
    choicesTitle: "Choix de réponse",
    choicesHint: "Ajoutez entre 2 et 10 choix. Leur ordre sera conservé.",
    choiceLabel: (n: number) => `Choix ${n}`,
    choicePlaceholder: "Écrivez un choix de réponse",
    addChoice: "Ajouter un choix",
    removeChoice: "Retirer ce choix",
    editChoices: "Modifier les choix",
    saveChoices: "Enregistrer les choix",
    cancelEdit: "Annuler",
    editWarning:
      "Renommer un choix garde ses votes. Retirer un choix supprime les votes qui lui ont été donnés.",
    removeKeepsNoVotes: (n: number) =>
      n === 1 ? "Retirer ce choix supprimera 1 vote" : `Retirer ce choix supprimera ${n} votes`,
    mapSettingsTitle: "Personnaliser les points sur la carte",
    mapSettingsHint:
      "Décidez exactement ce que les citoyen·ne·s pourront joindre à chaque point.",
    allowPinDescriptionTitle: "Autoriser une description",
    allowPinDescriptionBody: "Un court texte pourra expliquer pourquoi cet endroit est choisi.",
    allowPinImageTitle: "Autoriser une photo",
    allowPinImageBody: "Une image pourra être jointe au point et sera optimisée en WebP.",
    maxPinsTitle: "Points permis par membre",
    maxPinsBody: "Limite le nombre de contributions qu’une même personne peut déposer.",
    maxPinsChoice: (n: number) => (n === 1 ? "1 point" : `${n} points`),
    publish: "Publier le sondage",
    publishing: "Publication…",
    collectionNotice:
      "La question, le contexte et les résultats agrégés seront publics. Le choix individuel de chaque membre ne sera jamais affiché publiquement.",
    votes: (n: number) => (n === 1 ? "1 vote" : `${n} votes`),
    mapResponses: (n: number) => (n === 1 ? "1 point citoyen" : `${n} points citoyens`),
    open: "Voir et voter",
    resultsTitle: "Résultats",
    chooseTitle: "Votre réponse",
    submitVote: "Enregistrer mon vote",
    updateVote: "Modifier mon vote",
    voting: "Enregistrement…",
    selected: "Votre choix",
    membersOnly:
      "Les résultats sont publics. Seuls les membres d’Ensemble Montréal peuvent voter.",
    mapMembersOnly:
      "Tout le monde peut consulter la carte. Seuls les membres d’Ensemble Montréal peuvent y ajouter un point.",
    changeHint: "Vous pouvez modifier votre choix en tout temps.",
    noVotes: "Aucun vote pour le moment.",
    addPinConfirm: "Ajouter ce point?",
    addPinTitle: "Ajouter votre point",
    addPinBody: "Cliquez sur la carte pour indiquer l’endroit qui répond à la question.",
    pinLocation: "Emplacement",
    pinDescriptionLabel: "Description du point",
    pinDescriptionPlaceholder: "Expliquez brièvement votre choix…",
    pinPhotoLabel: "Photo du point",
    pinPhotoChoose: "Choisir une photo",
    pinPhotoHint: "JPEG, PNG ou WebP, 5 Mo maximum. Conversion automatique en WebP.",
    submitPin: "Ajouter ce point",
    submittingPin: "Ajout…",
    mapEmpty: "Aucun point n’a encore été ajouté sur cette carte.",
    mapContributionsTitle: "Contributions citoyennes",
    contributionLabel: "Point citoyen",
    noPinDetails: "Aucun détail ajouté.",
    pinAllowance: (current: number, max: number) =>
      max === 1
        ? "Vous pouvez ajouter un point à ce sondage."
        : `Vous avez ajouté ${current} point${current > 1 ? "s" : ""} sur ${max}.`,
    pinLimitNotice: "Vous avez atteint la limite de points prévue pour ce sondage.",
    mapPublicNotice:
      "L’emplacement, la description et la photo ajoutés à un point sont publics. Votre nom n’est pas affiché avec la contribution.",
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
      "Votre activité apparaîtra ici dès que vous aurez publié ou répondu.",
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
    signInFirst: "Réservé aux membres d’Ensemble Montréal",
    youAndOthers: (others: number) => {
      if (others <= 0) return "Vous soutenez ce sujet";
      const s = others > 1 ? "s" : "";
      return `Vous et ${others} autre${s} personne${s} soutenez ce sujet`;
    },
    othersSupport: (n: number) =>
      n === 1 ? "1 personne soutient ce sujet" : `${n} personnes soutiennent ce sujet`,
    additionalSupport: (n: number) =>
      n === 1 ? "+1 personne soutient ce sujet" : `+${n} personnes soutiennent ce sujet`,
  },
  auth: {
    signIn: "Se connecter",
    email: "Courriel",
    submitSignIn: "Continuer",
    // Replaces the sign-up form's notice. There is no form to consent at any
    // more, so the sentence says where the name came from instead of who typed
    // it, which is the fact a member would otherwise have to guess at.
    collectionNotice:
      "Réservé aux membres d'Ensemble Montréal dans CDN-NDG. Votre compte se crée à la première connexion, au nom de votre adhésion, qui sera public. Votre courriel n'est jamais affiché.",
    working: "Un instant…",
    codeTitle: "Code de vérification",
    codeSentTo: (email: string) => `Code envoyé à ${email}.`,
    codeLabel: "Code de vérification",
    submitCode: "Confirmer",
    resend: "Renvoyer le code",
    resendIn: (seconds: number) => `Renvoyer le code (${seconds} s)`,
    resendDone: "Nouveau code envoyé.",
    changeEmail: "Modifier l'adresse",
  },
  footer: {
    backToTop: "Haut de page",
    participate: "Participer",
    sourceCode: "Code source",
    follow: "Nous suivre",
    newWindow: "(nouvelle fenêtre)",
    tagline:
      "Un espace pour parler de Côte-des-Neiges–Notre-Dame-de-Grâce. Soulevez un enjeu, ou appuyez celui d'une voisine ou d'un voisin.",
  },
  translate: {
    action: "Traduire",
    original: "Voir l'original",
    working: "Traduction…",
    auto: "Traduction automatique",
    same: "Déjà en français",
    failed: "Traduction indisponible",
  },
  // Deux marques, parce que neuf personnes répondent ici et que quatre
  // seulement siègent. La coche disait « Élu·e » à côté de tout le monde, ce
  // qui, pour les cinq du cabinet, était une charge publique attribuée à des
  // personnes qui ne l'occupent pas.
  official: {
    badge: "Élu·e de la Ville de Montréal",
    staffBadge: "Cabinet de l'arrondissement de Côte-des-Neiges–Notre-Dame-de-Grâce",
  },
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
    memberRequired: "Cette action est réservée aux membres d’Ensemble Montréal.",
    titleTooShort: "Le titre doit contenir au moins 5 caractères.",
    titleTooLong: "Le titre ne peut pas dépasser 150 caractères.",
    bodyTooShort: "La description doit contenir au moins 20 caractères.",
    bodyTooLong: "La description ne peut pas dépasser 5000 caractères.",
    badCategory: "Veuillez choisir une catégorie valide.",
    networkFailed: "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez, votre texte est encore là.",
    publishFailed: "La publication a échoué. Veuillez réessayer.",
    commentTooShort: "Votre commentaire est trop court.",
    commentTooLong: "Votre commentaire ne peut pas dépasser 5000 caractères.",
    commentFailed: "L'envoi a échoué. Veuillez réessayer.",
    voteFailed: "Votre vote n'a pas pu être enregistré.",
    notAuthorized: "Vous n'êtes pas autorisé·e à modifier ce sujet.",
    imageType: "Formats acceptés : JPEG, PNG ou WebP.",
    imageTooBig: "L'image ne doit pas dépasser 5 Mo.",
    videoType: "Formats vidéo acceptés : MP4, WebM ou MOV.",
    videoTooBig: "La vidéo ne doit pas dépasser 50 Mo.",
    videoTooLong: "La vidéo ne doit pas dépasser 60 secondes.",
    uploadFailed: "Le téléversement a échoué.",
    emailInvalid: "Veuillez saisir une adresse courriel valide.",
    // Says which address was refused and where to go about it. "Adresse non
    // reconnue" would leave someone rereading their own typing with no idea
    // whether the problem is the address or the membership behind it.
    notMember:
      "Cette adresse ne figure pas parmi les membres d'Ensemble Montréal CDN-NDG. Utilisez l'adresse fournie lors de votre adhésion, ou écrivez au cabinet pour la faire corriger.",
    membershipExpired:
      "Votre adhésion est échue. Renouvelez-la pour retrouver l'accès au forum.",
    codeInvalid: "Code invalide ou expiré.",
    codeSendFailed: "L'envoi du code a échoué. Veuillez réessayer.",
    tooManyCodes: "Trop de demandes. Veuillez patienter une minute.",
    locationRequired: "Indiquez l'endroit sur la carte en cliquant dessus.",
    locationOutside:
      "Cet endroit est hors de Côte-des-Neiges–Notre-Dame-de-Grâce. Choisissez un point dans l'arrondissement.",
    boroughUnknown: "Cet arrondissement n'est pas encore couvert par le forum.",
    boroughFailed: "Votre arrondissement n'a pas pu être enregistré. Réessayez.",
    pollQuestionTooShort: "La question doit contenir au moins 5 caractères.",
    pollQuestionTooLong: "La question ne peut pas dépasser 200 caractères.",
    pollDescriptionTooLong: "Le contexte ne peut pas dépasser 2000 caractères.",
    pollOptionsCount: "Ajoutez entre 2 et 10 choix de réponse.",
    pollOptionEmpty: "Chaque choix de réponse doit contenir du texte.",
    pollOptionTooLong: "Un choix de réponse ne peut pas dépasser 120 caractères.",
    pollOptionDuplicate: "Chaque choix de réponse doit être différent.",
    pollPublishFailed: "La publication du sondage a échoué. Veuillez réessayer.",
    pollChoiceRequired: "Choisissez une réponse avant d’enregistrer votre vote.",
    pollVoteFailed: "Votre vote n’a pas pu être enregistré. Veuillez réessayer.",
    pollKindInvalid: "Choisissez un type de sondage valide.",
    pollPinLimitInvalid: "Choisissez une limite de 1 à 10 points par membre.",
    pollPinRequired: "Ajoutez un point en cliquant sur la carte.",
    pollSettingMismatch: "Cette contribution contient un élément désactivé par le sondage.",
    pollPinDescriptionTooLong: "La description du point ne peut pas dépasser 1000 caractères.",
    pollPinLimitReached: "Vous avez atteint la limite de points pour ce sondage.",
    pollPinFailed: "Le point n’a pas pu être ajouté. Veuillez réessayer.",
    // Ce qui est refusé, et pourquoi, sans nommer les mots en cause, qui
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
  meta: {
    siteName: "Forum CDN-NDG",
    siteDescription:
      "The forum for Ensemble Montréal members in Côte-des-Neiges–Notre-Dame-de-Grâce. Report a neighbourhood issue, follow the projects, and read what the borough council says back.",
  },
  header: {
    menu: "Menu",
    search: "Search",
    closeMenu: "Close menu",
    account: "My profile",
    signOut: "Sign out",
    otherLanguage: "Français",
    beta: "Beta version",
    betaShort: "Beta",
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

    emptyLead: "A few questions to start with.",
    examples: [
      "Who complained about the Sherbrooke parking meters?",
      "How many people raised snow clearing?",
      "What did the council decide about housing?",
    ],
    placeholder: "Your question",
    membersOnly:
      "Answers remain visible to everyone. Only Ensemble Montréal members can send a question.",
    membersOnlyPlaceholder: "For Ensemble Montréal members",
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
    aroundMoment: "The recording at this point in the sitting. Who is speaking is not known: the borough's reply is in here too.",
    moreSources: (n: number) => (n === 1 ? "1 more source" : `${n} more sources`),
    sourceCount: (n: number) => (n === 1 ? "See the source" : `See the ${n} sources`),
    hideSources: "Fold away",
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
      "Activities and events happening now or soon in Côte-des-Neiges–Notre-Dame-de-Grâce, placed on the map. Search them, or narrow by date and type.",
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
    boroughTitle: "Your borough",
    boroughBody: "The borough whose topics, projects and council meetings you follow.",
    boroughOnly:
      "The forum only covers Côte-des-Neiges–Notre-Dame-de-Grâce for now. More boroughs will join this list.",
    boroughSaved: "Borough saved.",
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
    title: "Moderation",
    intro:
      "Manage administrator access and review flagged messages from one private office workspace.",
    navLabel: "Moderation",
    accessTitle: "Administrator access",
    accessIntro:
      "An active address can open internal tools, moderate the forum and publish projects. Its account becomes an administrator as soon as the address is confirmed.",
    accessEmail: "Email address",
    accessEmailPlaceholder: "first.last@example.org",
    accessAdd: "Grant access",
    accessAdding: "Adding…",
    accessActive: "Active access",
    accessSuspended: "Access suspended",
    accessYou: "You",
    accessElected: "Elected official",
    accessFirstSignIn: "The account will be created on first sign-in.",
    accessAccountReady: "Confirmed account with administrator access.",
    accessConfirmationPending: "The account still needs to confirm its address.",
    accessCurrentAccount: "Current account",
    accessRemove: "Remove access",
    accessConfirmRemove: "Confirm removal",
    accessRemoving: "Removing…",
    accessRestore: "Restore",
    accessRestoring: "Restoring…",
    accessGranted: (email: string) => `Access granted to ${email}.`,
    accessAlreadyGranted: (email: string) => `${email} already had access.`,
    accessRevoked: (email: string) => `Access removed from ${email}.`,
    accessRestored: (email: string) => `Access restored for ${email}.`,
    accessInvalidEmail: "Enter a valid email address.",
    accessCannotRemoveSelf: "You cannot remove your own access.",
    accessNotFound: "That address is not in the access list.",
    accessNotSignedIn: "Your session has expired. Sign in again to continue.",
    accessFailed: "The change could not be saved.",
    messagesTitle: "Flagged messages",
    messagesIntro:
      "These messages are published. The filter spotted words worth a second read. Read the message in context before deciding.",
    empty: "Nothing waiting.",
    emptyBody: "No message is waiting to be read.",
    forbidden: "This page is for the borough office.",
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
  notifications: {
    title: "Notifications",
    intro: "What residents publish on the forum, newest first.",
    navLabel: "Notifications",
    open: "Open notifications",
    unread: (n: number) =>
      n === 1 ? "1 unread notification" : `${n} unread notifications`,
    markAllRead: "Mark all as read",
    newBadge: "New",
    newTopic: (name: string) => `${name} published a new topic`,
    someone: "A resident",
    empty: "Nothing new.",
    emptyBody: "Every topic published by a resident of the borough shows up here.",
    forbidden: "This page is for the borough office.",
  },
  projectAdmin: {
    queueTitle: "Projects waiting",
    queueIntro:
      "What the automatic reading of the sittings proposed, and what the office has started writing. Nothing here is visible to residents until it is published.",
    empty: "Nothing waiting.",
    fromCron: "Read from the record",
    fromStaff: "Written by the office",
    newProject: "New project",
    editProject: "Edit this project",
    editing: "Edits",
    creating: "Creates",
    incomplete: "Incomplete: a photo, text in both languages or a second date is missing.",
    ready: "Ready to publish",
    open: "Open",
    approve: "Publish",
    reject: "Set aside",
    save: "Save without publishing",
    saveAndPublish: "Save and publish",
    working: "Saving…",
    visualEditor: "Edit the project page",
    visualEditorHint:
      "Edit what residents will see directly, then publish when the page is ready.",
    citizenPreview: "Public page preview",
    editLanguage: "Content language to edit",
    languageReady: "This language looks complete",
    languageIncomplete: "Some content still needs to be completed in this language",
    advanced: "Page address and advanced settings",
    basics: "The basics",
    title: "Title",
    summary: "Summary",
    slug: "Page address",
    address: "Street address",
    addressPlaceholder: "5560 Sherbrooke Street West",
    status: "Stage",
    titleFr: "Title (French)",
    titleEn: "Title (English)",
    summaryFr: "Summary (French)",
    summaryEn: "Summary (English)",
    descriptionLabel: "Description",
    paragraph: "Paragraph",
    addParagraph: "Add a paragraph",
    emptyDescription: "Add a paragraph to introduce the project.",
    photosLabel: "Photos",
    addPhoto: "Upload a photo",
    uploading: "Uploading…",
    uploadFailed: "Upload failed.",
    mainPhoto: "Main image",
    galleryPhoto: "Gallery",
    emptyPhotos: "Add at least one photo of the place or project.",
    photoCaption: "Caption",
    photoCredit: "Credit and licence",
    milestonesLabel: "Dates",
    addMilestone: "Add a date",
    milestoneOn: "Date (YYYY, YYYY-MM or YYYY-MM-DD)",
    milestoneDateLabel: "Displayed date",
    milestoneDateLabelPlaceholder: "Summer 2026 (optional)",
    milestoneBody: "Details",
    milestoneReferences: "Resolution and source for this milestone",
    milestoneResolution: "Resolution",
    addMilestoneSource: "Add a source to this milestone",
    removeMilestoneSource: "Remove this source",
    emptyMilestones: "Add the dates that tell the project's progress.",
    sourcesLabel: "Sources",
    addSource: "Add a source",
    emptySources: "Add links residents can use to verify this page.",
    sourceUrl: "Link",
    label: "Label",
    optional: "Optional",
    remove: "Remove",
    moveUp: "Move up",
    moveDown: "Move down",
    councilTerm: "Word to look for in the council record",
    whatTheCronRead: "What the reading found",
    onlyOffice: "This page is for the borough office.",
  },
  errorPage: {
    title: "This page could not be shown",
    body: "Something went wrong on our side. Try again, or go back to the forum.",
    retry: "Try again",
    home: "Back to the forum",
    reference: "Error code",
    referenceHint: "Quote this code if you report the problem to us.",
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
    timeline: "Project progress",
    latestUpdate: "Latest update",
    nextSteps: "Next steps",
    previousSteps: "Previous steps",
    historyCount: (n: number, since: string) =>
      n === 1 ? `1 milestone since ${since}` : `${n} milestones since ${since}`,
    about: "About the project",
    viewProject: "View project",
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
      "A project appears here once it has a description and a verifiable timeline. Files with only a single date are not listed.",
    milestoneCount: (n: number) => (n === 1 ? "1 milestone" : `${n} milestones`),
  },
  home: {
    welcome: "Welcome to the forum",
    title: "Discuss your neighbourhood and city services.",
    report: "Report an issue",
    ctaTitle: "Something wrong in your neighbourhood?",
    signInPrompt:
      "Everyone can read the forum. Only Ensemble Montréal members can post, reply, or support a topic.",
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
      "Describe the situation as precisely as possible. Other residents can back your topic and the borough office can reply to it.",
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
    fieldPhoto: "Photo or video",
    fieldPhotoOptional: "(optional)",
    fieldPhotoChoose: "Choose file",
    fieldPhotoHint:
      "Photo: JPEG, PNG or WebP, 5 MB maximum. Video: MP4, WebM or MOV, 60 seconds and 50 MB maximum.",
    photoPreviewAlt: "Preview of the selected photo",
    mediaUploading: "Uploading video",
    mediaUploaded: "Video uploaded",
    mediaRemove: "Remove",
    mediaWait: "Wait for the upload to finish",
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
    replyAsOfficial: "Reply for the borough office",
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
    signInToComment:
      "Everyone can read the discussion. Only Ensemble Montréal members can reply.",
    officialAnswer: "Official answer",
    officialSpace: "Official area",
    officialSpaceHint: "You can change this topic's status and post an official reply.",
    close: "Close topic",
    reopen: "Reopen topic",
    photoAlt: "Attached photo",
    videoAlt: "Attached video",
    videoUnsupported: "This video cannot be played in your browser.",
    videoOpen: "Open the video",
    share: "Share",
    copied: "Link copied",
    backToIssue: "← Back to the topic",
    cancelEdit: "Cancel",
    collectionNotice:
      "Your name, the text, the photo and the pin will be public and stay online until you withdraw them.",
    editedByAuthor: (date: string) => `edited on ${date}`,
    editedByOfficial: (date: string) => `edited by an official on ${date}`,
    editPost: "Edit",
    saveEdit: "Save changes",
    savingEdit: "Saving…",
    editNote: "Replies already posted stay where they are. The date of the change is shown under the topic.",
    withdraw: "Withdraw",
    withdrawing: "Withdrawing…",
    withdrawConfirmTitle: "Withdraw this topic?",
    withdrawConfirmBody:
      "The topic, its replies and its support will be deleted permanently. This cannot be undone.",
    withdrawConfirmYes: "Withdraw permanently",
    withdrawOfficialNote:
      "This topic was posted by someone else. You are acting here for the borough office.",
    moderateNote:
      "This reply was posted by someone else. You are acting here for the borough office.",
    deleteReply: "Delete",
    deleteReplyTitle: "Delete this reply?",
    deleteReplyBody:
      "Any replies attached to it will be deleted with it. This cannot be undone.",
    deleteReplyYes: "Delete permanently",
    deleting: "Deleting…",
  },
  poll: {
    label: "Citizen poll",
    ctaTitle: "Would you rather consult residents?",
    ctaBody: "Create a poll and gather members’ views on a specific question.",
    ctaButton: "Create a poll",
    backToForum: "← Back to the forum",
    backToPolls: "← Back to polls",
    listTitle: "Citizen polls",
    listSubtitle:
      "Answer questions published by the Ensemble Montréal team and see results in real time.",
    latestTitle: "Citizen polls",
    seeAll: "See all polls",
    emptyTitle: "No polls yet",
    emptyBody: "New polls published by the team will appear here.",
    newTitle: "Create a citizen poll",
    newSubtitle:
      "Ask a clear question, then choose a classic vote or an interactive map consultation. The poll will be visible to everyone as soon as it is published.",
    modeTitle: "Poll type",
    modeHint: "Choose how members will be able to answer.",
    choiceModeTitle: "Classic poll",
    choiceModeBody: "Residents choose one answer from your list.",
    mapModeTitle: "Map poll",
    mapModeBody: "Residents answer by placing a point at a specific location.",
    questionLabel: "Poll question",
    questionPlaceholder: "E.g. Which improvement should be prioritized in this park?",
    descriptionLabel: "Context",
    optional: "(optional)",
    descriptionPlaceholder: "Add any useful information that will help residents answer.",
    choicesTitle: "Answer choices",
    choicesHint: "Add between 2 and 10 choices. Their order will be preserved.",
    choiceLabel: (n: number) => `Choice ${n}`,
    choicePlaceholder: "Write an answer choice",
    addChoice: "Add a choice",
    removeChoice: "Remove this choice",
    editChoices: "Edit the choices",
    saveChoices: "Save the choices",
    cancelEdit: "Cancel",
    editWarning:
      "Renaming a choice keeps its votes. Removing a choice deletes the votes cast for it.",
    removeKeepsNoVotes: (n: number) =>
      n === 1 ? "Removing this choice will delete 1 vote" : `Removing this choice will delete ${n} votes`,
    mapSettingsTitle: "Customize map points",
    mapSettingsHint: "Decide exactly what residents may attach to each point.",
    allowPinDescriptionTitle: "Allow a description",
    allowPinDescriptionBody: "A short text may explain why this place was selected.",
    allowPinImageTitle: "Allow a photo",
    allowPinImageBody: "An image may be attached to the point and will be optimized as WebP.",
    maxPinsTitle: "Points allowed per member",
    maxPinsBody: "Limits how many contributions the same person may place.",
    maxPinsChoice: (n: number) => (n === 1 ? "1 point" : `${n} points`),
    publish: "Publish poll",
    publishing: "Publishing…",
    collectionNotice:
      "The question, context and aggregate results will be public. Each member’s individual choice will never be displayed publicly.",
    votes: (n: number) => (n === 1 ? "1 vote" : `${n} votes`),
    mapResponses: (n: number) => (n === 1 ? "1 resident point" : `${n} resident points`),
    open: "View and vote",
    resultsTitle: "Results",
    chooseTitle: "Your answer",
    submitVote: "Save my vote",
    updateVote: "Change my vote",
    voting: "Saving…",
    selected: "Your choice",
    membersOnly: "Results are public. Only Ensemble Montréal members can vote.",
    mapMembersOnly:
      "Everyone can view the map. Only Ensemble Montréal members can add a point.",
    changeHint: "You may change your choice at any time.",
    noVotes: "No votes yet.",
    addPinConfirm: "Add this point?",
    addPinTitle: "Add your point",
    addPinBody: "Click the map to indicate the place that answers the question.",
    pinLocation: "Location",
    pinDescriptionLabel: "Point description",
    pinDescriptionPlaceholder: "Briefly explain your choice…",
    pinPhotoLabel: "Point photo",
    pinPhotoChoose: "Choose a photo",
    pinPhotoHint: "JPEG, PNG or WebP, 5 MB maximum. Automatically converted to WebP.",
    submitPin: "Add this point",
    submittingPin: "Adding…",
    mapEmpty: "No point has been added to this map yet.",
    mapContributionsTitle: "Resident contributions",
    contributionLabel: "Resident point",
    noPinDetails: "No details added.",
    pinAllowance: (current: number, max: number) =>
      max === 1
        ? "You may add one point to this poll."
        : `You have added ${current} point${current === 1 ? "" : "s"} out of ${max}.`,
    pinLimitNotice: "You have reached the point limit set for this poll.",
    mapPublicNotice:
      "The location, description and photo added to a point are public. Your name is not displayed with the contribution.",
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
      "Your activity will show up here once you have posted or replied.",
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
    signInFirst: "For Ensemble Montréal members only",
    youAndOthers: (others: number) => {
      if (others <= 0) return "You support this topic";
      return `You and ${others} other${others > 1 ? "s" : ""} support this topic`;
    },
    othersSupport: (n: number) =>
      n === 1 ? "1 person supports this topic" : `${n} people support this topic`,
    additionalSupport: (n: number) =>
      n === 1 ? "+1 person supports this topic" : `+${n} people support this topic`,
  },
  auth: {
    signIn: "Sign in",
    email: "Email",
    submitSignIn: "Continue",
    collectionNotice:
      "For Ensemble Montréal members in CDN-NDG. Your account is created on first sign-in, under the name on your membership, which will be public. Your email is never shown.",
    working: "One moment…",
    codeTitle: "Verification code",
    codeSentTo: (email: string) => `Code sent to ${email}.`,
    codeLabel: "Verification code",
    submitCode: "Confirm",
    resend: "Resend code",
    resendIn: (seconds: number) => `Resend code (${seconds}s)`,
    resendDone: "New code sent.",
    changeEmail: "Change address",
  },
  footer: {
    backToTop: "Back to top",
    participate: "Take part",
    sourceCode: "Source code",
    follow: "Follow us",
    newWindow: "(opens in a new window)",
    tagline:
      "A place to talk about Côte-des-Neiges–Notre-Dame-de-Grâce. Raise an issue, or back a neighbour's.",
  },
  translate: {
    action: "Translate",
    original: "See original",
    working: "Translating…",
    auto: "Automatic translation",
    same: "Already in English",
    failed: "Translation unavailable",
  },
  official: {
    badge: "Elected official, Ville de Montréal",
    staffBadge: "Borough office, Côte-des-Neiges–Notre-Dame-de-Grâce",
  },
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
    memberRequired: "This action is reserved for Ensemble Montréal members.",
    titleTooShort: "The title must be at least 5 characters.",
    titleTooLong: "The title cannot exceed 150 characters.",
    bodyTooShort: "The description must be at least 20 characters.",
    bodyTooLong: "The description cannot exceed 5000 characters.",
    badCategory: "Please choose a valid category.",
    networkFailed: "That did not go through. Check your connection and try again -- your text is still here.",
    publishFailed: "Publishing failed. Please try again.",
    commentTooShort: "Your comment is too short.",
    commentTooLong: "Your comment cannot exceed 5000 characters.",
    commentFailed: "Sending failed. Please try again.",
    voteFailed: "Your vote could not be recorded.",
    notAuthorized: "You are not allowed to modify this topic.",
    imageType: "Accepted formats: JPEG, PNG or WebP.",
    imageTooBig: "The image must not exceed 5 MB.",
    videoType: "Accepted video formats: MP4, WebM or MOV.",
    videoTooBig: "The video must not exceed 50 MB.",
    videoTooLong: "The video must not exceed 60 seconds.",
    uploadFailed: "The upload failed.",
    emailInvalid: "Please enter a valid email address.",
    notMember:
      "That address is not on the Ensemble Montréal CDN-NDG membership list. Use the address you gave when you joined, or write to the borough office to have it corrected.",
    membershipExpired: "Your membership has lapsed. Renew it to get back into the forum.",
    codeInvalid: "Invalid or expired code.",
    codeSendFailed: "The code could not be sent. Please try again.",
    tooManyCodes: "Too many requests. Please wait one minute.",
    locationRequired: "Point out the spot by clicking the map.",
    locationOutside:
      "That spot is outside Côte-des-Neiges–Notre-Dame-de-Grâce. Pick a point inside the borough.",
    boroughUnknown: "The forum does not cover that borough yet.",
    boroughFailed: "Your borough could not be saved. Please try again.",
    pollQuestionTooShort: "The question must be at least 5 characters.",
    pollQuestionTooLong: "The question cannot exceed 200 characters.",
    pollDescriptionTooLong: "The context cannot exceed 2,000 characters.",
    pollOptionsCount: "Add between 2 and 10 answer choices.",
    pollOptionEmpty: "Every answer choice must contain text.",
    pollOptionTooLong: "An answer choice cannot exceed 120 characters.",
    pollOptionDuplicate: "Every answer choice must be different.",
    pollPublishFailed: "The poll could not be published. Please try again.",
    pollChoiceRequired: "Choose an answer before saving your vote.",
    pollVoteFailed: "Your vote could not be saved. Please try again.",
    pollKindInvalid: "Choose a valid poll type.",
    pollPinLimitInvalid: "Choose a limit of 1 to 10 points per member.",
    pollPinRequired: "Add a point by clicking the map.",
    pollSettingMismatch: "This contribution contains something disabled by the poll.",
    pollPinDescriptionTooLong: "The point description cannot exceed 1,000 characters.",
    pollPinLimitReached: "You have reached the point limit for this poll.",
    pollPinFailed: "The point could not be added. Please try again.",
    messageRefused:
      "This message was not published: an automatic filter found abusive or threatening language in it. Rewrite it without targeting anyone, or ask for a person to review it. See the Privacy page.",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

/** fr-CA / en-CA so dates format per locale. */
export const dateLocale = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");
