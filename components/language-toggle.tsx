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
    <button
      type="button"
      onClick={switchTo}
      lang={other}
      /* No radius of its own: an underlined word in the utility bar is a link,
         not a button, so it takes the small base-layer floor for its ring. */
      className="px-2.5 py-0.5 text-[14px] font-bold leading-[20px] text-white hover:underline"
    >
      {label}
    </button>
  );
}
