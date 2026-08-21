import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "./server";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: "citizen" | "official";
};

export type SessionContext = {
  user: SessionUser | null;
  /** Re-checked against the current membership roster on every request. */
  canParticipate: boolean;
};

/**
 * Reads the signed-in user on the server.
 *
 * Uses `getUser()`, not `getSession()`: getSession reads the JWT straight out
 * of the cookie without verifying it, so it must never be trusted on the
 * server. getUser revalidates the token against Supabase.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = createClient(await cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, canParticipate: false };

  // `avatar_url` lands with migration 0009. Before it is applied the column is
  // unknown and the query fails, which would blank out the signed-in user's
  // name in the header — so fall back to the fields that have always existed.
  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, role, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("viewer_is_member"),
  ]);
  let profile = profileResult.data;
  const { data: canParticipate, error: membershipError } = membershipResult;

  if (!profile) {
    ({ data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, role")
      .eq("id", user.id)
      .maybeSingle());
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
      role: profile?.role === "official" ? "official" : "citizen",
    },
    // Fail closed if the roster cannot be checked. Rendering the account is
    // harmless; enabling a write on an unknown result is not.
    canParticipate: !membershipError && canParticipate === true,
  };
});

export async function getSessionUser(): Promise<SessionUser | null> {
  return (await getSessionContext()).user;
}
