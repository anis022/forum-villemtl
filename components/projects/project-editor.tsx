"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IssuePhoto } from "@/components/issues/issue-photo";
import { saveProject, uploadProjectPhoto } from "@/app/actions/projects";
import {
  formatMilestoneOn,
  isMilestoneDate,
  isPast,
  type Localized,
  type Milestone,
  type ProjectContent,
} from "@/utils/projects";
import { dateLocale, getDictionary, type Locale } from "@/utils/i18n";
import { ALERT, BTN_PRIMARY, BTN_SECONDARY, CARD, MUTED } from "@/components/ui/styles";

const STATUSES = ["study", "decided", "underway", "done"] as const;

export const BLANK: ProjectContent = {
  title: { fr: "", en: "" },
  summary: { fr: "", en: "" },
  status: "study",
  address: "",
  description: [{ fr: "", en: "" }],
  photos: [] as unknown as ProjectContent["photos"],
  milestones: [] as unknown as ProjectContent["milestones"],
  sources: [],
};

/**
 * The public page, editable in place.
 *
 * Not "a form that resembles the page", but the same blocks, in the same
 * order, at the same sizes, reading from `app/[lang]/projets/[slug]/page.tsx`
 * and `components/project-timeline.tsx` as the specification. Where those two
 * put a thing, this puts the same thing with a caret in it. When they change,
 * this changes with them.
 *
 * Four earlier mistakes, all of them the same mistake in different clothes:
 *
 *   Labels. Every value carried an eleven-pixel uppercase caption above it,
 *   which is how a database looks, not how a project page looks. A field is now
 *   the text itself; what the label said is the placeholder and the accessible
 *   name.
 *
 *   A flat list where the timeline goes. The public timeline is not a list:
 *   it is three derived blocks, the latest thing that happened, what is
 *   scheduled next as numbered cards, and the older history folded away.
 *   Editing a flat `<ol>` and then seeing that is editing something else and
 *   hoping. The three blocks are here, and because the grouping is derived
 *   from the dates, correcting a date moves a milestone between them.
 *
 *   Controls that appeared on hover. They hid the only affordance the page had,
 *   left a keyboard nothing to aim at, and made the layout jump. Everything is
 *   visible all the time now, and quiet enough to sit beside prose.
 *
 *   A page with nothing on it. Drawing a field as the text it will become is
 *   right once there is text; on a new project it left a wall of grey sentences
 *   that read as content somebody had already written, no visible place to
 *   type, and two red dots that said "not ready" without saying what for. So an
 *   empty field now carries the shape of the line it is waiting for, every
 *   empty section holds the control that fills it, and `Checklist` names what
 *   each language still owes instead of leaving it to be discovered by pressing
 *   publish and reading a message the database wrote for the cron.
 *
 * Order is derived rather than arranged: milestones sort by date, so there is
 * nothing to drag and no arrows to press. Fixing a wrong date is how you move
 * an entry, which is also the only reason it was in the wrong place. The sort
 * runs when a date field is left rather than on every keystroke: a date halfway
 * through being typed is not yet a date, and reordering on it took the field
 * out from under the caret.
 */
export function ProjectEditor({
  lang,
  revisionId,
  projectId,
  initialSlug,
  initialContent,
  sourceNote,
}: {
  lang: Locale;
  revisionId: string | null;
  projectId: string | null;
  initialSlug: string;
  initialContent: ProjectContent;
  sourceNote: string | null;
}) {
  const dict = getDictionary(lang);
  const t = dict.projects;
  const a = dict.projectAdmin;
  const router = useRouter();
  const [pending, start] = useTransition();

  const [editingLang, setEditingLang] = useState<Locale>(lang);
  const [slug, setSlug] = useState(initialSlug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initialSlug));
  const [content, setContent] = useState<ProjectContent>(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /**
   * Which milestones are showing their optional half.
   *
   * Detail, resolution number and outside link are empty on most entries, and
   * rendering four grey placeholders under every card put sixteen lines of
   * ghost text inside "Prochaines étapes" alone, text that reads as content
   * somebody typed. They are folded behind one visible control instead. Not a
   * hover reveal: the control is on screen at all times, it just stands for
   * three fields rather than being them.
   */
  const [openExtras, setOpenExtras] = useState<ReadonlySet<number>>(new Set());
  const reveal = (index: number) =>
    setOpenExtras((current) => new Set(current).add(index));

  const L = editingLang;
  const set = (patch: Partial<ProjectContent>) =>
    setContent((current) => ({ ...current, ...patch }));
  const write = (value: Localized | undefined, text: string): Localized => ({
    ...(value ?? { fr: "", en: "" }),
    [L]: text,
  });

  /**
   * Milestones are kept in the order they are in, and sorted when a date is
   * finished rather than on every keystroke.
   *
   * Sorting on each character moved the entry out from under the caret: typing
   * "2025-07-15" into a project that already had two dates put "202" in the
   * field and threw the remaining seven characters away, because "2" sorts
   * before "2019-01-01" and the field was rebuilt somewhere else mid-word.
   */
  const setMilestones = (next: Milestone[]) =>
    set({ milestones: next as ProjectContent["milestones"] });

  const sortMilestones = () =>
    setContent((current) => ({
      ...current,
      milestones: [...current.milestones].sort(byDate) as ProjectContent["milestones"],
    }));

  /**
   * The milestone list the three blocks are grouped from, held still while a
   * date is being typed.
   *
   * The grouping is derived from the dates, so half a date regroups the page:
   * "2025" is already in the past and jumps the entry from "Prochaines étapes"
   * to the block at the top, which unmounts the field you are typing into. It
   * catches up on blur, which is when a date is a date.
   */
  const [pinned, setPinned] = useState<readonly Milestone[] | null>(null);
  const holdLayout = () => setPinned(content.milestones);
  const releaseLayout = () => {
    setPinned(null);
    sortMilestones();
  };

  const patchMilestone = (index: number, next: Partial<Milestone>) =>
    setMilestones(content.milestones.map((m, k) => (k === index ? { ...m, ...next } : m)));

  const submit = (publish: boolean) =>
    start(async () => {
      setError(null);
      // Oldest first is what the page and the type both promise, and the list
      // is only sorted when a date is finished, so it is sorted again here in
      // case a save lands while one is still open.
      const ordered: ProjectContent = {
        ...content,
        milestones: [...content.milestones].sort(byDate) as ProjectContent["milestones"],
      };
      const result = await saveProject(revisionId, {
        projectId,
        slug,
        content: ordered,
        publish,
      });
      if (result.error) {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(publish && slug ? `/${lang}/projets/${slug}` : `/${lang}/projets/revisions`);
      router.refresh();
    });

  const addPhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    const { url, error: failed } = await uploadProjectPhoto(slug || "sans-nom", file);
    setUploading(false);
    if (failed || !url) {
      setError(failed ?? a.uploadFailed);
      return;
    }
    set({
      photos: [
        ...content.photos,
        { src: url, caption: { fr: "", en: "" }, credit: "" },
      ] as ProjectContent["photos"],
    });
  };

  // The public timeline's own arithmetic, so the blocks below hold exactly what
  // a resident would find in them. Indices travel along, because an edit has to
  // land in the flat array however the view has grouped it.
  const entries = content.milestones.map((milestone, index) => ({ milestone, index }));
  // Which block an entry belongs in is read off `pinned` while a date is being
  // typed and off the live list otherwise. Values always come from the live
  // list, so the field under the caret shows what was just typed even though it
  // has not moved yet.
  const order = pinned?.length === content.milestones.length ? pinned : content.milestones;
  const settled = (index: number) => {
    const on = order[index]?.on ?? "";
    return Boolean(on) && isPast(on);
  };
  const done = entries.filter((e) => settled(e.index));
  const current = done.at(-1) ?? entries[0];
  // `current` comes out of the other two blocks, not just out of the history:
  // on a project where nothing has happened yet it is the first scheduled
  // milestone, and it used to be drawn twice, once at the top and once as
  // "next step 1", with two carets editing the same entry.
  const upcoming = entries.filter((e) => e !== current && !settled(e.index));
  const previous = done.filter((e) => e !== current).reverse();

  const [lead, ...gallery] = content.photos;

  // One control, rendered wherever a photo is missing: in the section heading,
  // and inside the empty box that is asking for one.
  const upload = (
    <label className={`${BTN_SECONDARY} cursor-pointer`}>
      {uploading ? a.uploading : a.addPhoto}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void addPhoto(file);
          event.target.value = "";
        }}
      />
    </label>
  );

  const addMilestone = (
    <button
      type="button"
      className={BTN_SECONDARY}
      onClick={() => setMilestones([...content.milestones, blankMilestone()])}
    >
      {a.addMilestone}
    </button>
  );

  // What is left to do, computed once and shown twice: as a dot on each
  // language and as the list under the bar.
  const gaps = { fr: missingIn(content, "fr", a), en: missingIn(content, "en", a) };
  const stops = blockers(content, slug, a);

  // Said once, on the page somebody opens with nothing on it, and gone as soon
  // as there is anything to look at.
  const blank =
    !content.title.fr.trim() &&
    !content.title.en.trim() &&
    content.photos.length === 0 &&
    content.milestones.length === 0;

  return (
    <div className="w-full">
      <Bar
        a={a}
        editingLang={editingLang}
        setEditingLang={setEditingLang}
        ready={{ fr: gaps.fr.length === 0, en: gaps.en.length === 0 }}
        busy={pending || uploading}
        blocked={stops.length > 0}
        onSave={() => submit(false)}
        onPublish={() => submit(true)}
      />

      {error && <p className={`${ALERT} mt-5`}>{error}</p>}

      <Checklist a={a} fr={gaps.fr} en={gaps.en} stops={stops} />

      {blank && (
        <p className={`mt-3 text-[14px] leading-[21px] ${MUTED}`}>{a.howToEdit}</p>
      )}

      {sourceNote && (
        <aside className="mt-5 rounded-[14px] border border-[#dcd8f2] bg-[#f4f2ff] px-4 py-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#2a2a86]">
            {a.whatTheCronRead}
          </p>
          <p className="mt-1 text-[14px] leading-[21px] text-[#4f4a50]">{sourceNote}</p>
        </aside>
      )}

      {/* ---- from here down, the public page block for block ---- */}

      <Link
        href={`/${lang}/projets`}
        className="mt-5 inline-block text-[14px] font-bold text-[#a3162c] hover:underline"
      >
        {t.back}
      </Link>

      <header className="mt-4 max-w-[820px]">
        <Field
          as="textarea"
          name={a.title}
          value={content.title[L]}
          onChange={(text) => {
            set({ title: write(content.title, text) });
            if (!slugTouched && L === "fr") setSlug(slugify(text));
          }}
          className="text-[30px] font-semibold leading-[38px] tracking-[-0.025em] md:text-[42px] md:leading-[50px]"
        />
        <Field
          name={a.address}
          value={content.address}
          onChange={(address) => set({ address })}
          placeholder={a.addressPlaceholder}
          className={`mt-2 text-[14px] ${MUTED}`}
        />
        <Field
          as="textarea"
          name={a.summary}
          value={content.summary[L]}
          onChange={(text) => set({ summary: write(content.summary, text) })}
          className="mt-4 max-w-[68ch] text-[17px] leading-[27px] text-[#4f4a50]"
        />
      </header>

      {/* ---- Avancement du projet ---- */}
      <section className="mt-8">
        <Head title={t.timeline}>{addMilestone}</Head>

        {entries.length === 0 ? (
          <Empty text={a.emptyMilestones}>{addMilestone}</Empty>
        ) : (
          <div className="mt-3">
            <section className="overflow-hidden rounded-[16px] border border-[#e5ded7] bg-white">
              {/* Dernière mise à jour */}
              <div className="p-5 sm:p-6 lg:p-7">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5d56b4]">
                    {t.latestUpdate}
                  </p>
                  <Remove
                    label={a.remove}
                    onClick={() =>
                      setMilestones(content.milestones.filter((_, k) => k !== current.index))
                    }
                  />
                </div>
                <DateRow
                  a={a}
                  lang={L}
                  milestone={current.milestone}
                  onPatch={(next) => patchMilestone(current.index, next)}
                  onHoldLayout={holdLayout}
                  onReleaseLayout={releaseLayout}
                  className="mt-2"
                />
                <Field
                  as="textarea"
                  name={a.label}
                  value={current.milestone.title[L]}
                  onChange={(text) =>
                    patchMilestone(current.index, {
                      title: write(current.milestone.title, text),
                    })
                  }
                  className="mt-1 text-[20px] font-semibold leading-[28px] tracking-[-0.01em] sm:text-[22px] sm:leading-[30px]"
                />
                <Extras
                  a={a}
                  lang={L}
                  milestone={current.milestone}
                  open={openExtras.has(current.index)}
                  onReveal={() => reveal(current.index)}
                  onPatch={(next) => patchMilestone(current.index, next)}
                  write={write}
                  bodyClass={`max-w-[60ch] text-[15px] leading-[23px] ${MUTED}`}
                />
              </div>

              {/* Prochaines étapes */}
              <div className="border-t border-[#e9e2dc] bg-[#f8f5f1] p-5 sm:p-6 lg:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[14px] font-semibold text-[#373238]">{t.nextSteps}</h3>
                  <span className="text-[12px] font-semibold tabular-nums text-[#8a858c]">
                    {upcoming.length}
                  </span>
                </div>
                {upcoming.length === 0 ? (
                  <p className={`mt-3 text-[14px] leading-[21px] ${MUTED}`}>{t.status.done}</p>
                ) : (
                  <ol className="mt-3 grid gap-2.5 md:grid-cols-3">
                    {upcoming.map((entry, n) => (
                      <li
                        key={entry.index}
                        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[12px] border border-[#e5ded7] bg-white p-3.5"
                      >
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-[8px] bg-[#eeecfb] px-2 text-[12px] font-semibold tabular-nums text-[#5d56b4]">
                          {n + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <DateRow
                              a={a}
                              lang={L}
                              milestone={entry.milestone}
                              onPatch={(next) => patchMilestone(entry.index, next)}
                              onHoldLayout={holdLayout}
                              onReleaseLayout={releaseLayout}
                              compact
                            />
                            <Remove
                              label={a.remove}
                              onClick={() =>
                                setMilestones(
                                  content.milestones.filter((_, k) => k !== entry.index),
                                )
                              }
                            />
                          </div>
                          <Field
                            as="textarea"
                            name={a.label}
                            value={entry.milestone.title[L]}
                            onChange={(text) =>
                              patchMilestone(entry.index, {
                                title: write(entry.milestone.title, text),
                              })
                            }
                            className="mt-0.5 text-[14px] font-semibold leading-[20px]"
                          />
                          <Extras
                            a={a}
                            lang={L}
                            milestone={entry.milestone}
                            open={openExtras.has(entry.index)}
                            onReveal={() => reveal(entry.index)}
                            onPatch={(next) => patchMilestone(entry.index, next)}
                            write={write}
                            bodyClass={`text-[13px] leading-[19px] ${MUTED}`}
                            compact
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            {/* Étapes précédentes */}
            {previous.length > 0 && (
              <details className="group mt-3 overflow-hidden rounded-[14px] border border-[#e5ded7] bg-white" open>
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-[14px] font-semibold leading-[20px] text-[#373238]">
                      {t.previousSteps}
                    </span>
                    <span className={`block text-[12px] leading-[18px] ${MUTED}`}>
                      {previous.length}
                    </span>
                  </span>
                  <svg
                    className="h-4 w-4 shrink-0 text-[#5d56b4] transition-transform group-open:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m7 9 5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <ol className="border-t border-[#e9e2dc] px-4 sm:px-5">
                  {previous.map((entry) => (
                    <li
                      key={entry.index}
                      className="grid gap-1 border-b border-[#eee7df] py-4 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5"
                    >
                      <DateRow
                        a={a}
                        lang={L}
                        milestone={entry.milestone}
                        onPatch={(next) => patchMilestone(entry.index, next)}
                        onHoldLayout={holdLayout}
                        onReleaseLayout={releaseLayout}
                        stacked
                      />
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Field
                            as="textarea"
                            name={a.label}
                            value={entry.milestone.title[L]}
                            onChange={(text) =>
                              patchMilestone(entry.index, {
                                title: write(entry.milestone.title, text),
                              })
                            }
                            className="text-[15px] font-semibold leading-[22px]"
                          />
                          <Remove
                            label={a.remove}
                            onClick={() =>
                              setMilestones(
                                content.milestones.filter((_, k) => k !== entry.index),
                              )
                            }
                          />
                        </div>
                        <Extras
                          a={a}
                          lang={L}
                          milestone={entry.milestone}
                          open={openExtras.has(entry.index)}
                          onReveal={() => reveal(entry.index)}
                          onPatch={(next) => patchMilestone(entry.index, next)}
                          write={write}
                          bodyClass={`max-w-[68ch] text-[14px] leading-[21px] ${MUTED}`}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )}
      </section>

      {/* ---- the lead photograph and the prose, one card, as on the page ---- */}
      <article className={`${CARD} mt-10 overflow-hidden`}>
        {lead ? (
          <IssuePhoto
            src={lead.src}
            alt={lead.caption[L] || ""}
            cap="max-h-[520px]"
            sizes="(min-width: 1024px) 1100px, 100vw"
          />
        ) : (
          <div className="border-b border-[#f2ece4] p-5">
            <Empty text={a.emptyPhotos}>{upload}</Empty>
          </div>
        )}

        <div className="p-5 md:p-7">
          {lead && (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Field
                  as="textarea"
                  name={a.photoCaption}
                  value={lead.caption[L]}
                  onChange={(text) =>
                    set({
                      photos: content.photos.map((p, k) =>
                        k === 0 ? { ...p, caption: { ...p.caption, [L]: text } } : p,
                      ) as ProjectContent["photos"],
                    })
                  }
                  className={`text-[13px] leading-[19px] ${MUTED}`}
                />
                <Field
                  name={a.photoCredit}
                  value={lead.credit}
                  onChange={(credit) =>
                    set({
                      photos: content.photos.map((p, k) =>
                        k === 0 ? { ...p, credit } : p,
                      ) as ProjectContent["photos"],
                    })
                  }
                  className={`text-[13px] leading-[19px] ${MUTED} opacity-70`}
                />
              </div>
              <Remove
                label={a.remove}
                onClick={() =>
                  set({ photos: content.photos.slice(1) as ProjectContent["photos"] })
                }
              />
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[20px] font-semibold leading-[28px] tracking-[-0.01em]">
              {t.about}
            </h2>
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => set({ description: [...content.description, { fr: "", en: "" }] })}
            >
              {a.addParagraph}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {content.description.length === 0 ? (
              <Empty text={a.emptyDescription}>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() =>
                    set({ description: [...content.description, { fr: "", en: "" }] })
                  }
                >
                  {a.addParagraph}
                </button>
              </Empty>
            ) : (
              content.description.map((paragraph, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Field
                    as="textarea"
                    name={`${a.paragraph} ${i + 1}`}
                    value={paragraph[L]}
                    onChange={(text) =>
                      set({
                        description: content.description.map((p, k) =>
                          k === i ? write(p, text) : p,
                        ),
                      })
                    }
                    className="max-w-[68ch] text-[17px] leading-[27px]"
                  />
                  <Remove
                    label={a.remove}
                    onClick={() =>
                      set({ description: content.description.filter((_, k) => k !== i) })
                    }
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </article>

      {/* ---- the rest of the photographs ---- */}
      <section className="mt-10">
        <Head title={t.photos} big>
          {upload}
        </Head>
        {gallery.length === 0 ? (
          <Empty text={a.emptyGallery}>{lead ? upload : null}</Empty>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2">
            {gallery.map((photo, k) => {
              const at = k + 1;
              return (
                <li key={`${photo.src}-${at}`} className={`${CARD} overflow-hidden`}>
                  <IssuePhoto
                    src={photo.src}
                    alt={photo.caption[L] || ""}
                    cap="max-h-[320px]"
                    sizes="(min-width: 640px) 560px, 100vw"
                  />
                  <div className="flex items-start justify-between gap-2 p-4">
                    <div className="min-w-0 flex-1">
                      <Field
                        as="textarea"
                        name={a.photoCaption}
                        value={photo.caption[L]}
                        onChange={(text) =>
                          set({
                            photos: content.photos.map((p, j) =>
                              j === at ? { ...p, caption: { ...p.caption, [L]: text } } : p,
                            ) as ProjectContent["photos"],
                          })
                        }
                        className="text-[14px] leading-[21px]"
                      />
                      <Field
                        name={a.photoCredit}
                        value={photo.credit}
                        onChange={(credit) =>
                          set({
                            photos: content.photos.map((p, j) =>
                              j === at ? { ...p, credit } : p,
                            ) as ProjectContent["photos"],
                          })
                        }
                        className={`mt-1.5 text-[12px] ${MUTED}`}
                      />
                    </div>
                    <Remove
                      label={a.remove}
                      onClick={() =>
                        set({
                          photos: content.photos.filter(
                            (_, j) => j !== at,
                          ) as ProjectContent["photos"],
                        })
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- sources ---- */}
      <section className="mt-10">
        <Head title={t.sources} big>
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() =>
              set({ sources: [...content.sources, { label: { fr: "", en: "" }, url: "" }] })
            }
          >
            {a.addSource}
          </button>
        </Head>
        {content.sources.length === 0 ? (
          <Empty text={a.emptySources} />
        ) : (
          <ul className={`${CARD} mt-4 divide-y divide-[#f2ece4]`}>
            {content.sources.map((source, i) => (
              <li key={i} className="flex items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Field
                    name={a.label}
                    value={source.label[L]}
                    onChange={(text) =>
                      set({
                        sources: content.sources.map((s, k) =>
                          k === i ? { ...s, label: write(s.label, text) } : s,
                        ),
                      })
                    }
                    className="text-[15px] font-bold text-[#a3162c]"
                  />
                  <Field
                    name={a.sourceUrl}
                    value={source.url}
                    onChange={(url) =>
                      set({
                        sources: content.sources.map((s, k) => (k === i ? { ...s, url } : s)),
                      })
                    }
                    placeholder="https://"
                    className={`text-[13px] ${MUTED}`}
                  />
                </div>
                <Remove
                  label={a.remove}
                  onClick={() =>
                    set({ sources: content.sources.filter((_, k) => k !== i) })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Three values a resident never sees, so they sit below the page. */}
      <details className="mt-10 rounded-[12px] border border-[#eee7df] bg-[#fffdfb]">
        <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-[#5d56b4]">
          {a.advanced}
        </summary>
        <div className="grid gap-4 border-t border-[#eee7df] p-4 sm:grid-cols-3">
          <Meta label={a.slug} hint={`/${lang}/projets/${slug || "…"}`}>
            <input
              className={META}
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              placeholder="parc-mackenzie-king"
            />
          </Meta>
          <Meta label={a.status}>
            <select
              className={META}
              value={content.status}
              onChange={(event) =>
                set({ status: event.target.value as ProjectContent["status"] })
              }
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t.status[status]}
                </option>
              ))}
            </select>
          </Meta>
          <Meta label={a.councilTerm}>
            <input
              className={META}
              value={content.councilTerm ?? ""}
              onChange={(event) => set({ councilTerm: event.target.value || undefined })}
              placeholder="empress"
            />
          </Meta>
        </div>
      </details>

      <div className="h-16" />
    </div>
  );
}

/* ------------------------------------------------------------------- fields */

/**
 * One editable value, drawn as the text it will become.
 *
 * No border and no background at rest, and the type styles come from the
 * caller, so a title reads as a title and a caption as a caption. A textarea
 * grows to its content: prose that scrolls inside a fixed rectangle is a field,
 * prose that pushes the page down is a paragraph, and that difference is most
 * of what separates this from the form it used to be.
 */
function Field({
  as = "input",
  name,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  invalid = false,
  className = "",
}: {
  as?: "input" | "textarea";
  name: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Draws the field as wrong and says so to a screen reader. */
  invalid?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  const shared =
    "block w-full min-w-0 -mx-1.5 rounded-[6px] border-0 bg-transparent px-1.5 py-0.5 outline-none " +
    "transition-colors placeholder:font-normal placeholder:text-[#bdb7bd] " +
    "hover:bg-[#f7f0e8] focus:bg-white focus:ring-2 focus:ring-[#a3162c]/35 " +
    // An empty field has no text to be shaped like, so it borrows the shape of
    // the line it is waiting for. Without this a blank project is a page of
    // grey sentences that read as content somebody wrote rather than as places
    // to write, which is exactly how the new-project page used to look.
    (value ? "" : "bg-[#fbf6f0] shadow-[inset_0_-1px_0_#e3d9cf] ") +
    (invalid ? "bg-[#fdf1f3] shadow-[inset_0_-2px_0_#a3162c] " : "") +
    className;

  if (as === "textarea") {
    return (
      <textarea
        ref={ref}
        rows={1}
        aria-label={name}
        aria-invalid={invalid || undefined}
        placeholder={placeholder ?? name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`${shared} resize-none overflow-hidden [field-sizing:content]`}
      />
    );
  }

  return (
    <input
      aria-label={name}
      aria-invalid={invalid || undefined}
      placeholder={placeholder ?? name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      className={shared}
    />
  );
}

/**
 * The two halves of a milestone's date.
 *
 * `on` is the machine's date and decides which block the milestone lives in;
 * `onLabel` is what a reader sees when a day would be a lie: "Été 2026",
 * "2009 – 2018". The label's placeholder is the formatted `on`, so the field
 * shows what the public page will print if it is left alone: the empty state
 * doubles as the preview.
 */
function DateRow({
  a,
  lang,
  milestone,
  onPatch,
  onHoldLayout,
  onReleaseLayout,
  className = "",
  compact = false,
  stacked = false,
}: {
  a: Admin;
  lang: Locale;
  milestone: Milestone;
  onPatch: (next: Partial<Milestone>) => void;
  /** Called while the machine date is being typed, and when it is finished. */
  onHoldLayout: () => void;
  onReleaseLayout: () => void;
  className?: string;
  compact?: boolean;
  stacked?: boolean;
}) {
  const size = compact ? "text-[12px] leading-[18px]" : "text-[13px] leading-[19px]";
  // Empty is being written, not wrong. Only something typed can be wrong.
  const wrong = Boolean(milestone.on) && !isMilestoneDate(milestone.on);
  return (
    <div className={className}>
      {/* `Field` is `w-full` by design, so a width has to be put on a wrapper
          rather than passed in: on its own the machine date filled the row and
          pushed the label it belongs beside onto a second line. */}
      <div className={stacked ? "" : "flex flex-wrap items-baseline gap-x-2"}>
        <div className={stacked ? "" : "w-[12ch] shrink-0"}>
          <Field
            name={a.milestoneOn}
            value={milestone.on}
            onChange={(on) => onPatch({ on })}
            onFocus={onHoldLayout}
            onBlur={onReleaseLayout}
            placeholder="2026-06-01"
            invalid={wrong}
            className={`font-semibold tabular-nums text-[#6e6a72] ${size}`}
          />
        </div>
        <div className={stacked ? "" : "min-w-[10ch] flex-1"}>
          <Field
            name={a.milestoneDateLabel}
            value={milestone.onLabel?.[lang] ?? ""}
            onChange={(text) =>
              onPatch({
                onLabel: text
                  ? { ...(milestone.onLabel ?? { fr: "", en: "" }), [lang]: text }
                  : undefined,
              })
            }
            placeholder={datePreview(milestone.on, lang, a.milestoneDateLabelPlaceholder)}
            className={`font-semibold text-[#6e6a72] ${size}`}
          />
        </div>
      </div>
      {wrong && (
        <p className="mt-1 text-[12px] font-semibold leading-[18px] text-[#a3162c]">
          {a.milestoneOnInvalid}
        </p>
      )}
    </div>
  );
}

/**
 * A milestone's optional half: the detail line, the resolution number, the link.
 *
 * Shown when any of them holds something, and otherwise folded behind one
 * control that is always on screen. The alternative, four empty fields under
 * every entry, printed their own names in grey, which reads as text a person
 * typed rather than as a place to type. Sixteen such lines sat inside
 * "Prochaines étapes" alone.
 *
 * A visible button standing for three fields is not the hover-reveal this
 * replaced: it never moves, a keyboard lands on it, and it says what it will
 * give you.
 */
function Extras({
  a,
  lang,
  milestone,
  open,
  onReveal,
  onPatch,
  write,
  bodyClass,
  compact = false,
}: {
  a: Admin;
  lang: Locale;
  milestone: Milestone;
  open: boolean;
  onReveal: () => void;
  onPatch: (next: Partial<Milestone>) => void;
  write: (value: Localized | undefined, text: string) => Localized;
  bodyClass: string;
  compact?: boolean;
}) {
  // Split, because the two halves fill up independently: nearly every entry has
  // a detail line and almost none has a resolution number, so treating them as
  // one group meant a body of prose dragged two empty reference fields on
  // screen with it.
  const hasBody = Boolean(milestone.body?.[lang]);
  const hasRefs = Boolean(milestone.resolution || milestone.source?.url);
  const showBody = open || hasBody;
  const showRefs = open || hasRefs;

  if (!showBody && !showRefs) {
    return (
      <button type="button" onClick={onReveal} className={ADD_LINK}>
        <span aria-hidden="true">+</span>
        {a.milestoneReferences}
      </button>
    );
  }

  return (
    <>
      {showBody && (
        <Field
          as="textarea"
          name={a.milestoneBody}
          value={milestone.body?.[lang] ?? ""}
          onChange={(text) =>
            onPatch({ body: text ? write(milestone.body, text) : undefined })
          }
          className={`mt-1.5 ${bodyClass}`}
        />
      )}
      {showRefs ? (
        <References
          a={a}
          lang={lang}
          milestone={milestone}
          onPatch={onPatch}
          write={write}
          open={open}
          compact={compact}
        />
      ) : (
        <button type="button" onClick={onReveal} className={ADD_LINK}>
          <span aria-hidden="true">+</span>
          {a.milestoneReferences}
        </button>
      )}
    </>
  );
}

/** The resolution number and the outside link, as the public page chips them. */
function References({
  a,
  lang,
  milestone,
  onPatch,
  write,
  open,
  compact = false,
}: {
  a: Admin;
  lang: Locale;
  milestone: Milestone;
  onPatch: (next: Partial<Milestone>) => void;
  write: (value: Localized | undefined, text: string) => Localized;
  /** True only when a person asked for these fields, not merely when one is set. */
  open: boolean;
  compact?: boolean;
}) {
  const showResolution = open || Boolean(milestone.resolution);
  const showSource = open || Boolean(milestone.source?.url || milestone.source?.label[lang]);

  return (
    <div className={`mt-2 grid gap-1 ${compact ? "" : "sm:grid-cols-2"}`}>
      {showResolution && (
        <Field
          name={a.milestoneResolution}
          value={milestone.resolution ?? ""}
          onChange={(text) => onPatch({ resolution: text || undefined })}
          className="text-[12px] font-semibold tabular-nums text-[#6e6a72]"
        />
      )}
      <div className={`grid gap-1 ${showSource ? "" : "hidden"}`}>
        <Field
          name={a.addMilestoneSource}
          value={milestone.source?.label[lang] ?? ""}
          onChange={(text) =>
            onPatch({
              source: text || milestone.source?.url
                ? {
                    label: write(milestone.source?.label, text),
                    url: milestone.source?.url ?? "",
                  }
                : undefined,
            })
          }
          className="text-[12px] font-semibold text-[#5d56b4]"
        />
        <Field
          name={a.sourceUrl}
          value={milestone.source?.url ?? ""}
          onChange={(url) =>
            onPatch({
              source: url || milestone.source?.label[lang]
                ? { label: milestone.source?.label ?? { fr: "", en: "" }, url }
                : undefined,
            })
          }
          placeholder="https://"
          className={`truncate text-[12px] ${MUTED}`}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- furnishings */

/** A quiet "add" that stands where the fields it opens will appear. */
const ADD_LINK =
  "-ml-1.5 mt-1.5 inline-flex items-center gap-1 rounded-[8px] px-1.5 py-0.5 text-[12px] font-semibold text-[#8a858c] transition-colors hover:bg-[#f2ece4] hover:text-[#5d56b4]";

const META =
  "w-full rounded-[10px] border border-[#ddd5cd] bg-white px-3 py-2.5 text-[14px] leading-[20px] outline-none focus:border-[#a3162c] focus:ring-2 focus:ring-[#a3162c]/10";

type Admin = ReturnType<typeof getDictionary>["projectAdmin"];

/**
 * Remove, and always on screen.
 *
 * It used to appear on hover, which hid the only affordance a row had, gave a
 * keyboard nothing to aim at and made the layout twitch as the pointer crossed
 * the page. Small, low-contrast and permanent beats large, obvious and
 * conditional: it sits beside prose without shouting, and it is always where it
 * was the last time somebody looked.
 */
function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#a9a3aa] transition-colors hover:bg-[#f6e7ea] hover:text-[#a3162c] focus-visible:bg-[#f6e7ea] focus-visible:text-[#a3162c]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/** A section heading at the size the public page sets it, plus its one action. */
function Head({
  title,
  big = false,
  children,
}: {
  title: string;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2
        className={
          big
            ? "text-[22px] leading-[30px] md:text-[26px]"
            : "text-[20px] font-semibold leading-[28px] tracking-[-0.01em] sm:text-[22px]"
        }
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * A section with nothing in it yet, and the control that fills it.
 *
 * The action belongs inside the box rather than only in the heading above:
 * "add at least one photo" with the upload button four hundred pixels away in
 * the section header is an instruction with no handle on it, which is most of
 * what made a new project read as a dead page.
 */
function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div
      className={`mt-3 rounded-[14px] border border-dashed border-[#e5ded7] px-4 py-6 text-center text-[14px] ${MUTED}`}
    >
      <p>{text}</p>
      {children && <div className="mt-3 flex justify-center">{children}</div>}
    </div>
  );
}

function Meta({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[12px] font-semibold text-[#4f4a50]">{label}</span>
      {children}
      {hint && <span className={`mt-1 block break-words text-[12px] ${MUTED}`}>{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ helpers */

const blankMilestone = (): Milestone => ({ on: "", title: { fr: "", en: "" } });

/** Sortable from a date that may be a year, a month or a day. */
const byDate = (a: Milestone, b: Milestone) =>
  `${a.on}-01-01`.slice(0, 10).localeCompare(`${b.on}-01-01`.slice(0, 10));

/**
 * The label field's placeholder: what the page will print if nobody overrides.
 *
 * Skipped when the formatted date is the raw one, which is every bare year:
 * "1999" above a greyed "1999" reads as a duplicated value rather than as a
 * preview of itself.
 */
function datePreview(on: string, lang: Locale, fallback: string): string {
  if (!on) return fallback;
  const shown = formatOn(on, lang);
  return shown === on ? fallback : shown;
}

/** What the public timeline prints for a bare `on`. Mirrors `milestoneDate`. */
const formatOn = (on: string, lang: Locale): string => formatMilestoneOn(on, dateLocale(lang));

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** A quiet warning on the language tabs, not a second completeness authority. */
/**
 * What one language still owes before the database will publish the page.
 *
 * A list rather than a boolean, because the boolean was the whole problem: two
 * red dots said "not yet" and nothing said what was missing, so the only way to
 * find out was to press publish and read a Postgres message written for the
 * cron. The same rules as `project_content_complete` in migration 0028, named
 * one by one.
 */
function missingIn(content: ProjectContent, lang: Locale, a: Admin): string[] {
  const gaps: string[] = [];
  if (!content.title[lang].trim()) gaps.push(a.title);
  if (!content.summary[lang].trim()) gaps.push(a.summary);
  if (
    content.description.length === 0 ||
    content.description.some((paragraph) => !paragraph[lang].trim())
  ) {
    gaps.push(a.needDescription);
  }
  if (content.photos.length === 0) gaps.push(a.needPhoto);
  else if (content.photos.some((photo) => !photo.caption[lang].trim())) gaps.push(a.needCaption);
  if (content.milestones.length < 2) gaps.push(a.needMilestones);
  else if (content.milestones.some((milestone) => !milestone.title[lang].trim())) {
    gaps.push(a.needMilestoneTitle);
  }
  return gaps;
}

/**
 * What stops a save outright, in either language.
 *
 * These are the two things the server rejects with a field path rather than a
 * sentence, so they are worth catching here where the field is on screen.
 */
function blockers(content: ProjectContent, slug: string, a: Admin): string[] {
  const stops: string[] = [];
  if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) stops.push(a.blockedSlug);

  // Blank and malformed both stop a save, and they are not the same news: one
  // is a date nobody has typed yet, the other is a date typed the way people
  // say it. Saying "written wrong" about an empty field a person created two
  // seconds ago by pressing "add a date" is just wrong.
  const blank = content.milestones.filter((milestone) => !milestone.on.trim()).length;
  const wrong = content.milestones.filter(
    (milestone) => milestone.on.trim() && !isMilestoneDate(milestone.on),
  ).length;
  if (blank > 0) stops.push(a.blockedDateBlank(blank));
  if (wrong > 0) stops.push(a.blockedDates(wrong));
  return stops;
}

/**
 * The list of what is left, kept beside the buttons that are waiting on it.
 *
 * Collapses to one green line the moment both languages are complete, so it
 * costs nothing on a finished page and is a running answer on a new one.
 */
function Checklist({
  a,
  fr,
  en,
  stops,
}: {
  a: Admin;
  fr: string[];
  en: string[];
  stops: string[];
}) {
  if (stops.length === 0 && fr.length === 0 && en.length === 0) {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-[14px] border border-[#cfe6d9] bg-[#f2f9f5] px-4 py-3 text-[14px] font-semibold leading-[21px] text-[#1f6b45]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#2f8b57]" aria-hidden="true" />
        {a.checklistReady}
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-[14px] border border-[#e5ded7] bg-white p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#5d56b4]">
        {a.checklist}
      </p>
      <div className="mt-2 grid items-start gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {stops.length > 0 && (
          <Gaps title={a.blocked} items={stops} tone="stop" />
        )}
        {fr.length > 0 && <Gaps title={a.checklistMissing(a.inFrench)} items={fr} />}
        {en.length > 0 && <Gaps title={a.checklistMissing(a.inEnglish)} items={en} />}
      </div>
    </div>
  );
}

function Gaps({
  title,
  items,
  tone = "todo",
}: {
  title: string;
  items: string[];
  tone?: "todo" | "stop";
}) {
  return (
    <div className="min-w-0">
      <p
        className={`text-[13px] font-semibold leading-[19px] ${
          tone === "stop" ? "text-[#a3162c]" : "text-[#373238]"
        }`}
      >
        {title}
      </p>
      <ul className={`mt-1 space-y-0.5 text-[13px] leading-[19px] ${MUTED}`}>
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span
              className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "stop" ? "bg-[#a3162c]" : "bg-[#d8cfc6]"
              }`}
              aria-hidden="true"
            />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The one piece of chrome, kept to a single line. */
function Bar({
  a,
  editingLang,
  setEditingLang,
  ready,
  busy,
  blocked,
  onSave,
  onPublish,
}: {
  a: Admin;
  editingLang: Locale;
  setEditingLang: (lang: Locale) => void;
  ready: Record<Locale, boolean>;
  busy: boolean;
  /** Something on the page would be rejected by the server on sight. */
  blocked: boolean;
  onSave: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-[#efe7dd] bg-[#fef7f0]/95 py-2.5 backdrop-blur">
      <div
        className="inline-flex rounded-[10px] border border-[#e5ded7] bg-white p-0.5"
        aria-label={a.editLanguage}
      >
        {(["fr", "en"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setEditingLang(option)}
            aria-pressed={editingLang === option}
            title={ready[option] ? a.languageReady : a.languageIncomplete}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold transition-colors ${
              editingLang === option ? "bg-[#f2ece4] text-[#1a1a1a]" : "text-[#6e6a72]"
            }`}
          >
            {option.toUpperCase()}
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                ready[option] ? "bg-[#2f8b57]" : "bg-[#a3162c]"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={busy || blocked}
          title={blocked ? a.blocked : undefined}
          onClick={onSave}
        >
          {busy ? a.working : a.save}
        </button>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={busy || blocked || !ready.fr || !ready.en}
          title={blocked || !ready.fr || !ready.en ? a.checklist : undefined}
          onClick={onPublish}
        >
          {busy ? a.working : a.saveAndPublish}
        </button>
      </div>
    </div>
  );
}
