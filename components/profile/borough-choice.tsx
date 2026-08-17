"use client";

import { useState, useTransition } from "react";
import { updateBorough } from "@/app/actions/profile";
import { BOROUGHS, type BoroughSlug } from "@/utils/boroughs";
import { say } from "@/utils/officials";
import type { Locale } from "@/utils/i18n";
import { ALERT, CARD, CHIP, CHIP_ACTIVE, MUTED } from "@/components/ui/styles";

export type BoroughLabels = {
  title: string;
  body: string;
  only: string;
  saved: string;
  failed: string;
};

/**
 * Which borough this person is here about.
 *
 * Chips rather than a select box, for the reason every other filter on this
 * site is chips: a dropdown hides how many choices exist behind a click, and
 * the count is the interesting part here. One chip says plainly that one
 * borough is open, which a collapsed menu reading "Côte-des-Neiges–Notre-Dame-
 * de-Grâce" would not.
 *
 * Radio semantics rather than a row of buttons, because this is one choice out
 * of a set and a screen reader should say so. Chosen state carries the filled
 * chip and `aria-checked`, never colour alone.
 *
 * Pressing the chip you already have does nothing at all: no request, no
 * "saved" line. A confirmation for an action that changed nothing teaches
 * people to stop reading confirmations.
 */
export function BoroughChoice({
  lang,
  chosen,
  labels,
}: {
  lang: Locale;
  chosen: BoroughSlug;
  labels: BoroughLabels;
}) {
  const [current, setCurrent] = useState<BoroughSlug>(chosen);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const choose = (slug: BoroughSlug) => {
    if (slug === current || pending) return;
    const previous = current;

    setCurrent(slug);
    setSaved(false);
    setFailed(false);

    startTransition(async () => {
      const result = await updateBorough(slug);
      if (!result.ok) {
        // Put the chip back where it was: leaving it on the new borough would
        // show a choice the database never accepted.
        setCurrent(previous);
        setFailed(true);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <section className={`${CARD} mt-6 p-5 md:p-6`}>
      <h2 className="text-[20px] leading-[28px] md:text-[22px] md:leading-[30px]">
        {labels.title}
      </h2>
      <p className={`mt-1 text-[15px] leading-[22px] ${MUTED}`}>{labels.body}</p>

      <div
        role="radiogroup"
        aria-label={labels.title}
        className="mt-4 flex flex-wrap gap-2"
      >
        {BOROUGHS.map((borough) => {
          const active = borough.slug === current;
          return (
            <button
              key={borough.slug}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => choose(borough.slug)}
              className={`${active ? CHIP_ACTIVE : CHIP} disabled:opacity-60`}
            >
              {say(borough.name, lang)}
            </button>
          );
        })}
      </div>

      <p className={`mt-3 text-[14px] leading-[20px] ${MUTED}`}>{labels.only}</p>

      {saved && (
        <p className={`mt-3 text-[14px] leading-[20px] ${MUTED}`} role="status">
          {labels.saved}
        </p>
      )}
      {failed && (
        <p className={`mt-3 ${ALERT}`} role="alert">
          {labels.failed}
        </p>
      )}
    </section>
  );
}
