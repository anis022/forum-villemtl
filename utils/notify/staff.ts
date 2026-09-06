import { createClient } from "@supabase/supabase-js";
import { categoryLabel, composeTopicEmail, type TopicNotice } from "@/utils/notify/topic";
import type { Category } from "@/utils/issues";

type AuthorRow = { role: string; first_name: string; last_name: string } | null;

const SEND_TIMEOUT_MS = 10_000;

const serviceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

const sender = () =>
  process.env.NOTIFY_FROM_EMAIL?.trim() ||
  `Forum CDN-NDG <notification@${process.env.RESEND_EMAIL_DOMAIN?.trim() || "resend.dev"}>`;

const replyTo = () => process.env.NOTIFY_REPLY_TO?.trim() || "forumcdnndg@ensemblemtl.org";

const bareAddress = (from: string) => from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();

async function send(
  issueId: string,
  recipients: string[],
  message: ReturnType<typeof composeTopicEmail>,
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
        reply_to: replyTo(),
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

  const sent = await send(topic.issueId, recipients, composeTopicEmail(topic));
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

  await emailStaffAboutTopic({
    issueId,
    title: data.title as string,
    body: data.body as string,
    authorName: name || "Une résidente ou un résident",
    categoryLabel: categoryLabel(data.category as Category),
  });
}
