import Image from "next/image";
import Link from "next/link";
import type { Issue } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { CARD_INTERACTIVE, MUTED } from "@/components/ui/styles";
import { Avatar, FacePile } from "@/components/ui/avatar";
import { TranslateButton, Translated, TranslationProvider } from "@/components/translate";
import { VoteButton } from "./vote-button";
import { ShareButton } from "./share-button";
import { CategoryTag, OfficialBadge, StatusTag, authorName, formatDateShort } from "./issue-meta";

/**
 * A post, not a ticket.
 *
 * Reading order follows what a person actually needs: who is speaking, what
 * they said, the photo they attached, who already agrees, and only then the
 * controls. Category and status pair at the top right — what this is about,
 * and where it stands.
 */
export function IssueCard({
  issue,
  canVote,
  lang,
}: {
  issue: Issue;
  canVote: boolean;
  lang: Locale;
}) {
  const t = getDictionary(lang);
  const href = `/${lang}/sujets/${issue.id}`;

  return (
    // The provider spans the whole card because the words and the control that
    // swaps them sit at opposite ends of it.
    <TranslationProvider kind="issue" id={issue.id} lang={lang}>
    <article className={`${CARD_INTERACTIVE} overflow-hidden`}>
      <div className="p-3.5 sm:p-5">
        {/* Category and status hold the top right corner at every width — they
            are how you triage a feed at a glance, and moving them around by
            breakpoint would mean hunting for them. What gives instead is the
            author block: the name is one truncated line and the date is short,
            so a long name shortens itself rather than pushing the pills off a
            320px screen. */}
        <header className="flex items-start gap-2.5 sm:gap-3">
          <Link href={`/${lang}/profil/${issue.author.id}`} className="shrink-0">
            <Avatar person={issue.author} size="md" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold leading-[20px]">
              <Link href={`/${lang}/profil/${issue.author.id}`} className="truncate hover:underline">
                {authorName(issue.author, t.issue.anonymousAuthor)}
              </Link>
              {issue.author.isOfficial && <OfficialBadge lang={lang} />}
            </p>
            <p className={`mt-0.5 truncate text-[13px] leading-[18px] ${MUTED}`}>
              {formatDateShort(issue.createdAt, lang)}
            </p>
          </div>

          {/* Stacked on a phone, side by side once there is room. Sitting in a
              row the pair ate 130 of the 242 pixels a 320px card has to spend,
              which left the author's name about four characters — the corner is
              the right place for them, a whole row of it is not. */}
          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
            <CategoryTag category={issue.category} lang={lang} />
            <StatusTag status={issue.status} lang={lang} />
          </div>
        </header>

        <Link href={href} className="group mt-3 block">
          <h3 className="text-[19px] font-bold leading-[27px] break-words group-hover:text-[#097d6c]">
            <Translated field="title">{issue.title}</Translated>
          </h3>
          <p className={`mt-1.5 line-clamp-3 text-[15px] leading-[23px] ${MUTED}`}>
            <Translated field="body">{issue.body}</Translated>
          </p>
        </Link>
      </div>

      {/* The photo is evidence, not decoration — a resident attaches it to show
          you the pothole. Full bleed and large, the way every feed people
          already read presents an image, rather than a thumbnail in the margin. */}
      {issue.imageUrl && (
        <Link href={href} className="block border-y border-[#eef2f0] bg-[#f2f6f4]">
          <Image
            src={issue.imageUrl}
            alt=""
            width={1200}
            height={800}
            className="max-h-[420px] w-full object-cover"
          />
        </Link>
      )}

      <div className="p-3.5 sm:p-5">
        {/* Who is already behind this, before asking the reader to join them. */}
        {issue.supporters.length > 0 && (
          <div className="mb-3.5 flex items-center gap-2">
            <FacePile people={issue.supporters} total={issue.voteCount} />
            <p className={`text-[13px] leading-[18px] ${MUTED}`}>
              {issue.hasVoted
                ? t.vote.youAndOthers(issue.voteCount - 1)
                : t.vote.othersSupport(issue.voteCount)}
            </p>
          </div>
        )}

        <footer className="flex items-center gap-1.5 border-t border-[#eef2f0] pt-3.5">
          <VoteButton
            issueId={issue.id}
            voteCount={issue.voteCount}
            hasVoted={issue.hasVoted}
            canVote={canVote}
            lang={lang}
          />
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-bold leading-[20px] text-[#5d6b66] transition-colors hover:bg-[#f2f6f4] hover:text-[#16241f]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-5.1A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="tabular-nums">{issue.commentCount}</span>
            <span className="hidden sm:inline">
              {issue.commentCount === 1 ? t.issue.replyOne : t.issue.replyMany}
            </span>
          </Link>

          {/* The far end of the row is for the two actions that change nothing
              about the post — translating it for yourself, and passing it on.
              Translate sits to the left of share: it acts on what you are
              reading, share acts on where it goes next. */}
          <TranslateButton className="ml-auto" />
          <ShareButton path={href} title={issue.title} lang={lang} />
        </footer>
      </div>
    </article>
    </TranslationProvider>
  );
}
