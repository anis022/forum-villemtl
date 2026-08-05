import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";
import { DEFAULT_LOCALE, LOCALES, isLocale } from "@/utils/i18n";

/** Best supported locale from the Accept-Language header, else the default. */
function preferredLocale(request: NextRequest) {
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Route handlers are not localized. `/auth` is the email callback Supabase
  // returns people to; `/api` is machine-facing — the daily events cron lands
  // there, and a redirect to /fr/api/… turns a scheduled sync into a 307 that
  // Vercel's cron does not follow, so the map silently stops updating.
  if (!pathname.startsWith("/auth") && !pathname.startsWith("/api")) {
    const hasLocale = LOCALES.some(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    );

    if (!hasLocale) {
      const url = request.nextUrl.clone();
      // A cookie set by the language toggle wins over the browser's header,
      // so an explicit choice survives later visits to an unprefixed URL.
      const cookieLocale = request.cookies.get("locale")?.value;
      const locale =
        cookieLocale && isLocale(cookieLocale) ? cookieLocale : preferredLocale(request);
      url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
      return NextResponse.redirect(url);
    }
  }

  // Refreshes the Supabase auth token and rewrites the session cookies.
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets: images, fonts, icons
     *
     * Every static extension the site serves has to be listed. Anything left
     * out gets a locale prefix — /fonts/… became /fr/fonts/… and 404'd, taking
     * the brand typeface down silently, and /cdn-ndg.geojson did the same to
     * the borough outline. When adding an asset type to public/, add it here.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|json|geojson|txt|xml)$).*)",
  ],
};
