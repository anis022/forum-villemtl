import { createClient } from "@supabase/supabase-js";
import { getDictionary } from "@/utils/i18n";
import type { Category } from "@/utils/issues";

type TopicNotice = {
  issueId: string;
  title: string;
  body: string;
  authorName: string;
  categoryLabel: string;
};

type AuthorRow = { role: string; first_name: string; last_name: string } | null;

const SEND_TIMEOUT_MS = 10_000;
const EXCERPT_LIMIT = 400;

const serviceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

const siteOrigin = () => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "https://cdnndg.vercel.app";
};

const sender = () =>
  process.env.NOTIFY_FROM_EMAIL?.trim() ||
  `Forum CDN-NDG <forum@${process.env.RESEND_EMAIL_DOMAIN?.trim() || "resend.dev"}>`;

const bareAddress = (from: string) => from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const excerpt = (body: string, limit = EXCERPT_LIMIT) => {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit).trimEnd()}…`;
};

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

async function send(
  issueId: string,
  recipients: string[],
  message: ReturnType<typeof compose>,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[notify] RESEND_API_KEY absent");
    return false;
  }

  const from = sender();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": `citizen-topic/${issueId}`,
      },
      body: JSON.stringify({
        from,
        to: [bareAddress(from)],
        bcc: recipients,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("[notify] resend refused", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[notify] resend failed", error);
    return false;
  }
}

async function emailStaffAboutTopic(topic: TopicNotice): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { data, error } = await supabase.rpc("claim_topic_notification", {
    p_issue_id: topic.issueId,
  });

  if (error) {
    console.error("[notify] claim failed", error.message);
    return;
  }

  const recipients = ((data ?? []) as { email: string }[])
    .map((row) => row.email)
    .filter(Boolean);

  if (recipients.length === 0) return;

  const sent = await send(topic.issueId, recipients, compose(topic));
  if (sent) return;

  const { error: releaseError } = await supabase.rpc("release_topic_notification", {
    p_issue_id: topic.issueId,
  });
  if (releaseError) console.error("[notify] release failed", releaseError.message);
}

export async function notifyStaffOfNewTopic(issueId: string): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("issues")
    .select("title, body, category, author:profiles!issues_author_id_fkey(role, first_name, last_name)")
    .eq("id", issueId)
    .maybeSingle();

  if (error) {
    console.error("[notify] topic lookup failed", error.message);
    return;
  }
  if (!data) return;

  const embedded = data.author as AuthorRow | AuthorRow[];
  const author = (Array.isArray(embedded) ? embedded[0] : embedded) ?? null;
  if (author?.role !== "citizen") return;

  const name = `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim();
  const categories = getDictionary("fr").categories;
  const category = data.category as Category;

  await emailStaffAboutTopic({
    issueId,
    title: data.title as string,
    body: data.body as string,
    authorName: name || "Une résidente ou un résident",
    categoryLabel: categories[category] ?? categories.general,
  });
}
