import Image from "next/image";
import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";
import {
  FacebookIcon,
  GitHubIcon,
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
        { href: `/${lang}/elus`, label: t.nav.officials },
        { href: `/${lang}/projets`, label: t.nav.projects },
        { href: `/${lang}/evenements`, label: t.nav.events },
      ],
    },
    {
      heading: t.footer.participate,
      links: [
        { href: `/${lang}/sujets/nouveau`, label: t.home.report },
        { href: `/${lang}?tri=recents`, label: t.home.sortNew },
        // The policy has to be reachable from every page, which on this site
        // means the footer — there is nowhere else that appears on all of them.
        { href: `/${lang}/confidentialite`, label: t.privacy.title },
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
              {/* Every footer link is a 40px row rather than a 20px line of
                  text. Stacked one per line on a phone these are the smallest
                  targets on the site, and the rows carry the spacing that the
                  list used to get from `space-y`. */}
              <ul className="mt-1 space-y-0.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-[40px] items-center text-[14px] leading-[20px] text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* montreal.ca used to sit here. A link to the city's own homepage
              from a borough forum is the one link every visitor could already
              find; what nobody can find unless it is said is that this thing is
              open — so the column now points at the source instead. */}
          <div className="border-t border-white/40 pt-4">
            <p className="text-[16px] font-bold leading-[24px]">{t.footer.sourceCode}</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                {/* Same shape as the rows in "Nous suivre" just below: mark,
                    then name. A repository is one more place this borough
                    exists, and it should read like the others. */}
                <a
                  href="https://github.com/anis022/forum-villemtl"
                  className="inline-flex min-h-[40px] items-center gap-2 text-[14px] leading-[20px] text-white hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  <GitHubIcon />
                  GitHub
                  <span className="sr-only">{t.footer.newWindow}</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="border-t border-white/40 pt-4">
            <p className="text-[16px] font-bold leading-[24px]">{t.footer.follow}</p>
            <ul className="mt-1 space-y-0.5">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-2 text-[14px] leading-[20px] text-white hover:underline"
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
            src="/logo-ensemble-mtl.png"
            alt="Ensemble Montréal"
            width={469}
            height={166}
            className="h-[72px] w-auto brightness-0 invert"
          />
        </div>
      </div>
    </footer>
  );
}
