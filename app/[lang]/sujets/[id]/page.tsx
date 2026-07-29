import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { VoteButton } from "@/components/issues/vote-button";
import { ShareButton } from "@/components/issues/share-button";
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
import { Avatar } from "@/components/ui/avatar";

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

        <article className={`${CARD} mt-4 overflow-hidden`}>
          <div className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <Link href={`/${lang}/profil/${issue.author.id}`} className="shrink-0">
                <Avatar person={issue.author} size="md" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-bold leading-[20px]">
                  <Link href={`/${lang}/profil/${issue.author.id}`} className="hover:underline">
                    {authorName(issue.author, t.issue.anonymousAuthor)}
                  </Link>
                  {issue.author.isOfficial && <OfficialBadge lang={lang} />}
                </p>
                <p className={`mt-0.5 text-[13px] leading-[18px] ${MUTED}`}>
                  {formatDate(issue.createdAt, lang)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <CategoryTag category={issue.category} lang={lang} />
                <StatusTag status={issue.status} lang={lang} />
              </div>
            </div>

            <h1 className="mt-4 text-[24px] font-bold leading-[32px] break-words md:text-[30px] md:leading-[38px]">
              {issue.title}
            </h1>

            <p className="mt-3 max-w-[68ch] whitespace-pre-wrap break-words text-[17px] leading-[27px]">
              {issue.body}
            </p>
          </div>

          {/* Full bleed: the photo is what the report is about. */}
          {issue.imageUrl && (
            <div className="border-y border-[#eef2f0] bg-[#f2f6f4]">
              <Image
                src={issue.imageUrl}
                alt={`${t.issue.photoAlt} : ${issue.title}`}
                width={1600}
                height={1000}
                className="max-h-[620px] w-full object-contain"
              />
            </div>
          )}

          <div className="p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-[#eef2f0] pt-4">
              <VoteButton
                issueId={issue.id}
                voteCount={issue.voteCount}
                hasVoted={issue.hasVoted}
                canVote={Boolean(user)}
                lang={lang}
              />
              <span className={`text-[14px] ${MUTED}`}>
                {issue.hasVoted
                  ? t.vote.youAndOthers(issue.voteCount - 1)
                  : t.vote.othersSupport(issue.voteCount)}
              </span>
              {/* Bottom right, at the far end of the action row: sharing is the
                  one control here that changes nothing. */}
              <ShareButton
                path={`/${lang}/sujets/${issue.id}`}
                title={issue.title}
                lang={lang}
                className="ml-auto"
              />
            </div>

            {isOfficial && <StatusControls issueId={issue.id} status={issue.status} lang={lang} />}
          </div>
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
                    ? "flex gap-3 rounded-[4px] border-l-4 border-[#097d6c] bg-[#e6f4f1] p-5"
                    : `${CARD} flex gap-3 p-5`
                }
              >
                <Link href={`/${lang}/profil/${comment.author.id}`} className="shrink-0">
                  <Avatar person={comment.author} size="md" />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px]">
                    <Link
                      href={`/${lang}/profil/${comment.author.id}`}
                      className="font-bold hover:underline"
                    >
                      {authorName(comment.author, t.issue.anonymousAuthor)}
                    </Link>
                    {comment.author.isOfficial && <OfficialBadge lang={lang} />}
                    <span aria-hidden="true" className={MUTED}>
                      ·
                    </span>
                    <span className={MUTED}>{formatDate(comment.createdAt, lang)}</span>
                  </div>

                  {comment.isOfficial && (
                    <p className="mt-1 text-[14px] font-bold text-[#097d6c]">
                      {t.issue.officialAnswer}
                    </p>
                  )}

                  <p className="mt-1.5 whitespace-pre-wrap break-words leading-[26px]">
                    {comment.body}
                  </p>
                </div>
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
