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

/** True when a report was altered by someone other than the person who wrote it. */
export const editedByOther = (issue: Issue) =>
  issue.editedById !== null && issue.editedById !== issue.author.id;

/** Reports that can actually be drawn. */
export const isLocated = (issue: Issue) => issue.lat !== null && issue.lon !== null;

export type Comment = {
  id: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
  author: Author;
};
