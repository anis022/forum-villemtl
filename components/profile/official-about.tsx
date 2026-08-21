import { say, type Official } from "@/utils/officials";
import { getDictionary, type Locale } from "@/utils/i18n";
import { CARD, LINK_QUIET, MUTED } from "@/components/ui/styles";

/**
 * What an elected person's profile says beyond their activity: the seats they
 * hold, and nothing else.
 *
 * It sits on the resident profile page rather than on a page of its own,
 * because that is the claim this forum makes: an elected official here is
 * another participant whose posts you can read, with a public function attached
 * — not a directory entry filed somewhere else on the site.
 *
 * There is deliberately no summary paragraph and no office address. The role
 * and the district are already under the name; an address restates what
 * montreal.ca keeps current, and a paragraph restating the list below it is
 * padding. The portfolios are the part worth reading: "conseiller de la Ville"
 * tells a resident nothing about what to write to them about, "responsable de
 * l'optimisation et de la performance municipale" tells them exactly.
 */
export function OfficialAbout({ person, lang }: { person: Official; lang: Locale }) {
  const t = getDictionary(lang);

  return (
    <section className={`${CARD} mt-6 p-5 md:p-6`}>
      <h2 className="text-[20px] leading-[28px] md:text-[22px] md:leading-[30px]">
        {t.officials.mandatesTitle}
      </h2>

      {/* Rows, not a table: two columns of short text is a table in name only,
          and on a phone it would be two words per line. */}
      <ul className="mt-3 divide-y divide-[#f2ece4]">
        {person.mandates.map((mandate) => (
          <li key={say(mandate.body, lang)} className="py-3 first:pt-0 last:pb-0">
            <p className="text-[15px] font-bold leading-[22px] break-words">
              {mandate.url ? (
                <a
                  href={mandate.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_QUIET}
                >
                  {say(mandate.body, lang)}
                  <span className="sr-only"> {t.footer.newWindow}</span>
                </a>
              ) : (
                say(mandate.body, lang)
              )}
            </p>
            <p className={`mt-0.5 text-[14px] leading-[20px] ${MUTED}`}>
              {say(mandate.title, lang)}
            </p>
            {mandate.portfolio && (
              <p className="mt-1 text-[14px] leading-[20px] text-[#a3162c]">
                {say(mandate.portfolio, lang)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
