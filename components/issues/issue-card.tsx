import Link from "next/link";
import type { Issue } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { CARD_INTERACTIVE, MUTED } from "@/components/ui/styles";
import { Avatar, FacePile } from "@/components/ui/avatar";
import { TranslateButton, Translated, TranslationProvider } from "@/components/translate";
import { IssuePhoto } from "./issue-photo";
import { PollBallot } from "@/components/polls/poll-ballot";
import { VoteButton } from "./vote-button";
import type { Ballot } from "@/utils/polls";
import { ShareButton } from "./share-button";
import {
  CategoryTag,
  OfficialBadge,
  ProfileLink,
  StatusTag,
  authorName,
  formatDateShort,
} from "./issue-meta";

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
  ballot,
  canVote,
  lang,
}: {
  issue: Issue;
  /** Present when this topic asks a question with choices under it. */
  ballot?: Ballot;
  canVote: boolean;
  lang: Locale;
}) {
  const t = getDictionary(lang);
  const href = `/${lang}/sujets/${issue.id}`;
  const additionalSupporters = Math.max(0, issue.voteCount - issue.supporters.length);

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
          <ProfileLink author={issue.author} lang={lang} className="shrink-0">
            <Avatar person={issue.author} size="md" />
          </ProfileLink>

          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold leading-[20px]">
              <ProfileLink author={issue.author} lang={lang} className="truncate hover:underline">
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
          <h3 className="text-[19px] font-bold leading-[27px] break-words group-hover:text-[#a3162c]">
            <Translated field="title">{issue.title}</Translated>
          </h3>
          <p className={`mt-1.5 line-clamp-3 text-[15px] leading-[23px] ${MUTED}`}>
            <Translated field="body">{issue.body}</Translated>
          </p>
        </Link>

        {ballot && (
          <div className="mt-3.5">
            <PollBallot ballot={ballot} canVote={canVote} lang={lang} compact />
          </div>
        )}
      </div>

      {/* Full bleed and large, the way every feed people already read presents
          an image, rather than a thumbnail in the margin. Whole rather than
          cropped — see IssuePhoto for why that is worth the letterboxing. */}
      {issue.imageUrl && (
        <Link href={href} className="block">
          <IssuePhoto
            src={issue.imageUrl}
            alt=""
            cap="max-h-[420px]"
            sizes="(min-width: 1024px) 640px, 100vw"
          />
        </Link>
      )}

      {/* No padding on top unless a photograph put something above it.
          Otherwise this block's top padding stacked under the previous block's
          bottom padding and the footer's own rule added a third gap on top of
          those two — about fifty pixels of nothing between a ballot and the
          buttons that act on it. */}
      <div className={`px-3.5 pb-3.5 sm:px-5 sm:pb-5 ${issue.imageUrl ? "pt-3.5 sm:pt-5" : ""}`}>
        {/* Who is already behind this, before asking the reader to join them. */}
        {issue.supporters.length > 0 && (
          <div className="mb-3.5 flex items-center gap-2">
            <FacePile people={issue.supporters} />
            <p className={`text-[13px] leading-[18px] ${MUTED}`}>
              {additionalSupporters > 0
                ? t.vote.additionalSupport(additionalSupporters)
                : issue.hasVoted
                  ? t.vote.youAndOthers(issue.voteCount - 1)
                  : t.vote.othersSupport(issue.voteCount)}
            </p>
          </div>
        )}

        <footer className="flex items-center gap-1.5 border-t border-[#f2ece4] pt-3.5">
          <VoteButton
            issueId={issue.id}
            voteCount={issue.voteCount}
            hasVoted={issue.hasVoted}
            canVote={canVote}
            lang={lang}
          />
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[14px] font-bold leading-[20px] text-[#6e6a72] transition-colors hover:bg-[#faf1e8] hover:text-[#1a1a1a]"
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
