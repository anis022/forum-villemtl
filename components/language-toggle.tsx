"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCALES, type Locale } from "@/utils/i18n";

/**
 * Swaps the locale segment of the current URL, keeping the rest of the path
 * and the query string, so the reader stays on the page they were reading.
 */
export function LanguageToggle({ lang, label }: { lang: Locale; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const other = LOCALES.find((locale) => locale !== lang) ?? "en";

  const switchTo = () => {
    const rest = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), "");
    const query = searchParams.toString();
    // Remembered so an unprefixed URL later resolves to the chosen language.
    document.cookie = `locale=${other}; path=/; max-age=31536000; samesite=lax`;
    router.push(`/${other}${rest}${query ? `?${query}` : ""}`);
  };

  return (
    /* Their "ENGLISH": uppercase, letterspaced, white on the aubergine strip.
       No radius of its own — a word in a utility bar is a link, not a button,
       so it takes the small base-layer floor for its focus ring. */
    <button
      type="button"
      onClick={switchTo}
      lang={other}
      className="inline-flex h-10 shrink-0 items-center px-2.5 text-[13px] font-bold uppercase leading-[20px] tracking-[0.06em] text-white transition-opacity hover:opacity-75 hover:underline"
    >
      {label}
    </button>
  );
}
