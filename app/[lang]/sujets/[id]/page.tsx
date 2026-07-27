import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { VoteButton } from "@/components/issues/vote-button";
import { CommentForm } from "@/components/issues/comment-form";
import { StatusControls } from "@/components/issues/status-controls";
import {
  CategoryTag,
  OfficialBadge,
  StatusTag,
  authorName,
  formatDate,
} from "@/components/issues/issue-meta";
import { getSessionUser } from "@/utils/supabase/auth";
import { getIssue, listComments } from "@/utils/supabase/issues";
import { getDictionary, isLocale } from "@/utils/i18n";
import { CARD, CONTAINER, MUTED } from "@/components/ui/styles";

export default async function IssuePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const [user, issue] = await Promise.all([getSessionUser(), getIssue(id)]);
  if (!issue) notFound();

  const comments = await listComments(id);
  const isOfficial = user?.role === "official";

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#212529]">
      <SiteHeader user={user} lang={lang} />

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        <Link href={`/${lang}`} className="text-[14px] font-bold text-[#097d6c] hover:underline">
          {t.issue.back}
        </Link>

        <article className={`${CARD} mt-4 p-4 md:p-6`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CategoryTag category={issue.category} lang={lang} />
            <StatusTag status={issue.status} lang={lang} />
          </div>

          <div className="flex gap-3 md:gap-5">
            <VoteButton
              issueId={issue.id}
              voteCount={issue.voteCount}
              hasVoted={issue.hasVoted}
              canVote={Boolean(user)}
              lang={lang}
            />

            <div className="min-w-0 flex-1">
              <h1 className="text-[24px] font-bold leading-[32px] break-words md:text-[32px] md:leading-[40px]">
                {issue.title}
              </h1>

              <div className={`mt-2 flex flex-wrap items-center gap-2 text-[14px] ${MUTED}`}>
                <span className="inline-flex items-center gap-1.5 font-bold text-[#212529]">
                  {authorName(issue.author, t.issue.anonymousAuthor)}
                  {issue.author.isOfficial && <OfficialBadge lang={lang} />}
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatDate(issue.createdAt, lang)}</span>
              </div>

              <p className="mt-4 whitespace-pre-wrap break-words text-[17px] leading-[27px]">
                {issue.body}
              </p>

              {issue.imageUrl && (
                <Image
                  src={issue.imageUrl}
                  alt={`${t.issue.photoAlt} : ${issue.title}`}
                  width={1200}
                  height={800}
                  className="mt-5 h-auto w-full rounded-[4px] border border-[#ced4da]"
                />
              )}
            </div>
          </div>

          {isOfficial && <StatusControls issueId={issue.id} status={issue.status} lang={lang} />}
        </article>

        <section className="mt-10">
          <h2 className="border-b-[0.8px] border-[#ced4da] pb-4 text-[24px] font-bold leading-[32px] md:text-[32px] md:leading-[40px]">
            {issue.commentCount}{" "}
            {issue.commentCount === 1 ? t.issue.replyOne : t.issue.replyMany}
          </h2>

          <div className="mt-6 space-y-4">
            {comments.length === 0 && <p className={MUTED}>{t.issue.noReplies}</p>}

            {comments.map((comment) => (
              <article
                key={comment.id}
                className={
                  comment.isOfficial
                    ? "rounded-[4px] border-l-4 border-[#097d6c] bg-[#e6f4f1] p-5"
                    : `${CARD} p-5`
                }
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[14px]">
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    {authorName(comment.author, t.issue.anonymousAuthor)}
                    {comment.author.isOfficial && <OfficialBadge lang={lang} />}
                  </span>
                  <span aria-hidden="true" className={MUTED}>
                    ·
                  </span>
                  <span className={MUTED}>{formatDate(comment.createdAt, lang)}</span>
                </div>

                {comment.isOfficial && (
                  <p className="mb-2 text-[14px] font-bold text-[#097d6c]">
                    {t.issue.officialAnswer}
                  </p>
                )}

                <p className="whitespace-pre-wrap break-words leading-[26px]">{comment.body}</p>
              </article>
            ))}
          </div>

          <div className={`${CARD} mt-8 p-6`}>
            {user ? (
              <CommentForm issueId={issue.id} isOfficial={isOfficial} lang={lang} />
            ) : (
              <p className={MUTED}>{t.issue.signInToComment}</p>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
