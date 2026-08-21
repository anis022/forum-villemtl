"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { BARE_CONTROL } from "@/components/ui/styles";
import { createClient } from "@/utils/supabase/client";
import type { SessionUser } from "@/utils/supabase/auth";
import { getDictionary, type Locale } from "@/utils/i18n";
import { AuthModal } from "./auth-modal";

function PersonIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.2 19.2a6.2 6.2 0 0 1 11.6 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      className="shrink-0"
    >
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

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <path
        d="m4 6 4 4 4-4"
        fill="none"
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
  const user = initialUser;
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") router.refresh();
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user || !open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, user]);

  const signOut = async () => {
    setOpen(false);
    await createClient().auth.signOut();
    router.refresh();
  };

  if (user) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    return (
      <div ref={accountRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={t.header.account}
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls="account-menu"
          className={`flex h-10 shrink-0 items-center gap-2 ${BARE_CONTROL} px-1.5 font-nav text-[16px] font-bold leading-[24px] transition-colors sm:px-2 ${
            open ? "text-[#a3162c]" : "text-[#2a2a86] hover:text-[#a3162c]"
          }`}
        >
          <Avatar person={{ ...user, avatarUrl: user.avatarUrl }} size="sm" />
          <span className="hidden max-w-[16ch] truncate md:inline">{name}</span>
          <span
            className={`fold-chevron hidden transition-transform md:block ${open ? "rotate-180" : ""}`}
          >
            <ChevronIcon />
          </span>
        </button>

        <div
          id="account-menu"
          data-open={open ? "" : undefined}
          inert={!open}
          className="account-menu absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-[16px] border border-[#e9e0d6] bg-white shadow-[0_8px_24px_rgba(26,26,26,0.12)]"
        >
          <div className="flex items-center gap-3 border-b border-[#e9e0d6] bg-[#fef7f0] px-4 py-3">
            <Avatar person={{ ...user, avatarUrl: user.avatarUrl }} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-[20px] text-[#1a1a1a]">{name}</p>
              {name !== user.email ? (
                <p className="truncate text-[13px] leading-[18px] text-[#6e6a72]">{user.email}</p>
              ) : null}
            </div>
          </div>

          <div className="p-2">
            <Link
              href={`/${lang}/profil/${user.id}`}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] font-bold leading-[20px] text-[#2a2a86] transition-colors hover:bg-[#faf1e8] hover:text-[#a3162c]"
            >
              <PersonIcon />
              {t.header.account}
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[15px] font-bold leading-[20px] text-[#6e6a72] transition-colors hover:bg-[#faf1e8] hover:text-[#1a1a1a]"
            >
              <LogoutIcon />
              {t.header.signOut}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.header.account}
        className={`flex h-10 shrink-0 items-center gap-2 ${BARE_CONTROL} px-2 font-nav text-[16px] font-bold leading-[24px] text-[#2a2a86] transition-colors hover:text-[#a3162c] sm:px-3`}
      >
        <PersonIcon />
        <span className="hidden md:inline">{t.header.account}</span>
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} lang={lang} />
    </>
  );
}
