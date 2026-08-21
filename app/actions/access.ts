"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isLocale, type Locale } from "@/utils/i18n";

export type StaffAccessError =
  | "notSignedIn"
  | "forbidden"
  | "invalidEmail"
  | "cannotRevokeSelf"
  | "accessNotFound"
  | "accessFailed";

export type StaffAccessResult =
  | { ok: true }
  | { ok: false; error: StaffAccessError };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Grant or suspend the administrator role for one address.
 *
 * The database function identifies the caller from auth.uid(), refuses
 * non-officials and prevents self-revocation. This action repeats the cheap
 * input/session checks only to return useful translated feedback instead of a
 * raw database error.
 */
export async function setAdministratorAccess(
  email: string,
  active: boolean,
  lang: Locale,
): Promise<StaffAccessResult> {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 320 || !EMAIL.test(normalized)) {
    return { ok: false, error: "invalidEmail" };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notSignedIn" };

  const { error } = await supabase.rpc("set_staff_access", {
    p_email: normalized,
    p_active: active,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("cannot revoke self")) {
      return { ok: false, error: "cannotRevokeSelf" };
    }
    if (message.includes("invalid email")) {
      return { ok: false, error: "invalidEmail" };
    }
    if (message.includes("access not found")) {
      return { ok: false, error: "accessNotFound" };
    }
    if (message.includes("not authorized") || error.code === "42501") {
      return { ok: false, error: "forbidden" };
    }
    console.error("[moderation] set staff access:", error.message);
    return { ok: false, error: "accessFailed" };
  }

  const locale = isLocale(lang) ? lang : "fr";
  revalidatePath(`/${locale}/moderation`);
  revalidatePath(`/${locale}`, "layout");
  return { ok: true };
}
