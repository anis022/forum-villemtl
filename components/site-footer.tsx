import Image from "next/image";
import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";
import {
  FacebookIcon,
  InstagramIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/social-icons";
import { CONTAINER } from "@/components/ui/styles";
import { getDictionary, type Locale } from "@/utils/i18n";

/** Official Côte-des-Neiges–Notre-Dame-de-Grâce accounts. */
const SOCIALS = [
  { label: "Facebook", href: "https://www.facebook.com/CDN.NDG/", Icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/cdn_ndg/?hl=en", Icon: InstagramIcon },
  { label: "X (Twitter)", href: "https://x.com/CDN_NDG", Icon: XIcon },
  { label: "YouTube", href: "https://www.youtube.com/user/CDNNDG", Icon: YouTubeIcon },
];

/**
 * Mirrors the montreal.ca footer: #212529 ground, "Haut de page" aligned right,
 * columns capped by a hairline rule with 16px bold headings and 14px links,
 * then a bottom bar carrying the wordmark. Padding 16px top / 64px bottom.
 */
export function SiteFooter({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);

  const columns = [
    {
      heading: t.nav.sections,
      links: [
        { href: `/${lang}`, label: t.nav.forum },
        { href: `/${lang}/projets`, label: t.nav.projects },
        { href: `/${lang}/evenements`, label: t.nav.events },
      ],
    },
    {
      heading: t.footer.participate,
      links: [
        { href: `/${lang}/sujets/nouveau`, label: t.home.report },
        { href: `/${lang}?tri=recents`, label: t.home.sortNew },
      ],
    },
  ];

  return (
    <footer className="bg-[#212529] pb-16 pt-4 text-white">
      <div className={CONTAINER}>
        <div className="flex justify-end">
          <BackToTop label={t.footer.backToTop} />
        </div>

        <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          {columns.map((column) => (
            <div key={column.heading} className="border-t border-white/40 pt-4">
              <p className="text-[16px] font-bold leading-[24px]">{column.heading}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] leading-[20px] text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="border-t border-white/40 pt-4">
            <p className="text-[16px] font-bold leading-[24px]">{t.footer.borough}</p>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href="https://montreal.ca"
                  className="inline-flex items-center gap-1 text-[14px] leading-[20px] text-white hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  montreal.ca
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none">
                    <path
                      d="M4.5 1.5H10.5V7.5M10.5 1.5L5 7M8 8.5v2h-6.5V4h2"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="sr-only">{t.footer.newWindow}</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="border-t border-white/40 pt-4">
            <p className="text-[16px] font-bold leading-[24px]">{t.footer.follow}</p>
            <ul className="mt-3 space-y-2">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-[14px] leading-[20px] text-white hover:underline"
                  >
                    <Icon />
                    {label}
                    <span className="sr-only">{t.footer.newWindow}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/40 pt-8">
          <Image
            src="/logo-montreal.png"
            alt="Ville de Montréal"
            width={260}
            height={120}
            className="h-[72px] w-auto brightness-0 invert"
          />
        </div>
      </div>
    </footer>
  );
}
