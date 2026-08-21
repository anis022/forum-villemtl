import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { VoteButton } from "@/components/issues/vote-button";
import { ShareButton } from "@/components/issues/share-button";
import { CommentForm } from "@/components/issues/comment-form";
import { CommentThread } from "@/components/issues/comment-thread";
import { IssuePhoto } from "@/components/issues/issue-photo";
import { TranslateButton, Translated, TranslationProvider } from "@/components/translate";
import { StatusControls } from "@/components/issues/status-controls";
import {
  CategoryTag,
  OfficialBadge,
  ProfileLink,
  StatusTag,
  authorName,
  formatDate,
  formatDateShort,
} from "@/components/issues/issue-meta";
import { getSessionContext } from "@/utils/supabase/auth";
import { REPLIES_PAGE, getIssue, listComments } from "@/utils/supabase/issues";
import { editedByOther } from "@/utils/issues";
import { IssueActions } from "@/components/issues/issue-actions";
import { getDictionary, isLocale } from "@/utils/i18n";
import { BTN_SECONDARY, CARD, MUTED, PAGE_MAIN, PAGE_SHELL } from "@/components/ui/styles";
import { Avatar } from "@/components/ui/avatar";

export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const { r } = await searchParams;
  const [viewer, issue] = await Promise.all([getSessionContext(), getIssue(id)]);
  if (!issue) notFound();
  const { user, canParticipate } = viewer;

  // Clamped for the same reason as the feed: this number comes from the address
  // bar, and an unbounded one is a request to render every reply ever written.
  const shownReplies = Math.min(
    Math.max(Number(r) || REPLIES_PAGE, REPLIES_PAGE),
    REPLIES_PAGE * 10,
  );
  const { comments, hasMore: moreReplies, threaded } = await listComments(id, shownReplies);
  const isOfficial = canParticipate && user?.role === "official";
  const isAuthor = canParticipate && Boolean(user) && user!.id === issue.author.id;

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <main className={PAGE_MAIN}>
        <Link href={`/${lang}`} className="text-[14px] font-bold text-[#fa3250] hover:underline">
          {t.issue.back}
        </Link>

        <TranslationProvider kind="issue" id={issue.id} lang={lang}>
        <article className={`${CARD} mt-4 overflow-hidden`}>
          <div className="p-4 md:p-6">
            {/* Same shape as the feed card: pills in the top right corner, and
                the author block truncates rather than pushing them off. */}
            <div className="flex items-start gap-3">
              <ProfileLink author={issue.author} lang={lang} className="shrink-0">
                <Avatar person={issue.author} size="md" />
              </ProfileLink>
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold leading-[20px]">
                  <ProfileLink
                    author={issue.author}
                    lang={lang}
                    className="truncate hover:underline"
                  >
                    {authorName(issue.author, t.issue.anonymousAuthor)}
                  </ProfileLink>
                  {issue.author.isOfficial && (
                    <OfficialBadge lang={lang} elected={issue.author.isElected} />
                  )}
                </p>
                <p className={`mt-0.5 truncate text-[13px] leading-[18px] ${MUTED}`}>
                  {formatDateShort(issue.createdAt, lang)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
                <CategoryTag category={issue.category} lang={lang} />
                <StatusTag status={issue.status} lang={lang} />
              </div>
            </div>

            {/* Only ever on reports filed before editing was removed — see
                migration 0019. Kept rather than hidden: a post that says it was
                changed is telling the truth about itself, and quietly dropping
                the notice would rewrite the history of every report that had
                been corrected, which is the thing removing editing was meant to
                stop. It gets its own line rather than trailing the date behind
                a separator: squeezed into the corner beside the pills it
                wrapped into a column of fragments, and an edit by someone other
                than the author is the one piece of metadata here that must be
                easy to read. */}
            {issue.editedAt && (
              <p
                className={`mt-2 break-words text-[13px] leading-[18px] ${
                  editedByOther(issue) ? "font-bold text-[#b8660a]" : MUTED
                }`}
              >
                {editedByOther(issue)
                  ? t.issue.editedByOfficial(formatDate(issue.editedAt, lang))
                  : t.issue.editedByAuthor(formatDate(issue.editedAt, lang))}
              </p>
            )}

            <h1 className="mt-4 text-[24px] leading-[32px] break-words md:text-[30px] md:leading-[38px]">
              <Translated field="title">{issue.title}</Translated>
            </h1>

            <p className="mt-3 max-w-[68ch] whitespace-pre-wrap break-words text-[17px] leading-[27px]">
              <Translated field="body">{issue.body}</Translated>
            </p>
          </div>

          {/* Full bleed: the photo is what the report is about, so it gets more
              height here than in the feed and the same whole-image treatment. */}
          {issue.imageUrl && (
            <IssuePhoto
              src={issue.imageUrl}
              alt={`${t.issue.photoAlt} : ${issue.title}`}
              cap="max-h-[620px]"
              sizes="(min-width: 1024px) 900px, 100vw"
            />
          )}

          <div className="p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-[#f2ece4] pt-4">
              <VoteButton
                issueId={issue.id}
                voteCount={issue.voteCount}
                hasVoted={issue.hasVoted}
                canVote={canParticipate}
                lang={lang}
              />
              <span className={`text-[14px] ${MUTED}`}>
                {issue.hasVoted
                  ? t.vote.youAndOthers(issue.voteCount - 1)
                  : t.vote.othersSupport(issue.voteCount)}
              </span>
              {/* Bottom right, at the far end of the action row: the two
                  controls here that change nothing about the report — reading
                  it in your own language, and passing it on. */}
              <TranslateButton className="ml-auto" />
              <ShareButton
                path={`/${lang}/sujets/${issue.id}`}
                title={issue.title}
                lang={lang}
              />
            </div>

            {isOfficial && <StatusControls issueId={issue.id} status={issue.status} lang={lang} />}

            <IssueActions
              issueId={issue.id}
              lang={lang}
              canWithdraw={isAuthor || isOfficial}
              actingAsOfficial={!isAuthor && isOfficial}
              labels={{
                withdraw: t.issue.withdraw,
                withdrawing: t.issue.withdrawing,
                confirmTitle: t.issue.withdrawConfirmTitle,
                confirmBody: t.issue.withdrawConfirmBody,
                confirmYes: t.issue.withdrawConfirmYes,
                cancel: t.issue.cancelEdit,
                officialNote: t.issue.withdrawOfficialNote,
              }}
            />
          </div>
        </article>
        </TranslationProvider>

        <section className="mt-10">
          <h2 className="border-b border-[#e9e0d6] pb-4 text-[24px] leading-[32px] md:text-[32px] md:leading-[40px]">
            {issue.commentCount}{" "}
            {issue.commentCount === 1 ? t.issue.replyOne : t.issue.replyMany}
          </h2>

          <div className="mt-6 space-y-4">
            {comments.length === 0 && <p className={MUTED}>{t.issue.noReplies}</p>}

            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                issueId={issue.id}
                viewerId={canParticipate ? (user?.id ?? null) : null}
                isOfficial={isOfficial}
                threaded={threaded}
                lang={lang}
              />
            ))}

            {/* Same reasoning as the feed: paging lives in the URL so it works
                without JavaScript and can be linked to. */}
            {moreReplies && (
              <Link
                href={`/${lang}/sujets/${issue.id}?r=${shownReplies + REPLIES_PAGE}`}
                scroll={false}
                className={`${BTN_SECONDARY} w-full`}
              >
                {t.issue.showMoreReplies}
              </Link>
            )}
          </div>

          <div className={`${CARD} mt-8 p-6`}>
            {canParticipate ? (
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
