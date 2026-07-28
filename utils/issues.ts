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
};

export type Comment = {
  id: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
  author: Author;
};
