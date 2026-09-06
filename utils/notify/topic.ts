// Relative, extensioned imports for the same reason as email.ts: the preview in
// scripts/email/templates.ts renders this message without a bundler.
import { getDictionary } from "../i18n.ts";
import { escapeHtml, mailLink, renderEmail } from "./email.ts";
import { siteOrigin } from "../site.ts";
import type { Category } from "../issues.ts";

/**
 * The message an elected official or a member of the cabinet gets when a
 * resident opens a subject.
 *
 * It is kept apart from the sending code in staff.ts so that it can be rendered
 * without a database, a key or a network: composing and sending are different
 * jobs, and only one of them can be looked at in a browser.
 *
 * The excerpt is deliberate. A notification that carries the whole post invites
 * a reply by email to an address that is not the author's, and the point of the
 * message is to bring someone back to the thread.
 */

export type TopicNotice = {
  issueId: string;
  title: string;
  body: string;
  authorName: string;
  categoryLabel: string;
};

const EXCERPT_LIMIT = 400;

export const excerpt = (body: string, limit = EXCERPT_LIMIT) => {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit).trimEnd()}…`;
};

export const composeTopicEmail = (topic: TopicNotice) => {
  const origin = siteOrigin();
  const url = `${origin}/fr/sujets/${topic.issueId}`;
  const centre = `${origin}/fr/notifications`;

  const subject = `Nouveau sujet : ${topic.title}`;

  // The plain text half is not a courtesy. A message with no text part reads as
  // bulk to a spam filter, and some clients still show it to a screen reader in
  // preference to the markup.
  const text = [
    `${topic.authorName} a publié un nouveau sujet sur le forum.`,
    "",
    topic.title,
    `Catégorie : ${topic.categoryLabel}`,
    "",
    excerpt(topic.body),
    "",
    `Lire et répondre : ${url}`,
    `Vos notifications : ${centre}`,
  ].join("\n");

  const html = renderEmail({
    preheader: escapeHtml(excerpt(topic.body, 140)),
    title: escapeHtml(topic.title),
    meta: `Publié par ${escapeHtml(topic.authorName)} &middot; ${escapeHtml(topic.categoryLabel)}`,
    paragraphs: [escapeHtml(excerpt(topic.body))],
    cta: { label: "Lire et répondre", href: url },
    footer:
      "Vous répondez aux sujets sur le Forum CDN-NDG. " +
      mailLink(centre, "Vos notifications"),
  });

  return { subject, text, html };
};

/** The label a category carries in the message, in the site's own words. */
export const categoryLabel = (category: Category) => {
  const categories = getDictionary("fr").categories;
  return categories[category] ?? categories.general;
};
