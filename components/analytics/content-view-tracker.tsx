"use client";

import { useEffect } from "react";

export type TrackedContentType = "event" | "project";

/** Best-effort by design: analytics must never delay or break navigation. */
export function trackContentOpen(contentType: TrackedContentType, contentId: string) {
  void fetch("/api/content-view", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType, contentId }),
  }).catch(() => undefined);
}

/** Counts a project only once the actual reading page has mounted. */
export function ContentViewTracker({
  contentType,
  contentId,
}: {
  contentType: TrackedContentType;
  contentId: string;
}) {
  useEffect(() => {
    trackContentOpen(contentType, contentId);
  }, [contentId, contentType]);

  return null;
}
