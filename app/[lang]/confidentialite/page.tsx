import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { POLICY, PRIVACY_CONTACT, CONTACT_MISSING, type Block } from "@/utils/privacy";
import { getDictionary, isLocale } from "@/utils/i18n";
import { ALERT, CARD, CONTAINER, HERO_BAND, LINK, MUTED } from "@/components/ui/styles";

export const metadata = { title: "Confidentialité" };

/**
 * The privacy policy.
 *
 * Set in the reading measure rather than the full container: this is the one
 * page on the site meant to be read start to finish, and a two-thousand-word
 * document at 1200px is a document nobody finishes.
 *
 * The "what is public" section comes first, ahead of the legally-shaped ones.
 * A resident opening this page is almost never asking which statute applies —
 * they are asking whether the pin they just dropped says where they live. The
 * order answers that question before it explains itself.
 */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  const policy = POLICY[lang];

  return (
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-[#16241f]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          <div className="mx-auto w-full max-w-[720px]">
            <h1 className="text-[26px] font-bold leading-[34px] break-words sm:text-[28px] sm:leading-[36px] md:text-[40px] md:leading-[52px]">
              {t.privacy.title}
            </h1>
            <p className={`mt-3 text-[16px] leading-[25px] ${MUTED}`}>{policy.intro}</p>
            <p className={`mt-3 text-[13px] ${MUTED}`}>
              {t.privacy.updated} {policy.updated}
            </p>
          </div>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-12`}>
        <div className="mx-auto w-full max-w-[720px]">
          {policy.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 border-t border-[#dde5e1] pt-7 first:border-t-0 first:pt-0 [&+section]:mt-9">
              <h2 className="text-[21px] font-bold leading-[29px] break-words md:text-[24px] md:leading-[32px]">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {section.blocks.map((block, i) => (
                  <Rendered key={i} block={block} />
                ))}
              </div>
            </section>
          ))}

          {/* Last, and its own card: this is the only part of the page that is
              an instruction rather than a description. */}
          <section id="contact" className="mt-9 scroll-mt-24 border-t border-[#dde5e1] pt-7">
            <h2 className="text-[21px] font-bold leading-[29px] md:text-[24px] md:leading-[32px]">
              {t.privacy.contactHeading}
            </h2>
            <div className={`${CARD} mt-3 p-4 md:p-5`}>
              <p className="text-[16px] leading-[25px]">{t.privacy.contactBody}</p>
              {CONTACT_MISSING ? (
                /* Rendered, not hidden. A policy whose contact is blank is
                   broken in a way the reader can see and report; one filled
                   with a plausible invented address is broken silently. */
                <p role="alert" className={`mt-3 ${ALERT}`}>
                  {t.privacy.contactMissing}
                </p>
              ) : (
                <p className="mt-2 text-[16px] font-bold">
                  <a href={`mailto:${PRIVACY_CONTACT}`} className={LINK}>
                    {PRIVACY_CONTACT}
                  </a>
                </p>
              )}
              <p className={`mt-3 text-[14px] leading-[21px] ${MUTED}`}>
                {t.privacy.contactCai}{" "}
                <a
                  href="https://www.cai.gouv.qc.ca"
                  target="_blank"
                  rel="noreferrer"
                  className={LINK}
                >
                  cai.gouv.qc.ca
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}

function Rendered({ block }: { block: Block }) {
  if (block.kind === "p") {
    return <p className="text-[16px] leading-[25px]">{block.text}</p>;
  }

  if (block.kind === "list") {
    return (
      // A dash rather than a bullet glyph, and hanging indent, so a five-line
      // item still reads as one item.
      <ul className="space-y-2">
        {block.items.map((item, i) => (
          <li key={i} className="grid grid-cols-[0.9rem_minmax(0,1fr)] gap-x-2 text-[16px] leading-[25px]">
            <span aria-hidden="true" className="text-[#097d6c]">
              —
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[30rem] border-collapse text-[15px]">
        <thead>
          <tr>
            {block.head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="border-b border-[#c7d5d0] py-2 pr-4 text-left text-[13px] font-bold text-[#5d6b66]"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border-b border-[#dde5e1] py-2 pr-4 align-top leading-[22px]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
