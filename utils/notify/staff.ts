import { createClient } from "@supabase/supabase-js";
import { getDictionary } from "@/utils/i18n";
import type { Category } from "@/utils/issues";

/**
 * Telling the office, by mail, that a resident opened a topic.
 *
 * Runs after the response has already gone out (see the `after` call in
 * `app/actions/issues.ts`), never in front of it. A resident pressing "publier"
 * is waiting on one thing, which is their own post appearing; making them also
 * wait on a third-party mail API is how a working forum starts feeling broken
 * on a bad afternoon at somebody else's data centre.
 *
 * Everything here fails quietly. There is no path by which a mail problem is
 * allowed to become the resident's problem: the post is already saved, the
 * notification centre already has its row, and an office that has to check the
 * feed today is exactly where the office was last week.
 */

/**
 * The claim, the roster and the send all need credentials the browser must
 * never hold. Absent, the whole path is skipped rather than half-attempted,
 * which is the normal state of a preview deployment and of local development.
 */
const serviceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

/**
 * Where a link in the mail should point.
 *
 * `NEXT_PUBLIC_SITE_URL` wins where it is set, because a custom domain is the
 * address the office actually knows. Otherwise Vercel's own production
 * hostname, which is correct on every deployment without anybody maintaining
 * it, and which is why this is not a constant.
 */
const siteOrigin = () => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "https://cdnndg.vercel.app";
};

/**
 * Who the mail comes from.
 *
 * `RESEND_EMAIL_DOMAIN` is written by the Vercel integration and holds the
 * domain the resource was provisioned with, so the sending address follows the
 * provisioning rather than being spelt out twice in two places that can drift.
 *
 * Resend refuses any `from` whose domain it has not verified, which means this
 * returns 403 until the DKIM and SPF records are added to that domain's DNS.
 * That is the right failure: it is loud in the logs, it costs nothing (the
 * claim is released and the notification centre is unaffected), and the day the
 * records land the mail simply starts working with no deploy and no env change.
 *
 * The sandbox address Resend offers instead, `onboarding@resend.dev`, is not
 * used as a fallback on purpose. It only ever delivers to the address that owns
 * the Resend account, so on a roster of nine it would quietly reach one person
 * while reporting success, which is worse than not sending.
 */
const FROM =
  process.env.NOTIFY_FROM_EMAIL?.trim() ||
  `Forum CDN-NDG <forum@${process.env.RESEND_EMAIL_DOMAIN?.trim() || "resend.dev"}>`;

/** The address inside a "Name <addr>" pair, or the string itself if it is bare. */
const bareAddress = (from: string) => from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * A quotation of the report, not the whole of it.
 *
 * Somebody reading this on a phone needs to know whether it is theirs to
 * answer, and 5000 characters in a mailbox answers that no better than 400 do.
 * The link is what the rest of the text is for.
 */
const excerpt = (body: string, limit = 400) => {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit).trimEnd()}…`;
};

type TopicNotice = {
  issueId: string;
  title: string;
  body: string;
  authorName: string;
  categoryLabel: string;
};

/**
 * French only, on purpose. This is internal mail between the forum and the
 * borough office, not a page a resident picks a language for, and a bilingual
 * message doubles the length of something whose whole job is to be read in
 * four seconds on a phone.
 */
const compose = (topic: TopicNotice) => {
  const origin = siteOrigin();
  const url = `${origin}/fr/sujets/${topic.issueId}`;
  const centre = `${origin}/fr/notifications`;

  const subject = `Nouveau sujet : ${topic.title}`;

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

  // Inline styles rather than a stylesheet: mail clients strip <style> blocks
  // often enough that a message which only reads correctly with one is a
  // message that sometimes arrives as a wall of unstyled text. The palette is
  // the site's own, from components/ui/styles.ts.
  const html = `
<div style="margin:0;padding:24px 16px;background:#fef7f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e9e0d6;border-radius:16px;padding:24px">
    <p style="margin:0 0 16px;font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6e6a72">
      Nouveau sujet
    </p>
    <h1 style="margin:0 0 8px;font-size:20px;line-height:27px;font-weight:700;color:#1a1a1a">
      ${escapeHtml(topic.title)}
    </h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:20px;color:#6e6a72">
      Publié par ${escapeHtml(topic.authorName)} &middot; ${escapeHtml(topic.categoryLabel)}
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#1a1a1a">
      ${escapeHtml(excerpt(topic.body))}
    </p>
    <a href="${url}" style="display:inline-block;padding:10px 20px;border-radius:10px;background:#a3162c;color:#ffffff;font-size:15px;line-height:22px;font-weight:700;text-decoration:none">
      Lire et répondre
    </a>
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e9e0d6;font-size:13px;line-height:18px;color:#6e6a72">
      Vous recevez ce message parce que vous faites partie de l&rsquo;équipe de
      l&rsquo;arrondissement sur le Forum CDN-NDG.
      <a href="${centre}" style="color:#a3162c;font-weight:700">Voir vos notifications</a>
    </p>
  </div>
</div>`.trim();

  return { subject, text, html };
};

/**
 * Hand the batch to Resend.
 *
 * One request carrying every recipient in `bcc`, rather than one request per
 * person. Nine separate calls to mail nine people the same sentence is nine
 * chances to fail and nine times the latency, and `bcc` keeps the roster out of
 * a header on a message that may well be forwarded outside the office.
 */
async function send(
  issueId: string,
  recipients: string[],
  message: ReturnType<typeof compose>,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[notify] RESEND_API_KEY absent, courriel non envoyé");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // Belt to the claim row's braces. The claim stops this path being
        // entered twice for one topic; the key stops one entry that was
        // retried underneath us, by the runtime or by the network, from
        // arriving at Resend as two messages. Resend holds it for 24 hours,
        // which is far longer than any retry of a request that has already
        // been sent.
        "idempotency-key": `citizen-topic/${issueId}`,
      },
      body: JSON.stringify({
        from: FROM,
        // The roster is in `bcc`, and `to` still needs an address. The sender
        // is the honest one: this message is from the forum, about the forum.
        to: [bareAddress(FROM)],
        bcc: recipients,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      // A mail API that has stopped answering must not hold a function open
      // until the platform kills it.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("[notify] resend:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[notify] resend:", error);
    return false;
  }
}

/**
 * Mail the office about one topic, at most once ever.
 *
 * The claim in `claim_topic_notification` is what "at most once" rests on: it
 * inserts the row saying this topic has been mailed, and returns the roster
 * only to the caller that won that insert. A second caller, whatever brought it
 * here, is handed an empty list and does nothing.
 *
 * A send that fails outright releases the claim again, so a topic is not
 * permanently marked as delivered on the strength of a request that never
 * arrived anywhere.
 */
async function emailStaffAboutTopic(topic: TopicNotice): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { data, error } = await supabase.rpc("claim_topic_notification", {
    p_issue_id: topic.issueId,
  });

  if (error) {
    console.error("[notify] claim:", error.message);
    return;
  }

  const recipients = ((data ?? []) as { email: string }[])
    .map((row) => row.email)
    .filter(Boolean);

  // Either somebody else already mailed this topic, or the roster is empty.
  // Neither is a failure, and neither should release a claim.
  if (recipients.length === 0) return;

  const sent = await send(topic.issueId, recipients, compose(topic));

  if (!sent) {
    const { error: releaseError } = await supabase.rpc("release_topic_notification", {
      p_issue_id: topic.issueId,
    });
    if (releaseError) console.error("[notify] release:", releaseError.message);
  }
}

type AuthorRow = { role: string; first_name: string; last_name: string } | null;

/**
 * The one thing the publishing actions call.
 *
 * Takes an issue id and nothing else, because both callers reach this point
 * having just handed the row to Postgres and having no reason to carry its
 * contents forward. Re-reading it costs one query on a path that is already
 * behind the response, and it means the mail quotes what was actually stored
 * rather than what the form said before the database had its say.
 *
 * Never awaited by the caller. Wrap it in `after` so a slow mail provider
 * cannot delay the redirect to the resident's own post.
 */
export async function notifyStaffOfNewTopic(issueId: string): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("issues")
    .select("title, body, category, author:profiles!issues_author_id_fkey(role, first_name, last_name)")
    .eq("id", issueId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[notify] topic:", error.message);
    return;
  }

  // PostgREST returns an embedded one-to-one either as an object or as a
  // single-element array depending on how it reads the relationship, and this
  // has to survive both.
  const embedded = data.author as AuthorRow | AuthorRow[];
  const author = (Array.isArray(embedded) ? embedded[0] : embedded) ?? null;

  // The same rule the fan-out trigger applies, applied again here. The office
  // publishing an announcement is not something to mail the office about, and
  // the two channels must not disagree about what counts as news.
  if (author?.role !== "citizen") return;

  const name = `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim();
  const categories = getDictionary("fr").categories;
  const category = data.category as Category;

  await emailStaffAboutTopic({
    issueId,
    title: data.title as string,
    body: data.body as string,
    // A resident with no name on their profile is rare and still has to read
    // as somebody. "Une résidente ou un résident" is what the rest of the site
    // says in that position.
    authorName: name || "Une résidente ou un résident",
    categoryLabel: categories[category] ?? categories.general,
  });
}
