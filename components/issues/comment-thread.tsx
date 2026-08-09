import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { OfficialBadge, authorName, formatDate } from "@/components/issues/issue-meta";
import { CommentActions } from "@/components/issues/comment-actions";
import { Translated, TranslationProvider } from "@/components/translate";
import {
  FOLD_DEPTH,
  MAX_INDENT,
  countReplies,
  editedByOther,
  type CommentNode,
} from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { BARE_CONTROL, CARD, MUTED, THREAD_LINE } from "@/components/ui/styles";

/**
 * Beyond this the database refuses a reply outright — see migration 0014. The
 * two numbers are deliberately different: nesting stops moving sideways well
 * before the conversation is required to stop.
 */
const MAX_DEPTH = 4;

/** The rule the answers to a comment hang off, folded or not. */
const REPLY_RAIL = `space-y-4 border-l-2 ${THREAD_LINE} pl-3 sm:pl-4`;

/**
 * One comment and everything hanging off it.
 *
 * A server component, recursing on itself. Only the reply control is a client
 * island, so a thread of two hundred replies costs the browser two hundred
 * buttons rather than two hundred comments' worth of text and markup.
 *
 * Top-level comments are cards. Replies are not: a card inside a card inside a
 * card is three borders saying the same thing, and on a phone the padding alone
 * would eat the message. Replies hang off a thread line instead — the vertical
 * rule is what carries "this answers that", and it costs 12px rather than 40.
 */
export function CommentThread({
  comment,
  issueId,
  viewerId,
  isOfficial,
  threaded,
  lang,
}: {
  comment: CommentNode;
  issueId: string;
  /** The reader, or null when signed out — they see the conversation, no controls. */
  viewerId: string | null;
  /** Whether the *reader* is an elected official, not the comment's author. */
  isOfficial: boolean;
  /** False until migrations 0014/0015 are applied; the thread renders flat until then. */
  threaded: boolean;
  lang: Locale;
}) {
  const t = getDictionary(lang);
  const top = comment.depth === 0;
  const name = authorName(comment.author, t.issue.anonymousAuthor);
  const isAuthor = viewerId !== null && viewerId === comment.author.id;

  // Officials moderate; everyone else may only touch their own words. Enforced
  // by RLS regardless — this decides which controls are worth drawing.
  const canManage = threaded && (isAuthor || (viewerId !== null && isOfficial));

  // Built once: the same list goes inside the fold or straight onto the page.
  const replies = comment.replies.map((reply) => (
    <CommentThread
      key={reply.id}
      comment={reply}
      issueId={issueId}
      viewerId={viewerId}
      isOfficial={isOfficial}
      threaded={threaded}
      lang={lang}
    />
  ));

  // Every step right is width a 320px screen does not have back.
  const indent = comment.depth < MAX_INDENT ? "ml-3 sm:ml-5" : "";

  return (
    <article
      id={`c-${comment.id}`}
      /* The teal shell marks an official *answer to the report* — the thing
         residents came to the page for. An official taking part further down
         the thread is a participant in a conversation, not a ruling on it, and
         a green band beside every one of their remarks nested inside a thread
         that already draws its own line is two rules saying different things in
         the same 4px. Below the top level the badge and the label carry it. */
      className={
        top
          ? comment.isOfficial
            ? "rounded-[16px] border-l-4 border-[#097d6c] bg-[#e2f0ec] p-4 sm:p-5"
            : `${CARD} p-4 sm:p-5`
          : ""
      }
    >
      <div className="flex gap-3">
        <Link href={`/${lang}/profil/${comment.author.id}`} className="shrink-0">
          <Avatar person={comment.author} size={top ? "md" : "sm"} />
        </Link>

        {/* Scoped to this comment's own words, not to the exchange under it:
            every reply carries its own provider, so translating one does not
            reach into the rest of the thread. */}
        <TranslationProvider kind="comment" id={comment.id} lang={lang}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px]">
            <Link href={`/${lang}/profil/${comment.author.id}`} className="font-bold hover:underline">
              {name}
            </Link>
            {comment.author.isOfficial && <OfficialBadge lang={lang} />}
            <span aria-hidden="true" className={MUTED}>
              ·
            </span>
            <span className={MUTED}>{formatDate(comment.createdAt, lang)}</span>
          </div>

          {comment.isOfficial && (
            <p className="mt-1 text-[14px] font-bold text-[#097d6c]">{t.issue.officialAnswer}</p>
          )}

          {/* Its own line, like the notice on a report: an edit made by someone
              other than the author is the one piece of metadata here that has
              to be easy to read, not tucked in beside the date. */}
          {comment.editedAt && (
            <p
              className={`mt-1 text-[13px] leading-[18px] ${
                editedByOther(comment) ? "font-bold text-[#b8660a]" : MUTED
              }`}
            >
              {editedByOther(comment)
                ? t.issue.editedByOfficial(formatDate(comment.editedAt, lang))
                : t.issue.editedByAuthor(formatDate(comment.editedAt, lang))}
            </p>
          )}

          <CommentActions
            commentId={comment.id}
            issueId={issueId}
            body={comment.body}
            author={name}
            lang={lang}
            canManage={canManage}
            canReply={threaded && viewerId !== null && comment.depth < MAX_DEPTH}
            actingAsOfficial={!isAuthor}
            readerIsOfficial={isOfficial}
          >
            <p className="mt-1.5 whitespace-pre-wrap break-words leading-[26px]">
              <Translated field="body">{comment.body}</Translated>
            </p>
          </CommentActions>
        </div>
        </TranslationProvider>
      </div>

      {comment.replies.length > 0 &&
        (comment.depth >= FOLD_DEPTH ? (
          /* Folded from here down. A <details>, not a client component with
             state: the browser already knows how to open and close one, it
             costs no JavaScript on a page that can carry two hundred of them,
             and the replies are in the HTML either way — so a reader with
             scripting off, and a search engine, still get the whole thread.

             It takes no indent step of its own, unlike the branch below: the
             fold line is already what marks the level, and charging a reader
             who opened it another 12px of margin per generation for a rule the
             summary has drawn is how a column gets down to three words wide. */
          <details className="group mt-3">
            <summary
              className={`${BARE_CONTROL} inline-flex cursor-pointer list-none items-center gap-1.5 py-2 pr-2 text-[14px] font-bold leading-[20px] text-[#097d6c] transition-colors hover:text-[#075f53] [&::-webkit-details-marker]:hidden`}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="fold-chevron shrink-0 transition-transform group-open:rotate-90"
              >
                <path
                  d="M9 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {/* One control, two labels — the open one has to say how to get
                  back out, and "Afficher 6 réponses" on an already-open thread
                  is a button lying about what it does. */}
              <span className="group-open:hidden">
                {t.issue.expandThread(countReplies(comment))}
              </span>
              <span className="hidden group-open:inline">{t.issue.collapseThread}</span>
            </summary>

            <div className={`mt-1 ${REPLY_RAIL}`}>{replies}</div>
          </details>
        ) : (
          /* The thread line hangs under the avatar rather than at the card edge,
             so it reads as coming out of the person who was answered. It stops
             stepping right at MAX_INDENT: past that, replies stay put and the
             line alone keeps saying they belong to the exchange above. */
          <div className={`mt-3 ${indent} ${REPLY_RAIL}`}>{replies}</div>
        ))}
    </article>
  );
}
