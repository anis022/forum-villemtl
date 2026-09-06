/**
 * Write the sign in emails that Supabase sends.
 *
 *   npm run email:templates
 *
 * Supabase renders its auth emails itself, from templates pasted into the
 * dashboard, so those two messages are the one part of the forum's mail that
 * cannot import anything at runtime. Left to be written by hand they drift:
 * the site's red moves and the code a member receives keeps the old one.
 *
 * So they are generated instead, from the same `renderEmail` shell the staff
 * notification uses, and written to `supabase/templates/`. Run this after any
 * change to the palette or the shell, then paste the files back into
 * Authentication, Emails in the dashboard. The dashboard stays the source of
 * what is sent; these files are the source of what belongs there.
 *
 * The placeholders are Supabase's own Go template variables and are left
 * untouched:
 *
 *   {{ .Token }}      the six digit code the dialog asks for
 *   {{ .TokenHash }}  the same grant, for the link fallback
 *   {{ .SiteURL }}    the site, from Authentication, URL Configuration
 *   {{ .Email }}      the address that asked to sign in
 *
 * A preview of each, with the placeholders filled in, is written beside them so
 * the result can be opened in a browser without sending anything.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { codeBlock, renderEmail, subtle } from "../../utils/notify/email.ts";
import { composeTopicEmail } from "../../utils/notify/topic.ts";

const OUT = "supabase/templates";

/**
 * Sent every time a member signs in, not only the first time. Supabase calls
 * this one Magic Link.
 *
 * A code and nothing else. Whoever opens this message asked for it seconds ago
 * and is looking at the dialog that wants the six digits, so every sentence
 * that is not the code is a sentence in the way.
 */
const signIn = () =>
  renderEmail({
    preheader: "Votre code de connexion.",
    title: "Votre code de connexion",
    align: "center",
    feature: codeBlock("{{ .Token }}") + subtle("Il expire dans une heure."),
    footer:
      "Demandé pour {{ .Email }}. Si ce n'est pas vous, ignorez ce message.<br>" +
      "Your sign in code for the Forum CDN-NDG.",
  });

/** The same, the first time an address is used. Supabase calls it Confirm signup. */
const firstSignIn = () =>
  renderEmail({
    preheader: "Votre code pour créer votre compte.",
    title: "Bienvenue sur le Forum CDN-NDG",
    align: "center",
    paragraphs: ["Entrez ce code pour créer votre compte."],
    feature: codeBlock("{{ .Token }}") + subtle("Il expire dans une heure."),
    footer:
      "Demandé pour {{ .Email }}. Si ce n'est pas vous, ignorez ce message : " +
      "aucun compte n'est créé sans le code.<br>" +
      "Your code to create your account on the Forum CDN-NDG.",
  });

/** Placeholder values, so a preview looks like what a member receives. */
const filled = (html: string) =>
  html
    .replace(/\{\{ \.Token \}\}/g, "418 203")
    .replace(/\{\{ \.TokenHash \}\}/g, "exemple-de-jeton")
    .replace(/\{\{ \.SiteURL \}\}/g, "https://forum.ensemblemtl.ca")
    .replace(/\{\{ \.Email \}\}/g, "membre@exemple.ca");

const files: [string, string][] = [
  ["code-connexion.html", signIn()],
  ["code-inscription.html", firstSignIn()],
];

mkdirSync(`${OUT}/apercu`, { recursive: true });

for (const [name, html] of files) {
  writeFileSync(`${OUT}/${name}`, html, "utf8");
  writeFileSync(`${OUT}/apercu/${name}`, filled(html), "utf8");
  console.log(`écrit  ${OUT}/${name}`);
}

// The staff notification is sent by the app rather than by Supabase, so it has
// no template to paste anywhere. It is previewed here all the same: the three
// messages share one shell, and a change to that shell has to be looked at on
// all three at once.
writeFileSync(
  `${OUT}/apercu/notification-sujet.html`,
  composeTopicEmail({
    issueId: "00000000-0000-0000-0000-000000000000",
    title: "Le trottoir de la rue Barclay est impraticable en fauteuil",
    body:
      "Depuis les travaux de l'été, le trottoir côté nord entre Victoria et Lemieux " +
      "est fissuré sur une trentaine de mètres. Ma mère se déplace en fauteuil et " +
      "doit descendre dans la rue pour passer, à un endroit où les voitures tournent " +
      "sans visibilité. J'ai appelé le 311 deux fois depuis août sans suite.",
    authorName: "Sylvie Nadeau",
    categoryLabel: "Voirie",
  }).html,
  "utf8",
);
console.log(`écrit  ${OUT}/apercu/notification-sujet.html`);

console.log(
  `\nAperçus dans ${OUT}/apercu, à ouvrir dans un navigateur.\n` +
    "Le contenu des deux autres fichiers se colle dans Supabase, Authentication, Emails :\n" +
    "  code-connexion.html   -> Magic Link\n" +
    "  code-inscription.html -> Confirm signup",
);
