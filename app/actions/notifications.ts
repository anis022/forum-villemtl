"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/utils/i18n";

export async function markNotificationsRead(formData: FormData): Promise<void> {
  const raw = String(formData.get("locale") ?? "");
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("mark_notifications_read");
  if (error) console.error("[notifications] mark read failed", error.message);

  revalidatePath(`/${locale}`, "layout");
}
