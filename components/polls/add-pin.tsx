"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const params = useSearchParams();
  const anchor = useRef<HTMLDivElement>(null);

  /*
   * `?pin=lat,lon` means somebody clicked the map above and said yes. The form
   * opens with that place already chosen, so the confirmation on the map was
   * the last decision they had to make about *where* — everything after it is
   * detail. It arrives the same way from the feed, where the click happened on
   * another page entirely.
   */
  const picked = parsePin(params.get("pin"));
  const pickedLat = picked?.lat;
  const pickedLon = picked?.lon;
  const [open, setOpen] = useState(Boolean(picked));
  const remaining = ballot.maxPinsPerMember - ballot.viewerMapResponseCount;

  /*
   * Coming from the feed the form is most of a screen below the fold, and a
   * page that opens at the top after a decision reads as having ignored it.
   *
   * Twice, and not smoothly, both for the same reason: everything above this
   * form arrives late. The topic's own map is a Leaflet instance that mounts
   * after hydration and the page grows several hundred pixels when it does, so
   * a single scroll computed before that lands somewhere else -- and a smooth
   * one is still animating toward a position that no longer means anything.
   * The first pass gets close, the second corrects it once the map is up.
   *
   * Measured: with one early pass the page settled at the top with the form
   * open and out of sight.
   */
  useEffect(() => {
    if (pickedLat === undefined || pickedLon === undefined) return;

    const show = () =>
      anchor.current?.scrollIntoView({ behavior: "auto", block: "center" });
    const first = setTimeout(show, 150);
    const second = setTimeout(show, 900);

    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
    // The coordinates, not the object `parsePin` rebuilds on every render, so
    // a re-render does not scroll again under somebody who has started typing.
  }, [pickedLat, pickedLon]);

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
    <div ref={anchor} className={`${CARD} mt-10 p-4 md:p-6`}>
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
        initialLat={picked?.lat}
        initialLon={picked?.lon}
        lang={lang}
      />
    </div>
  );
}

/** `"45.478,-73.642"`, or nothing at all if it is not two numbers in range. */
function parsePin(value: string | null): { lat: number; lon: number } | null {
  if (!value) return null;
  const [lat, lon] = value.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
