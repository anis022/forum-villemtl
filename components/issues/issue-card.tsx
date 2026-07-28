import Image from "next/image";
import Link from "next/link";
import type { Issue } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { CARD, MUTED } from "@/components/ui/styles";
import { Avatar, FacePile } from "@/components/ui/avatar";
import { VoteButton } from "./vote-button";
import { CategoryTag, OfficialBadge, StatusTag, authorName, formatDate } from "./issue-meta";

/**
 * A post, not a ticket.
 *
 * The author leads — face, name, when — the way every social feed opens, and
 * the engagement sits along the bottom as a footer rather than as a counter
 * bolted to the left edge. The face pile matters more than the number next to
 * it: "twelve people" is an abstraction, six faces is a neighbourhood.
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
    <article className={`${CARD} p-4 transition-shadow hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.08)]`}>
      <header className="flex items-center gap-3">
        <Avatar person={issue.author} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] font-bold leading-[20px]">
            {authorName(issue.author, t.issue.anonymousAuthor)}
            {issue.author.isOfficial && <OfficialBadge lang={lang} />}
          </p>
          <p className={`text-[13px] leading-[18px] ${MUTED}`}>{formatDate(issue.createdAt, lang)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <CategoryTag category={issue.category} lang={lang} />
          <StatusTag status={issue.status} lang={lang} />
        </div>
      </header>

      <h3 className="mt-3 text-[18px] font-bold leading-[26px] break-words">
        <Link href={href} className="hover:underline">
          {issue.title}
        </Link>
      </h3>

      <div className="mt-1 flex gap-3">
        <p className={`line-clamp-3 flex-1 text-[15px] leading-[22px] ${MUTED}`}>{issue.body}</p>
        {issue.imageUrl && (
          <Image
            src={issue.imageUrl}
            alt=""
            width={192}
            height={128}
            className="hidden h-20 w-28 shrink-0 rounded-[4px] border border-[#ced4da] object-cover sm:block"
          />
        )}
      </div>

      {/* Who is already behind this, before asking the reader to join them. */}
      {issue.supporters.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <FacePile people={issue.supporters} total={issue.voteCount} />
          <p className={`text-[13px] leading-[18px] ${MUTED}`}>
            {issue.hasVoted
              ? t.vote.youAndOthers(issue.voteCount - 1)
              : t.vote.othersSupport(issue.voteCount)}
          </p>
        </div>
      )}

      <footer className="mt-3 flex items-center gap-2 border-t-[0.8px] border-[#e9ecef] pt-3">
        <VoteButton
          issueId={issue.id}
          voteCount={issue.voteCount}
          hasVoted={issue.hasVoted}
          canVote={canVote}
          lang={lang}
        />
        <Link
          href={href}
          className="inline-flex h-9 items-center gap-2 rounded-[4px] px-3 text-[14px] font-bold text-[#637381] transition-colors hover:bg-[#f1f3f5] hover:text-[#212529]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-5.1A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {issue.commentCount}{" "}
          {issue.commentCount === 1 ? t.issue.replyOne : t.issue.replyMany}
        </Link>
      </footer>
    </article>
  );
}
