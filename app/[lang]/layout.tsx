import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Nunito_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { LOCALES, getDictionary, isLocale } from "@/utils/i18n";
import { siteOrigin } from "@/utils/site";

// ensemblemtl.org's two faces: Inter for everything, Nunito Sans for the
// navigation only. The site used to be set in the Ville de Montréal brand
// typeface, self-hosted from montreal.ca — not a typeface this site has any
// business using.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const nav = Nunito_Sans({
  variable: "--font-nav",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Every page carried the same title and no link preview at all. The forum puts
 * a share button on each topic, so a shared link was landing in a group chat as
 * a bare URL with nothing to say what it was.
 *
 * The template lets a page set its own short title and get the site name
 * appended. `metadataBase` is what resolves the relative canonical and image
 * paths below into the absolute URLs a scraper needs.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "fr";
  const t = getDictionary(locale);

  return {
    metadataBase: new URL(siteOrigin()),
    title: {
      default: t.meta.siteName,
      template: `%s · ${t.meta.siteName}`,
    },
    description: t.meta.siteDescription,
    openGraph: {
      type: "website",
      siteName: t.meta.siteName,
      title: t.meta.siteName,
      description: t.meta.siteDescription,
      locale: locale === "fr" ? "fr_CA" : "en_CA",
    },
    twitter: { card: "summary" },
    alternates: {
      canonical: `/${locale}`,
      languages: { "fr-CA": "/fr", "en-CA": "/en" },
    },
  };
}

// Explicit so mobile browsers render at device width (base of all responsive
// layout — without it phones render the page at ~980px and zoom out).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Light-only site. Without this a phone in dark mode gets a browser-invented
  // dark rendering of a palette that has no dark version.
  colorScheme: "light",
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      className={`${sans.variable} ${nav.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Page content lives in its own root so the auth modal can blur it.
            The modal portals to <body>, outside this element, so it stays sharp. */}
        <div id="page-root" className="flex min-h-full flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
