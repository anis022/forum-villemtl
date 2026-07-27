import type { ReactNode } from "react";

/**
 * Keyed on the query so React remounts the results when it changes, which
 * replays the staggered entry animation on each search.
 */
export function IssueList({ query, children }: { query: string; children: ReactNode }) {
  return <div key={query}>{children}</div>;
}
