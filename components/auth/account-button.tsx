"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { SessionUser } from "@/utils/supabase/auth";
import { getDictionary, type Locale } from "@/utils/i18n";
import { AuthModal } from "./auth-modal";

function PersonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.2 19.2a6.2 6.2 0 0 1 11.6 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" className="shrink-0">
      <path
        d="M14 7V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 12h10m0 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AccountButton({
  initialUser,
  lang,
}: {
  initialUser: SessionUser | null;
  lang: Locale;
}) {
  const router = useRouter();
  const t = getDictionary(lang);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(initialUser);

  // The server already resolved the session, so this only reacts to later
  // changes (sign-in from the modal, sign-out, token refresh, other tabs).
  useEffect(() => setUser(initialUser), [initialUser]);

  useEffect(() => {
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        // Re-run the server components so the session cookie and the rendered
        // markup agree, instead of patching state on the client.
        router.refresh();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.refresh();
  };

  // On phones the name and the "sign out" label hide, leaving two tappable
  // icons (identity + sign-out) so the row fits without overflow.
  if (user) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    return (
      <div className="flex items-center gap-1 md:gap-4">
        <span className="flex h-10 items-center gap-2 px-1 text-[16px] font-bold leading-[24px] text-[#212529]">
          <PersonIcon />
          <span className="hidden max-w-[16ch] truncate lg:inline">{name}</span>
        </span>
        <button
          type="button"
          onClick={signOut}
          aria-label={t.header.signOut}
          className="flex h-10 items-center gap-2 rounded-[4px] px-2 text-[16px] font-bold leading-[24px] text-[#097d6c] hover:underline md:px-3"
        >
          <LogoutIcon />
          <span className="hidden md:inline">{t.header.signOut}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.header.account}
        className="flex h-10 items-center gap-2 rounded-[4px] px-2 text-[16px] font-bold leading-[24px] text-[#212529] hover:underline md:px-3"
      >
        <PersonIcon />
        <span className="hidden md:inline">{t.header.account}</span>
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} lang={lang} />
    </>
  );
}
