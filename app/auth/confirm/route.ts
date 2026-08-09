import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// The link half of the email sign-in, kept as a fallback.
//
// Signing in is a six-digit code typed into the dialog, so this route is not on
// the main path any more. It stays because a Supabase email template can carry
// both a `{{ .Token }}` and a `{{ .ConfirmationURL }}`, and someone who taps the
// link instead of copying the code should land signed in rather than on a 404.
// Exchanging the token hash sets the session cookies, then we drop them back on
// the home page.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect("/");
  }

  redirect("/?auth_error=confirmation");
}
