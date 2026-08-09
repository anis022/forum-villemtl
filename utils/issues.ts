// Constants and types shared by server and client components.
// Kept free of any server-only import (`next/headers`, the Supabase server
// client) so Client Components can import from here safely.
//
// Display labels live in utils/i18n.ts — these are the stored keys.

export const CATEGORY_KEYS = [
  "general",
  "voirie",
  "proprete",
  "securite",
  "transport",
  "parcs",
  "logement",
] as const;

export type Category = (typeof CATEGORY_KEYS)[number];

export const STATUS_KEYS = ["open", "answered", "resolved"] as const;

export type Status = (typeof STATUS_KEYS)[number];

/**
 * On the map, what matters at a glance is settled or not. An answered issue is
 * still an open one — an official has replied, the pothole is still there — so
 * it groups with open rather than with resolved.
 */
export const isSettled = (status: Status) => status === "resolved";

/**
 * Warm for what still needs attention, teal for what is done. The three stay
 * distinguishable from each other, but the warm/cool split is what carries
 * across a map read from two metres away.
 */
export const STATUS_MAP_COLORS: Record<Status, string> = {
  open: "#d94f45",
  answered: "#b8660a",
  resolved: "#097d6c",
};

// The borough geometry lives in utils/map.ts — it is shared with the events
// map, and two copies of a boundary is one too many.

export type Author = {
  /** Needed for the avatar: the fallback colour is derived from it. */
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isOfficial: boolean;
};

/** A person who has backed an issue, shown in the face pile. */
export type Supporter = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type Issue = {
  id: string;
  title: string;
  body: string;
  category: Category;
  status: Status;
  voteCount: number;
  commentCount: number;
  createdAt: string;
  author: Author;
  hasVoted: boolean;
  imageUrl: string | null;
  /** A few of the most recent backers; empty until the list query fills it. */
  supporters: Supporter[];
  /** Where it is. Null on reports filed before locations were asked for. */
  lat: number | null;
  lon: number | null;
  editedAt: string | null;
  /**
   * Who last edited. Compare with `author.id`: when they differ, someone with
   * authority changed a resident's words, and the page has to say so.
   */
  editedById: string | null;
};

/** True when a post was altered by someone other than the person who wrote it. */
export const editedByOther = (post: { editedById: string | null; author: Author }) =>
  post.editedById !== null && post.editedById !== post.author.id;

/** Reports that can actually be drawn. */
export const isLocated = (issue: Issue) => issue.lat !== null && issue.lon !== null;

export type Comment = {
  id: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
  author: Author;
  /** The comment this one answers, or null for a reply to the report itself. */
  parentId: string | null;
  /** 0 at the top of a thread. Capped in the database — see migration 0014. */
  depth: number;
  editedAt: string | null;
  /**
   * Who last edited. Compare with `author.id`, the same way reports do: when
   * they differ, someone with authority rewrote a resident's words, and the
   * thread has to say so.
   */
  editedById: string | null;
};

/** A comment with the exchange hanging off it. */
export type CommentNode = Comment & { replies: CommentNode[] };

/** Everything hanging off a comment, however deep — what a fold hides. */
export const countReplies = (comment: CommentNode): number =>
  comment.replies.reduce((n, reply) => n + 1 + countReplies(reply), 0);

/**
 * How far a thread is allowed to step right before replies stop indenting and
 * carry on at the same level. Nesting is what shows who is answering whom, and
 * it is also what eats a phone screen: past three steps a 320px column has more
 * margin than message. Deeper replies still sit under the comment they answer,
 * they just stop moving sideways.
 */
export const MAX_INDENT = 3;

/**
 * The depth at which a reply's own answers stop being drawn and become a fold.
 *
 * `MAX_INDENT` keeps a deep thread from walking off the right edge, but it does
 * not stop it from being long: once replies stop indenting, four generations of
 * an argument between two people sit in one flat column under a comment nobody
 * is still reading, and the next top-level reply is a screen and a half away.
 *
 * So the third generation onward is collapsed by default, the way Reddit does
 * it — the exchange is still there, announced by a count, one tap from being
 * read. Two levels is what fits: a comment, its answers, and the answers to
 * those. Past that a resident scanning a report is being asked to scroll
 * through a conversation between other people to find the next one.
 */
export const FOLD_DEPTH = 2;
