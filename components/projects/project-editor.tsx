"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IssuePhoto } from "@/components/issues/issue-photo";
import { saveProject, uploadProjectPhoto } from "@/app/actions/projects";
import type { Localized, ProjectContent } from "@/utils/projects";
import { getDictionary, type Locale } from "@/utils/i18n";
import { ALERT, BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, CARD, MUTED } from "@/components/ui/styles";

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
 * The page a resident reads, with its words editable where they sit.
 *
 * The version this replaces was a form. Every value carried an eleven-pixel
 * uppercase label above it, the heading lived in a bordered white card the
 * public page does not have, and a banner announced that what followed was a
 * preview. Three separate things telling the reader "you are filling in a
 * database", and the one question somebody editing actually has — what will
 * this look like? — could not be answered without saving and navigating away.
 *
 * So there are no labels. A field is the text itself, at the size and weight
 * the public page gives it, on the same background, in the same place. What a
 * label used to say is now the placeholder, which shows only while the field is
 * empty, and the accessible name, which is always there for a screen reader.
 * `app/[lang]/projets/[slug]/page.tsx` is the reference this mirrors block for
 * block; when that page changes, this changes with it.
 *
 * Editability is carried by hover and focus alone: a faint tint under the
 * cursor says a thing can be changed, a ring says it is being changed. Nothing
 * is outlined at rest, because at rest this is meant to look like the page.
 *
 * One language at a time, chosen in the bar. Both at once was the honest
 * arrangement and it doubled the page into something no longer recognisable as
 * the article; the dot beside each language is what keeps the untranslated half
 * visible instead.
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
  const a = dict.projectAdmin;
  const router = useRouter();
  const [pending, start] = useTransition();

  const [editingLang, setEditingLang] = useState<Locale>(lang);
  const [slug, setSlug] = useState(initialSlug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initialSlug));
  const [content, setContent] = useState<ProjectContent>(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const L = editingLang;
  const set = (patch: Partial<ProjectContent>) =>
    setContent((current) => ({ ...current, ...patch }));
  const write = (value: Localized | undefined, text: string): Localized => ({
    ...(value ?? { fr: "", en: "" }),
    [L]: text,
  });

  const submit = (publish: boolean) =>
    start(async () => {
      setError(null);
      const result = await saveProject(revisionId, { projectId, slug, content, publish });
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

  const [lead, ...gallery] = content.photos;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4">
      <Bar
        a={a}
        editingLang={editingLang}
        setEditingLang={setEditingLang}
        ready={{ fr: languageReady(content, "fr"), en: languageReady(content, "en") }}
        busy={pending || uploading}
        onSave={() => submit(false)}
        onPublish={() => submit(true)}
      />

      {error && <p className={`${ALERT} mt-5`}>{error}</p>}

      {sourceNote && (
        <aside className="mt-5 rounded-[14px] border border-[#dcd8f2] bg-[#f4f2ff] px-4 py-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#2a2a86]">
            {a.whatTheCronRead}
          </p>
          <p className="mt-1 text-[14px] leading-[21px] text-[#4f4a50]">{sourceNote}</p>
        </aside>
      )}

      {/* From here down the markup follows the public page, block for block. */}
      <header className="mt-7 max-w-[820px]">
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

      <Section
        title={dict.projects.timeline}
        action={
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() =>
              set({
                milestones: [
                  ...content.milestones,
                  { on: "", title: { fr: "", en: "" } },
                ] as ProjectContent["milestones"],
              })
            }
          >
            {a.addMilestone}
          </button>
        }
      >
        {content.milestones.length === 0 ? (
          <Empty text={a.emptyMilestones} />
        ) : (
          <ol className={`${CARD} divide-y divide-[#f2ece4]`}>
            {content.milestones.map((milestone, i) => {
              const patch = (next: Partial<(typeof content.milestones)[number]>) =>
                set({
                  milestones: content.milestones.map((m, k) =>
                    k === i ? { ...m, ...next } : m,
                  ) as ProjectContent["milestones"],
                });
              return (
                <li key={i} className="group/row relative p-4 pr-24 sm:p-5 sm:pr-28">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <Field
                      name={a.milestoneOn}
                      value={milestone.on}
                      onChange={(on) => patch({ on })}
                      placeholder="2026-06-01"
                      className={`w-[11ch] shrink-0 text-[13px] font-semibold tabular-nums ${MUTED}`}
                    />
                    <Field
                      name={a.milestoneDateLabel}
                      value={milestone.onLabel?.[L] ?? ""}
                      onChange={(text) =>
                        patch({ onLabel: text ? write(milestone.onLabel, text) : undefined })
                      }
                      placeholder={a.milestoneDateLabelPlaceholder}
                      optional
                      className={`w-[15ch] shrink-0 text-[13px] ${MUTED}`}
                    />
                    <RowTools
                      a={a}
                      index={i}
                      length={content.milestones.length}
                      onMove={(to) =>
                        set({
                          milestones: move(
                            content.milestones,
                            i,
                            to,
                          ) as ProjectContent["milestones"],
                        })
                      }
                      onRemove={() =>
                        set({
                          milestones: content.milestones.filter(
                            (_, k) => k !== i,
                          ) as ProjectContent["milestones"],
                        })
                      }
                    />
                  </div>
                  <Field
                    as="textarea"
                    name={a.label}
                    value={milestone.title[L]}
                    onChange={(text) => patch({ title: write(milestone.title, text) })}
                    className="text-[16px] font-semibold leading-[24px]"
                  />
                  <Field
                    as="textarea"
                    name={a.milestoneBody}
                    value={milestone.body?.[L] ?? ""}
                    onChange={(text) =>
                      patch({ body: text ? write(milestone.body, text) : undefined })
                    }
                    placeholder={a.milestoneBody}
                    optional
                    className={`max-w-[68ch] text-[15px] leading-[23px] ${MUTED}`}
                  />
                  <Field
                    name={a.milestoneResolution}
                    value={milestone.resolution ?? ""}
                    onChange={(text) => patch({ resolution: text || undefined })}
                    optional
                    className={`text-[13px] tabular-nums ${MUTED}`}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section
        title={a.photosLabel}
        action={
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
        }
      >
        {content.photos.length === 0 ? (
          <Empty text={a.emptyPhotos} />
        ) : (
          <div className="flex flex-col gap-6">
            <PhotoBlock
              a={a}
              photo={lead}
              lang={L}
              cap="max-h-[520px]"
              onChange={(next) =>
                set({
                  photos: content.photos.map((p, k) =>
                    k === 0 ? next : p,
                  ) as ProjectContent["photos"],
                })
              }
              onRemove={() =>
                set({ photos: content.photos.slice(1) as ProjectContent["photos"] })
              }
            />
            {gallery.length > 0 && (
              <ul className="grid gap-5 sm:grid-cols-2">
                {gallery.map((photo, k) => (
                  <li key={`${photo.src}-${k}`}>
                    <PhotoBlock
                      a={a}
                      photo={photo}
                      lang={L}
                      cap="max-h-[320px]"
                      onChange={(next) =>
                        set({
                          photos: content.photos.map((p, j) =>
                            j === k + 1 ? next : p,
                          ) as ProjectContent["photos"],
                        })
                      }
                      onRemove={() =>
                        set({
                          photos: content.photos.filter(
                            (_, j) => j !== k + 1,
                          ) as ProjectContent["photos"],
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      <Section
        title={dict.projects.about}
        action={
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() => set({ description: [...content.description, { fr: "", en: "" }] })}
          >
            {a.addParagraph}
          </button>
        }
      >
        {content.description.length === 0 ? (
          <Empty text={a.emptyDescription} />
        ) : (
          <div className={`${CARD} p-5 md:p-7`}>
            {content.description.map((paragraph, i) => (
              <div key={i} className="group/row mt-3 first:mt-0">
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
                <div className="flex">
                  <RowTools
                    a={a}
                    index={i}
                    length={content.description.length}
                    onMove={(to) => set({ description: move(content.description, i, to) })}
                    onRemove={() =>
                      set({ description: content.description.filter((_, k) => k !== i) })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={dict.projects.sources}
        action={
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() =>
              set({ sources: [...content.sources, { label: { fr: "", en: "" }, url: "" }] })
            }
          >
            {a.addSource}
          </button>
        }
      >
        {content.sources.length === 0 ? (
          <Empty text={a.emptySources} />
        ) : (
          <ul className={`${CARD} divide-y divide-[#f2ece4]`}>
            {content.sources.map((source, i) => {
              const patch = (next: Partial<(typeof content.sources)[number]>) =>
                set({
                  sources: content.sources.map((s, k) => (k === i ? { ...s, ...next } : s)),
                });
              return (
                <li key={i} className="group/row px-4 py-3">
                  <Field
                    name={a.label}
                    value={source.label[L]}
                    onChange={(text) => patch({ label: write(source.label, text) })}
                    className="text-[15px] font-bold text-[#fa3250]"
                  />
                  <div className="flex flex-wrap items-center gap-x-3">
                    <Field
                      name={a.sourceUrl}
                      value={source.url}
                      onChange={(url) => patch({ url })}
                      placeholder="https://"
                      className={`min-w-0 flex-1 text-[13px] ${MUTED}`}
                    />
                    <RowTools
                      a={a}
                      index={i}
                      length={content.sources.length}
                      onMove={(to) => set({ sources: move(content.sources, i, to) })}
                      onRemove={() =>
                        set({ sources: content.sources.filter((_, k) => k !== i) })
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Three values a resident never sees, so they sit below the article
          rather than inside it. */}
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
                  {dict.projects.status[status]}
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

/* ---------------------------------------------------------------- the field */

/**
 * One editable value, drawn as the text it will become.
 *
 * No border and no background at rest, and the type styles come from the
 * caller, so a title reads as a title and a caption as a caption. A textarea
 * grows to its content, which is the detail that most decides whether a box
 * feels like a form: prose that scrolls inside a fixed rectangle is a field,
 * prose that pushes the page down is a paragraph. `field-sizing` does that
 * where it exists, and the effect measures the element where it does not.
 */
function Field({
  as = "input",
  name,
  value,
  onChange,
  placeholder,
  optional = false,
  className = "",
}: {
  as?: "input" | "textarea";
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Keep the placeholder invisible until the row is approached.
   *
   * An empty optional field that prints "Résolution" in grey looks exactly like
   * an optional field somebody filled in with the word Résolution. Eleven
   * milestones with three optional fields each turned the timeline into
   * thirty-three lines of ghost text, which is most of why the page read as a
   * form. The field is still there, still the same size, still clickable — it
   * simply says nothing until the pointer or the keyboard arrives.
   */
  optional?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  // An optional field with nothing in it takes no room until somebody comes
  // near the row. `sr-only` rather than `hidden`, because the two differ in the
  // way that matters here: `hidden` drops the field out of the tab order and a
  // keyboard could never reach the resolution number at all, while `sr-only`
  // only takes it out of the *layout* and leaves it focusable — at which point
  // `focus:not-sr-only` brings it back into the page around the caret.
  const tucked = optional && !value;

  const shared =
    "block w-full -mx-1.5 rounded-[6px] border-0 bg-transparent px-1.5 py-0.5 outline-none " +
    "transition-colors placeholder:font-normal placeholder:text-[#b3aeb5] " +
    "hover:bg-[#f7f0e8] focus:bg-white focus:ring-2 focus:ring-[#fa3250]/35 " +
    (tucked ? "sr-only focus:not-sr-only group-hover/row:not-sr-only " : "") +
    className;

  if (as === "textarea") {
    return (
      <textarea
        ref={ref}
        rows={1}
        aria-label={name}
        placeholder={placeholder ?? name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${shared} resize-none overflow-hidden [field-sizing:content]`}
      />
    );
  }

  return (
    <input
      aria-label={name}
      placeholder={placeholder ?? name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={shared}
    />
  );
}

/* -------------------------------------------------------------- furnishings */

const META =
  "w-full rounded-[10px] border border-[#ddd5cd] bg-white px-3 py-2.5 text-[14px] leading-[20px] outline-none focus:border-[#fa3250] focus:ring-2 focus:ring-[#fa3250]/10";

type Admin = ReturnType<typeof getDictionary>["projectAdmin"];

/** The one piece of chrome, kept to a single line. */
function Bar({
  a,
  editingLang,
  setEditingLang,
  ready,
  busy,
  onSave,
  onPublish,
}: {
  a: Admin;
  editingLang: Locale;
  setEditingLang: (lang: Locale) => void;
  ready: Record<Locale, boolean>;
  busy: boolean;
  onSave: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-[#efe7dd] bg-[#fef7f0]/95 px-4 py-2.5 backdrop-blur">
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
                ready[option] ? "bg-[#2f8b57]" : "bg-[#fa3250]"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={onSave}>
          {busy ? a.working : a.save}
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={onPublish}>
          {busy ? a.working : a.saveAndPublish}
        </button>
      </div>
    </div>
  );
}

/** A heading exactly as the public page sets it, with its one action beside it. */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold leading-[28px] tracking-[-0.01em] sm:text-[22px]">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Move and remove, revealed by the row they belong to.
 *
 * Always in the tree so a keyboard reaches them, and only painted once the
 * pointer is on the row or the focus is inside it: a page showing six delete
 * buttons at rest is a control panel, not an article.
 */
function RowTools({
  a,
  index,
  length,
  onMove,
  onRemove,
}: {
  a: Admin;
  index: number;
  length: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <span className="absolute right-2 top-2 z-10 inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-white/90 opacity-0 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
      <button
        type="button"
        className={BTN_GHOST}
        disabled={index === 0}
        aria-label={a.moveUp}
        onClick={() => onMove(index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={BTN_GHOST}
        disabled={index === length - 1}
        aria-label={a.moveUp}
        onClick={() => onMove(index + 1)}
      >
        ↓
      </button>
      <button type="button" className={BTN_GHOST} onClick={onRemove}>
        {a.remove}
      </button>
    </span>
  );
}

/** A photograph as the public page prints it: whole, caption and credit under. */
function PhotoBlock({
  a,
  photo,
  lang,
  cap,
  onChange,
  onRemove,
}: {
  a: Admin;
  photo: ProjectContent["photos"][number];
  lang: Locale;
  cap: string;
  onChange: (next: ProjectContent["photos"][number]) => void;
  onRemove: () => void;
}) {
  return (
    <figure className={`${CARD} group/row overflow-hidden`}>
      <IssuePhoto
        src={photo.src}
        alt={photo.caption[lang] || ""}
        cap={cap}
        sizes="(min-width: 1024px) 1100px, 100vw"
      />
      <figcaption className="p-4">
        <div className="flex items-start gap-2">
          <Field
            as="textarea"
            name={a.photoCaption}
            value={photo.caption[lang]}
            onChange={(text) =>
              onChange({ ...photo, caption: { ...photo.caption, [lang]: text } })
            }
            className="text-[14px] leading-[21px]"
          />
          <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
            <button type="button" className={BTN_GHOST} onClick={onRemove}>
              {a.remove}
            </button>
          </span>
        </div>
        <Field
          name={a.photoCredit}
          value={photo.credit}
          onChange={(credit) => onChange({ ...photo, credit })}
          className={`mt-1 text-[12px] ${MUTED}`}
        />
      </figcaption>
    </figure>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p
      className={`rounded-[14px] border border-dashed border-[#e5ded7] px-4 py-6 text-center text-[14px] ${MUTED}`}
    >
      {text}
    </p>
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

function move<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

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
function languageReady(content: ProjectContent, lang: Locale): boolean {
  return Boolean(
    content.title[lang].trim() &&
      content.summary[lang].trim() &&
      content.description.length > 0 &&
      content.description.every((paragraph) => paragraph[lang].trim()) &&
      content.photos.length > 0 &&
      content.photos.every((photo) => photo.caption[lang].trim()) &&
      content.milestones.length >= 2 &&
      content.milestones.every((milestone) => milestone.title[lang].trim()),
  );
}
