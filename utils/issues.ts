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
  firstName: string;
  lastName: string;
  isOfficial: boolean;
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
};

export type Comment = {
  id: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
  author: Author;
};
