// Explicit .ts extensions and relative paths, not the `@/` alias: this module
// is imported both by the Next bundler and by `node --experimental-strip-types`
// in scripts/email/templates.ts, and only one of the two resolves either form.
// Same reason utils/ingest/project-candidates.ts is written this way.
import { ACCENT, CREAM, INK, LINE, MUTED_HEX } from "../../components/ui/styles.ts";
import { siteOrigin } from "../site.ts";

/**
 * The shell every message the forum sends is built in.
 *
 * A mail client is not a browser. There is no stylesheet, no class attribute
 * worth relying on, no flexbox in Outlook, and Gmail strips what it does not
 * recognise. So the site's look is rebuilt out of tables and inline styles
 * rather than reused, and the one thing that must not drift is the palette: the
 * tokens are imported from `components/ui/styles.ts` rather than copied, so a
 * change to the site's red is a change to the red in the inbox.
 *
 * What is deliberately absent:
 *
 *   - No small uppercase label over the title, no bar shouting the name of the
 *     site. Invented chrome is what makes a message look assembled by a
 *     machine, and the wordmark already says who is writing.
 *   - No sentence explaining what the reader is looking at. A code email is a
 *     code: the shorter it is, the faster it is used and the less it reads as
 *     marketing.
 *
 * Two rules the site does not have to think about:
 *
 *   - `color-scheme: light` is declared twice, in a meta tag and on the body.
 *     The site is light only, and without this Apple Mail and Outlook invert
 *     the palette themselves.
 *   - Every layout table is `role="presentation"`, or a screen reader announces
 *     the message as a data table with rows and columns.
 */

const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** 600px is what every client shows without shrinking. Below that it fluids. */
const WIDTH = 600;

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Cta = { label: string; href: string };

type Message = {
  /** Sets `<html lang>`, so a screen reader reads the message in its language. */
  lang?: "fr" | "en";
  /**
   * The line the inbox shows after the subject. Never leave it to chance:
   * without one, clients pull the first words of the markup instead.
   */
  preheader: string;
  title: string;
  /**
   * Centred for a message that is one short thing, a code. Left for anything
   * with a paragraph in it: centred prose is read more slowly, and the ragged
   * left edge is what does it.
   */
  align?: "left" | "center";
  /** One muted line under the title, for author and category. */
  meta?: string;
  /** Body, already escaped. Each entry becomes its own paragraph. */
  paragraphs?: string[];
  /** A block between the body and the button: a code, a quiet note. */
  feature?: string;
  cta?: Cta;
  /** Why this message arrived. One or two lines, already escaped. */
  footer: string;
};

/** A link drawn as the site's primary button. */
const button = ({ label, href }: Cta) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr>
    <td style="border-radius:10px;background:${ACCENT};">
      <a href="${href}" style="display:inline-block;padding:11px 22px;border-radius:10px;font-family:${FONT};font-size:15px;line-height:22px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;

/**
 * The six digit code.
 *
 * One string, spaced but not split: a code cut into six bordered cells cannot
 * be copied in one gesture on a phone, and copying is what most people do.
 */
export const codeBlock = (code: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 14px;">
  <tr>
    <td align="center" style="background:${CREAM};border:1px solid ${LINE};border-radius:12px;padding:20px 12px;font-family:${FONT};font-size:34px;line-height:42px;font-weight:700;letter-spacing:0.08em;color:${INK};">${code}</td>
  </tr>
</table>`;

/** A quieter line, for fine print or a second language. */
export const subtle = (html: string) =>
  `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED_HEX};">${html}</p>`;

export function renderEmail(message: Message): string {
  const lang = message.lang ?? "fr";
  const align = message.align ?? "left";
  const origin = siteOrigin();

  const paragraphs = (message.paragraphs ?? [])
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${INK};">${text}</p>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(message.title)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};color-scheme:light;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${message.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
  <tr>
    <td align="center" style="padding:32px 12px 40px;">
      <table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${WIDTH}px;">
        <tr>
          <td align="center" style="padding:0 0 20px;">
            <img src="${origin}/logo-ensemble-mtl.png" width="124" height="44" alt="Ensemble Montréal" style="display:block;border:0;outline:none;text-decoration:none;height:auto;">
          </td>
        </tr>
        <tr>
          <td align="${align}" style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;padding:32px 28px;text-align:${align};">
            <h1 style="margin:0 0 ${message.meta ? "6px" : "18px"};font-family:${FONT};font-size:21px;line-height:28px;font-weight:700;color:${INK};">${message.title}</h1>
            ${message.meta ? `<p style="margin:0 0 18px;font-family:${FONT};font-size:14px;line-height:20px;color:${MUTED_HEX};">${message.meta}</p>` : ""}
            ${paragraphs}
            ${message.feature ?? ""}
            ${message.cta ? button(message.cta) : ""}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 16px 0;text-align:center;font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED_HEX};">
            ${message.footer}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** The site's link colour, for the one or two links a message carries. */
export const mailLink = (href: string, label: string) =>
  `<a href="${href}" style="color:${ACCENT};font-weight:700;text-decoration:underline;">${label}</a>`;
