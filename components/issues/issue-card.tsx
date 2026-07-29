import Image from "next/image";
import Link from "next/link";
import type { Issue } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { CARD_INTERACTIVE, MUTED } from "@/components/ui/styles";
import { Avatar, FacePile } from "@/components/ui/avatar";
import { VoteButton } from "./vote-button";
import { ShareButton } from "./share-button";
import { CategoryTag, OfficialBadge, StatusTag, authorName, formatDate } from "./issue-meta";

/**
 * A post, not a ticket.
 *
 * The author leads — face, name, when — the way every feed people already use
 * opens, and the engagement sits along the bottom as a row of actions. The
 * face pile matters more than the number beside it: "twelve people" is an
 * abstraction, six faces is a neighbourhood.
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
    <article className={`${CARD_INTERACTIVE} p-4 sm:p-5`}>
      <header className="flex items-start gap-3">
        <Link href={`/${lang}/profil/${issue.author.id}`} className="shrink-0">
          <Avatar person={issue.author} size="md" />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] font-bold leading-[20px]">
            <Link href={`/${lang}/profil/${issue.author.id}`} className="hover:underline">
              {authorName(issue.author, t.issue.anonymousAuthor)}
            </Link>
            {issue.author.isOfficial && <OfficialBadge lang={lang} />}
          </p>
          <p className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[18px] ${MUTED}`}>
            <span>{formatDate(issue.createdAt, lang)}</span>
            <span aria-hidden="true">·</span>
            <CategoryTag category={issue.category} lang={lang} />
          </p>
        </div>

        {/* Status and share sit together top-right: one says where the issue
            stands, the other is the only action that belongs outside the row. */}
        <div className="flex shrink-0 items-center gap-1">
          <StatusTag status={issue.status} lang={lang} />
          <ShareButton path={href} title={issue.title} lang={lang} />
        </div>
      </header>

      <Link href={href} className="mt-3 block group">
        <h3 className="text-[19px] font-bold leading-[27px] break-words group-hover:text-[#097d6c]">
          {issue.title}
        </h3>
        <div className="mt-1.5 flex gap-4">
          <p className={`line-clamp-3 flex-1 text-[15px] leading-[23px] ${MUTED}`}>{issue.body}</p>
          {issue.imageUrl && (
            <Image
              src={issue.imageUrl}
              alt=""
              width={224}
              height={160}
              className="hidden h-24 w-32 shrink-0 rounded-[12px] object-cover sm:block"
            />
          )}
        </div>
      </Link>

      {/* Who is already behind this, before asking the reader to join them. */}
      {issue.supporters.length > 0 && (
        <div className="mt-3.5 flex items-center gap-2">
          <FacePile people={issue.supporters} total={issue.voteCount} />
          <p className={`text-[13px] leading-[18px] ${MUTED}`}>
            {issue.hasVoted
              ? t.vote.youAndOthers(issue.voteCount - 1)
              : t.vote.othersSupport(issue.voteCount)}
          </p>
        </div>
      )}

      <footer className="mt-3.5 flex items-center gap-1.5 border-t border-[#eef2f0] pt-3.5">
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
      </footer>
    </article>
  );
}
