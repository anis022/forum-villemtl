import Image from "next/image";
import Link from "next/link";
import type { Issue } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { CARD, MUTED } from "@/components/ui/styles";
import { VoteButton } from "./vote-button";
import { CategoryTag, OfficialBadge, StatusTag, authorName, formatDate } from "./issue-meta";

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

  return (
    <article className={`${CARD} flex gap-4 p-4 transition-colors hover:border-[#097d6c]`}>
      <VoteButton
        issueId={issue.id}
        voteCount={issue.voteCount}
        hasVoted={issue.hasVoted}
        canVote={canVote}
        lang={lang}
      />

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CategoryTag category={issue.category} lang={lang} />
          <StatusTag status={issue.status} lang={lang} />
        </div>

        <h3 className="text-[18px] font-bold leading-[26px] break-words">
          <Link href={`/${lang}/sujets/${issue.id}`} className="hover:underline">
            {issue.title}
          </Link>
        </h3>

        <div className="mt-1 flex gap-3">
          <p className={`line-clamp-2 flex-1 ${MUTED}`}>{issue.body}</p>
          {issue.imageUrl && (
            <Image
              src={issue.imageUrl}
              alt=""
              width={160}
              height={112}
              className="hidden h-14 w-20 shrink-0 rounded-[4px] border border-[#ced4da] object-cover sm:block"
            />
          )}
        </div>

        <div className={`mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] ${MUTED}`}>
          <span className="inline-flex items-center gap-1.5 font-bold text-[#212529]">
            {authorName(issue.author, t.issue.anonymousAuthor)}
            {issue.author.isOfficial && <OfficialBadge lang={lang} />}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(issue.createdAt, lang)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {issue.commentCount}{" "}
            {issue.commentCount === 1 ? t.issue.replyOne : t.issue.replyMany}
          </span>
        </div>
      </div>
    </article>
  );
}
