// The privacy policy, as content rather than as markup.
//
// The forum is run by the borough office of Côte-des-Neiges–Notre-Dame-de-Grâce
// — councillors, the borough mayor and their political staff — which makes it a
// *public body*. The law that applies is therefore the Loi sur l'accès aux
// documents des organismes publics et sur la protection des renseignements
// personnels (A-2.1) as amended by Loi 25, not the private-sector act.
//
// Nothing here cites an article number, and that is deliberate: the obligation
// is to publish this "en termes simples et clairs". Article references belong in
// the internal assessment, not on a page a resident reads to find out whether
// their address is public.
//
// It lives here rather than in `utils/i18n.ts` because it is not UI chrome —
// it is a document, it will be revised by people who are not editing components,
// and dropping two thousand words into the dictionary would bury every label in
// it.

import type { Locale } from "@/utils/i18n";

/**
 * Where an access, rectification or withdrawal request goes.
 *
 * MUST BE SET before this page is announced anywhere. A public body's requests
 * go to its responsable de l'accès aux documents et de la protection des
 * renseignements personnels — for a borough that is the Ville de Montréal's
 * designated person, not an address invented here.
 *
 * It renders as a visible blank until it is filled, which is the point: a
 * missing contact should be obvious to whoever reads the page, not silently
 * replaced by a plausible-looking address that reaches nobody.
 */
export const PRIVACY_CONTACT = "";

/** True while the contact is still unset, so the page can say so plainly. */
export const CONTACT_MISSING = PRIVACY_CONTACT.trim() === "";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export type Section = { id: string; heading: string; blocks: Block[] };

export type Policy = {
  /** Shown as "à jour au …". A policy with no date is a policy nobody trusts. */
  updated: string;
  intro: string;
  sections: Section[];
};

const frPolicy: Policy = {
  updated: "11 août 2026",
  intro:
    "Ce forum est tenu par le cabinet de l'arrondissement de Côte-des-Neiges–Notre-Dame-de-Grâce. Cette page dit ce qu'il recueille sur vous, ce qui en devient public, combien de temps c'est gardé et ce que vous pouvez exiger. Elle est écrite pour être lue en entier en quelques minutes.",
  sections: [
    {
      id: "public",
      heading: "Ce qui est public, et ça compte plus que le reste",
      blocks: [
        {
          kind: "p",
          text: "Un forum est un lieu public. Presque tout ce que vous écrivez ici est visible par n'importe qui, sans compte, et repérable par les moteurs de recherche.",
        },
        {
          kind: "list",
          items: [
            "Votre prénom, votre nom et votre photo de profil apparaissent à côté de chacune de vos publications.",
            "Le texte de vos signalements et de vos réponses est public.",
            "La photo jointe à un signalement est publique. Regardez-la avant de l'envoyer : une plaque d'immatriculation, un visage ou un numéro de porte s'y trouvent parfois sans qu'on l'ait voulu.",
            "L'épingle que vous posez sur la carte est publique et précise. Si vous signalez quelque chose depuis chez vous, cette épingle indique où vous habitez.",
            "Les sujets que vous appuyez sont publics : votre visage apparaît parmi les personnes qui les soutiennent.",
          ],
        },
        {
          kind: "p",
          text: "Votre adresse courriel, elle, n'est jamais affichée. Elle sert à vous connecter, rien d'autre.",
        },
      ],
    },
    {
      id: "collecte",
      heading: "Ce que nous recueillons",
      blocks: [
        {
          kind: "table",
          head: ["Renseignement", "D'où il vient", "Qui le voit"],
          rows: [
            ["Adresse courriel", "Vous, à l'inscription", "Vous et le cabinet"],
            ["Prénom et nom", "Vous, à l'inscription", "Tout le monde"],
            ["Photo de profil", "Vous, si vous en ajoutez une", "Tout le monde"],
            ["Signalements : texte, photo, position", "Vous, quand vous publiez", "Tout le monde"],
            ["Réponses", "Vous, quand vous répondez", "Tout le monde"],
            ["Appuis", "Vous, quand vous appuyez un sujet", "Tout le monde"],
            [
              "Consultation d'un événement ou d'un projet",
              "Votre ouverture de sa fiche ou de son lien",
              "Le système seulement, sous un identifiant aléatoire",
            ],
            [
              "Messages retenus par le filtre",
              "Le filtre automatique décrit plus bas",
              "Les personnes élues",
            ],
          ],
        },
        {
          kind: "p",
          text: "Nous ne demandons ni téléphone, ni adresse postale, ni date de naissance. Il n'y a pas de mot de passe à retenir : vous vous connectez avec un code envoyé par courriel, et aucun mot de passe n'est conservé.",
        },
        {
          kind: "p",
          text: "Le site n'utilise aucun cookie publicitaire. Un témoin aléatoire, sans votre nom ni votre adresse IP, évite de compter plusieurs fois la consultation du même événement ou projet pendant une journée. Il sert uniquement à établir la section « Tendances ».",
        },
      ],
    },
    {
      id: "fins",
      heading: "Pourquoi",
      blocks: [
        {
          kind: "list",
          items: [
            "Publier vos signalements et vos réponses, et les rattacher à votre nom, parce qu'un forum où personne ne signe n'est pas une discussion de quartier.",
            "Situer les signalements sur une carte, pour que l'arrondissement sache où intervenir.",
            "Compter les appuis, parce que les sujets les plus soutenus sont traités en priorité.",
            "Classer les événements et les projets les plus consultés sur les sept derniers jours.",
            "Vous connecter et vous reconnaître d'une visite à l'autre.",
            "Repérer les propos injurieux ou menaçants avant qu'ils ne soient publiés.",
          ],
        },
        {
          kind: "p",
          text: "Vos renseignements ne servent à rien d'autre. Ils ne sont ni vendus, ni échangés, ni utilisés pour vous solliciter.",
        },
      ],
    },
    {
      id: "ou",
      heading: "Où sont les données, et qui d'autre les touche",
      blocks: [
        {
          kind: "p",
          text: "La base de données, les photos et les pages du site sont hébergées à Montréal. Le traitement se fait au Québec.",
        },
        {
          kind: "p",
          text: "Quatre services extérieurs interviennent, et il vaut mieux les nommer :",
        },
        {
          kind: "list",
          items: [
            "Supabase héberge la base de données et les photos, dans un centre de données situé à Montréal.",
            "Vercel héberge le site et exécute son code, dans sa région de Montréal.",
            "Les fonds de carte proviennent de CARTO. Votre adresse IP et la zone de carte que vous regardez lui sont donc transmises chaque fois qu'une carte s'affiche.",
            "Le bouton « Traduire », si vous l'utilisez, envoie le texte du message concerné à un service de traduction de Google situé aux États-Unis. Rien n'est envoyé tant que vous n'appuyez pas dessus. Ce transfert est à l'étude et pourrait être retiré.",
          ],
        },
      ],
    },
    {
      id: "filtre",
      heading: "Le filtre automatique",
      blocks: [
        {
          kind: "p",
          text: "Chaque message est lu par un programme avant d'être publié. Il compare les mots employés à une liste de termes injurieux, haineux ou menaçants, et calcule un score.",
        },
        {
          kind: "list",
          items: [
            "Au-dessus d'un certain score, le message n'est pas publié et vous voyez tout de suite pourquoi.",
            "Entre les deux seuils, le message est publié normalement, mais une personne élue est invitée à le relire.",
            "En dessous, rien ne se passe et personne n'est prévenu.",
          ],
        },
        {
          kind: "p",
          text: "Le programme ne lit que le texte du message. Il ne tient compte ni de qui vous êtes, ni de ce que vous avez écrit auparavant, ni de vos appuis. Le seul facteur d'un refus est donc la présence de ces mots-là dans ce message-là.",
        },
        {
          kind: "p",
          text: "Si votre message est refusé et que vous croyez que c'est une erreur, vous pouvez demander qu'une personne le relise et le publie. Vous pouvez aussi demander quels mots ont été retenus et présenter vos observations. Écrivez à la personne responsable, dont les coordonnées sont plus bas.",
        },
      ],
    },
    {
      id: "duree",
      heading: "Combien de temps",
      blocks: [
        {
          kind: "p",
          text: "Vos signalements et vos réponses restent en ligne tant que vous ne les retirez pas, parce qu'ils forment la mémoire des échanges entre l'arrondissement et ses résident·es. Un signalement réglé en 2024 explique encore pourquoi une rue a été refaite.",
        },
        {
          kind: "p",
          text: "Ce qui n'a pas cette raison d'être conservé ne l'est pas : les consultations anonymisées servant aux tendances sont effacées après trente jours, les messages retenus par le filtre puis jugés corrects par une personne élue après douze mois, et les codes de connexion expirent en quelques minutes.",
        },
        {
          kind: "p",
          text: "Comme l'arrondissement est un organisme public, la destruction de ses documents obéit aussi à son calendrier de conservation. Une demande de suppression est traitée dans ce cadre.",
        },
      ],
    },
    {
      id: "droits",
      heading: "Ce que vous pouvez exiger",
      blocks: [
        {
          kind: "list",
          items: [
            "Savoir ce que nous détenons sur vous, et en obtenir copie. Le bouton « Télécharger mes données » sur votre profil vous en donne un fichier immédiatement.",
            "Faire corriger un renseignement inexact — y compris une erreur dans la transcription d'une séance du conseil, qui est produite par machine et peut se tromper sur ce que vous avez dit.",
            "Retirer un signalement ou une réponse, à tout moment, vous-même.",
            "Fermer votre compte. Votre courriel, votre nom et votre photo sont alors supprimés ; vos messages restent en ligne, détachés de votre identité, pour ne pas trouer les discussions auxquelles d'autres ont participé. Retirez d'abord ceux que vous ne voulez pas laisser.",
            "Vous plaindre à la Commission d'accès à l'information du Québec si notre réponse ne vous satisfait pas.",
          ],
        },
      ],
    },
  ],
};

const enPolicy: Policy = {
  updated: "11 August 2026",
  intro:
    "This forum is run by the borough office of Côte-des-Neiges–Notre-Dame-de-Grâce. This page says what it collects about you, what becomes public, how long it is kept, and what you can require of us. It is written to be read in full in a few minutes.",
  sections: [
    {
      id: "public",
      heading: "What is public, which matters more than the rest",
      blocks: [
        {
          kind: "p",
          text: "A forum is a public place. Almost everything you write here is visible to anyone, without an account, and findable by search engines.",
        },
        {
          kind: "list",
          items: [
            "Your first name, last name and profile photo appear beside everything you post.",
            "The text of your reports and replies is public.",
            "A photo attached to a report is public. Look at it before sending: a licence plate, a face or a door number sometimes ends up in frame.",
            "The pin you place on the map is public and precise. If you report something from home, that pin says where you live.",
            "The topics you back are public: your face appears among the people supporting them.",
          ],
        },
        {
          kind: "p",
          text: "Your email address is never displayed. It signs you in, and nothing else.",
        },
      ],
    },
    {
      id: "collecte",
      heading: "What we collect",
      blocks: [
        {
          kind: "table",
          head: ["Information", "Where it comes from", "Who sees it"],
          rows: [
            ["Email address", "You, at sign-up", "You and the borough office"],
            ["First and last name", "You, at sign-up", "Everyone"],
            ["Profile photo", "You, if you add one", "Everyone"],
            ["Reports: text, photo, location", "You, when you post", "Everyone"],
            ["Replies", "You, when you reply", "Everyone"],
            ["Backing", "You, when you back a topic", "Everyone"],
            [
              "Opening an event or project",
              "You, when you open its page or link",
              "The system only, under a random identifier",
            ],
            ["Messages held by the filter", "The automatic filter described below", "Elected officials"],
          ],
        },
        {
          kind: "p",
          text: "We ask for no phone number, no mailing address, no date of birth. There is no password to remember: you sign in with a code sent by email, and no password is stored.",
        },
        {
          kind: "p",
          text: "The site uses no advertising cookies. A random cookie, carrying neither your name nor your IP address, prevents the same event or project from being counted more than once in a day. It is used only to build the Trending section.",
        },
      ],
    },
    {
      id: "fins",
      heading: "Why",
      blocks: [
        {
          kind: "list",
          items: [
            "To publish your reports and replies under your name, because a forum nobody signs is not a neighbourhood conversation.",
            "To place reports on a map, so the borough knows where to act.",
            "To count backing, because the most-supported topics are handled first.",
            "To rank the events and projects most often opened during the last seven days.",
            "To sign you in and recognise you from one visit to the next.",
            "To catch abusive or threatening language before it is published.",
          ],
        },
        {
          kind: "p",
          text: "Your information is used for nothing else. It is not sold, not traded, and not used to solicit you.",
        },
      ],
    },
    {
      id: "ou",
      heading: "Where the data is, and who else touches it",
      blocks: [
        {
          kind: "p",
          text: "The database, the photos and the site's pages are hosted in Montréal. Processing happens in Québec.",
        },
        { kind: "p", text: "Four outside services are involved, and they are worth naming:" },
        {
          kind: "list",
          items: [
            "Supabase hosts the database and the photos, in a data centre in Montréal.",
            "Vercel hosts the site and runs its code, in its Montréal region.",
            "Base map tiles come from CARTO. Your IP address and the map area you are looking at are sent to them whenever a map is shown.",
            "The “Translate” button, if you use it, sends that message's text to a Google translation service in the United States. Nothing is sent until you press it. This transfer is under review and may be removed.",
          ],
        },
      ],
    },
    {
      id: "filtre",
      heading: "The automatic filter",
      blocks: [
        {
          kind: "p",
          text: "Every message is read by a program before it is published. It compares the words used against a list of abusive, hateful or threatening terms and works out a score.",
        },
        {
          kind: "list",
          items: [
            "Above a certain score the message is not published and you are told why immediately.",
            "Between the two thresholds the message is published normally, but an elected official is asked to read it.",
            "Below that, nothing happens and nobody is notified.",
          ],
        },
        {
          kind: "p",
          text: "The program reads only the text of the message. It takes no account of who you are, what you have written before, or what you have backed. The only factor in a refusal is the presence of those words in that message.",
        },
        {
          kind: "p",
          text: "If your message is refused and you believe that is a mistake, you can ask for a person to read it and publish it. You can also ask which words were matched and make your case. Write to the responsible person, whose contact details are below.",
        },
      ],
    },
    {
      id: "duree",
      heading: "How long",
      blocks: [
        {
          kind: "p",
          text: "Your reports and replies stay online until you withdraw them, because together they are the record of what the borough and its residents said to each other. A report settled in 2024 still explains why a street was rebuilt.",
        },
        {
          kind: "p",
          text: "What has no such reason to be kept is not kept: anonymised openings used for Trending are erased after thirty days, messages held by the filter and then cleared by an elected official after twelve months, and sign-in codes expire in minutes.",
        },
        {
          kind: "p",
          text: "Because the borough is a public body, destroying its records also follows its retention schedule. A deletion request is handled within that framework.",
        },
      ],
    },
    {
      id: "droits",
      heading: "What you can require",
      blocks: [
        {
          kind: "list",
          items: [
            "To know what we hold about you and get a copy. The “Download my data” button on your profile gives you a file straight away.",
            "To have inaccurate information corrected — including an error in the transcript of a council meeting, which is produced by machine and can get what you said wrong.",
            "To withdraw a report or a reply, at any time, yourself.",
            "To close your account. Your email, name and photo are deleted; your messages stay online, detached from your identity, so as not to tear holes in conversations other people took part in. Withdraw the ones you do not want to leave behind first.",
            "To complain to the Commission d'accès à l'information du Québec if our answer does not satisfy you.",
          ],
        },
      ],
    },
  ],
};

export const POLICY: Record<Locale, Policy> = { fr: frPolicy, en: enPolicy };
