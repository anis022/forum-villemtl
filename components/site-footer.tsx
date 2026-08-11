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
 * This was montreal.ca's footer: #212529 ground, four columns each capped by a
 * hairline rule, "Haut de page" hanging off the top right. It is theirs now,
 * and the first thing that changes is that it is not dark — ensemblemtl.org
 * closes on the same warm cream the masthead opens with, wordmark at full
 * colour on the left, a heading and red arrow links on the right, then a thin
 * legal strip carrying the small print and the social marks.
 *
 * Every link is still a 40px row. Stacked one per line on a phone these are the
 * smallest targets on the site, and the rows carry the spacing the lists used to
 * get from `space-y`.
 */
export function SiteFooter({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);

  const columns = [
    {
      heading: t.nav.sections,
      links: [
        { href: `/${lang}`, label: t.nav.short.forum },
        { href: `/${lang}/elus`, label: t.nav.short.officials },
        { href: `/${lang}/conseils`, label: t.nav.short.council },
        { href: `/${lang}/projets`, label: t.nav.short.projects },
        { href: `/${lang}/evenements`, label: t.nav.short.events },
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

  /* Their footer headings are large and unbolded — the weight comes from size,
     not from the type being heavy. */
  const heading = "text-[22px] leading-[30px] text-[#1a1a1a]";
  const row =
    "group inline-flex min-h-[40px] items-center gap-1.5 text-[15px] font-bold leading-[22px] text-[#fa3250] transition-colors hover:text-[#d81f3c]";

  return (
    <footer className="border-t border-[#e9e0d6] bg-[#fef7f0] text-[#1a1a1a]">
      <div className={`${CONTAINER} pb-8 pt-12`}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
          <div>
            <Image
              src="/logo-ensemble-mtl.png"
              alt="Ensemble Montréal"
              width={469}
              height={166}
              className="h-14 w-auto max-w-full"
            />
            <p className="mt-5 max-w-[46ch] text-[15px] leading-[24px] text-[#6e6a72]">
              {t.footer.tagline}
            </p>
          </div>

          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.heading}>
                <p className={heading}>{column.heading}</p>
                <ul className="mt-2 space-y-0.5">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link href={link.href} className={row}>
                        {link.label}
                        <Arrow />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* montreal.ca used to sit here. A link to the city's own homepage
                from a borough forum is the one link every visitor could already
                find; what nobody can find unless it is said is that this thing
                is open — so the column points at the source instead. */}
            <div>
              <p className={heading}>{t.footer.sourceCode}</p>
              <ul className="mt-2 space-y-0.5">
                <li>
                  <a
                    href="https://github.com/anis022/forum-villemtl"
                    className={row}
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
          </div>
        </div>
      </div>

      {/* Their bottom strip: small print left, social marks right. */}
      <div className="border-t border-[#e9e0d6]">
        <div
          className={`${CONTAINER} flex flex-col-reverse items-start gap-2 py-3 sm:flex-row sm:items-center sm:justify-between`}
        >
          <p className="max-w-[62ch] text-[13px] leading-[19px] text-[#6e6a72]">{t.footer.legal}</p>
          <div className="flex items-center gap-1">
            <ul className="flex items-center">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[#32004a] transition-colors hover:bg-white hover:text-[#fa3250]"
                  >
                    <Icon />
                    <span className="sr-only">
                      {label} {t.footer.newWindow}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <BackToTop label={t.footer.backToTop} />
          </div>
        </div>
      </div>
    </footer>
  );
}

/** The arrow that trails every link on their site, nudging on hover. */
function Arrow() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 transition-transform group-hover:translate-x-0.5"
    >
      <path
        d="M4 12h15m0 0-6-6m6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
