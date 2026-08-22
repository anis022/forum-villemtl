"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/utils/i18n";

/**
 * Clearing the centre.
 *
 * The RPC runs as invoker, so the UPDATE policy on `public.notifications` is
 * what decides whose rows move. Nothing here has to check who is calling, and
 * nothing here could be talked into clearing somebody else's badge.
 */
export async function markNotificationsRead(formData: FormData): Promise<void> {
  const raw = String(formData.get("locale") ?? "");
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("mark_notifications_read");

  // Nothing is reported back. This runs from a button on the page it refreshes,
  // and the honest failure mode is that the notices are still marked unread the
  // next time it renders, which the person can see for themselves.
  if (error) console.error("[notifications] mark read:", error.message);

  // The badge in the masthead is rendered by the layout of every page, so the
  // centre alone is not enough to make it disappear.
  revalidatePath(`/${locale}`, "layout");
}
