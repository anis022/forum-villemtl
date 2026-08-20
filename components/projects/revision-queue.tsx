"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveProject, rejectProject } from "@/app/actions/projects";
import type { Revision } from "@/utils/supabase/projects";
import type { getDictionary } from "@/utils/i18n";
import { ALERT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, CARD, MUTED } from "@/components/ui/styles";

/**
 * What is waiting, and the two verdicts.
 *
 * Approve is offered on every row, including the incomplete ones, and it fails
 * with the database's own sentence when the row is not ready. Hiding the button
 * would be tidier and worse: a reviewer would have to guess why a proposal
 * cannot be published, where this tells them which of the three things is
 * missing. The badge says so before they press it.
 *
 * `complete` comes from the same SQL function that guards approval, so the
 * badge and the outcome cannot disagree.
 */

type Dict = ReturnType<typeof getDictionary>;

export function RevisionQueue({
  lang,
  t,
  revisions,
}: {
  lang: string;
  t: Dict;
  revisions: Revision[];
}) {
  const a = t.projectAdmin;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (fn: () => Promise<{ error: string | null }>) =>
    start(async () => {
      setError(null);
      const result = await fn();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });

  if (revisions.length === 0) {
    return <p className={`text-[16px] ${MUTED}`}>{a.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className={ALERT}>{error}</p>}

      {revisions.map((revision) => (
        <article key={revision.id} className={`${CARD} flex flex-col gap-3 p-4 md:p-5`}>
          <div className="flex flex-col gap-1">
            {/* The provenance and the verdict-readiness read as one line of
                ordinary text rather than as two coloured tags: this is a page
                nine people use, not a dashboard, and a row of pills would make
                every proposal look equally urgent. */}
            <p className={`text-[13px] leading-[18px] ${MUTED}`}>
              {revision.origin === "cron" ? a.fromCron : a.fromStaff}
              {" · "}
              {revision.projectId ? a.editing : a.creating}
              {" · "}
              <span className={revision.complete ? "font-bold text-[#2a2a86]" : "font-bold text-[#fa3250]"}>
                {revision.complete ? a.ready : a.incomplete}
              </span>
            </p>
            <h2 className="text-[19px] font-bold leading-[27px] break-words">
              {revision.content.title.fr || revision.slug}
            </h2>
            <p className={`text-[14px] leading-[21px] break-words ${MUTED}`}>
              /{lang}/projets/{revision.slug}
            </p>
          </div>

          {revision.sourceNote && (
            <p className={`text-[14px] leading-[21px] break-words ${MUTED}`}>
              {revision.sourceNote}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Link className={BTN_SECONDARY} href={`/${lang}/projets/revisions/${revision.id}`}>
              {a.open}
            </Link>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={pending}
              onClick={() => act(() => approveProject(revision.id, null))}
            >
              {a.approve}
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              disabled={pending}
              onClick={() => act(() => rejectProject(revision.id, null))}
            >
              {a.reject}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
