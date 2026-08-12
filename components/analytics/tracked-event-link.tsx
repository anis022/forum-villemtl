"use client";

import type { ReactNode } from "react";
import { trackContentOpen } from "./content-view-tracker";

export function TrackedEventLink({
  eventId,
  href,
  className,
  children,
}: {
  eventId: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackContentOpen("event", eventId)}
      className={className}
    >
      {children}
    </a>
  );
}
