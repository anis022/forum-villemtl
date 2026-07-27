import { cookies } from "next/headers";
import { createClient } from "./server";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "citizen" | "official";
};

/**
 * Reads the signed-in user on the server.
 *
 * Uses `getUser()`, not `getSession()`: getSession reads the JWT straight out
 * of the cookie without verifying it, so it must never be trusted on the
 * server. getUser revalidates the token against Supabase.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createClient(await cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    role: profile?.role === "official" ? "official" : "citizen",
  };
}
