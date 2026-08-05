"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { translate, type Translation } from "@/utils/translate";
import { isLocale, type Locale } from "@/utils/i18n";

export type TranslateResult =
  | { ok: true; translation: Translation }
  | { ok: false; error: "translateFailed" };

const failed: TranslateResult = { ok: false, error: "translateFailed" };

/**
 * Translate one post or one reply into the reader's language.
 *
 * The caller sends an id and a target language — never the text. The text is
 * read back out of the database here, which is what keeps this from being an
 * open translation endpoint anyone could point at anything and bill to the
 * borough.
 */
export async function translatePost(
  kind: "issue" | "comment",
  id: string,
  target: string,
): Promise<TranslateResult> {
  if (!isLocale(target)) return failed;
  if (kind !== "issue" && kind !== "comment") return failed;

  const supabase = createClient(await cookies());

  const { data } = await (kind === "issue"
    ? supabase.from("issues").select("title, body").eq("id", id).maybeSingle()
    : supabase.from("comments").select("body").eq("id", id).maybeSingle());

  if (!data) return failed;

  const row = data as { title?: string; body: string };
  const translation = await translate(row.title ?? null, row.body, target as Locale);

  return translation ? { ok: true, translation } : failed;
}
