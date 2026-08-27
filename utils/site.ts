/**
 * Where this site answers from, used for the canonical URL, the link previews
 * and the links inside notification emails.
 *
 * NEXT_PUBLIC_SITE_URL is the override to set the day the forum moves to its
 * own domain. Without it the Vercel production URL is used, which is right
 * everywhere except that it keeps naming cdnndg.vercel.app in mail that should
 * be pointing at the real address.
 */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "https://cdnndg.vercel.app";
}
