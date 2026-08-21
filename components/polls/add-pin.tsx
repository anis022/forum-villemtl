"use client";

import { useState } from "react";
import { MapResponseForm } from "./map-response-form";
import type { BallotDetail } from "@/utils/polls";
import { getDictionary, type Locale } from "@/utils/i18n";
import { BTN_SECONDARY, CARD, MUTED } from "@/components/ui/styles";

/**
 * Adding a point, above the replies rather than under the map.
 *
 * A map ballot's form is a location picker, a description and a photograph —
 * roughly the size of the topic it hangs off. Sitting under the map it pushed
 * the ballot's own answers off the screen and made the topic look like a form
 * with an article attached, for every reader including the ones who had already
 * answered or could not.
 *
 * So it is folded behind one control, and that control sits where the other way
 * of contributing to a topic sits: immediately above the replies. Leaving a pin
 * and leaving a comment are the same kind of act, and now they are in the same
 * part of the page.
 *
 * Open by intent, never by default. A reader who came to see where people put
 * their points sees the map and the count, and nothing asks them for anything.
 */
export function AddPin({
  ballot,
  lang,
}: {
  ballot: BallotDetail;
  lang: Locale;
}) {
  const t = getDictionary(lang);
  const [open, setOpen] = useState(false);
  const remaining = ballot.maxPinsPerMember - ballot.viewerMapResponseCount;

  if (remaining <= 0) {
    return (
      <p className={`mt-10 text-[15px] ${MUTED}`}>{t.poll.pinLimitNotice}</p>
    );
  }

  if (!open) {
    return (
      <div className="mt-10">
        <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(true)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M12 5.5v6M9 8.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {t.poll.addPinTitle}
        </button>
      </div>
    );
  }

  return (
    <div className={`${CARD} mt-10 p-4 md:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold leading-[26px]">{t.poll.addPinTitle}</h2>
        <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(false)}>
          {t.poll.cancelEdit}
        </button>
      </div>
      <MapResponseForm
        pollId={ballot.id}
        issueId={ballot.issueId}
        allowDescription={ballot.allowPinDescription}
        allowImage={ballot.allowPinImage}
        lang={lang}
      />
    </div>
  );
}
