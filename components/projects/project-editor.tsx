"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProject, uploadProjectPhoto } from "@/app/actions/projects";
import type { Localized, Milestone, ProjectContent } from "@/utils/projects";
import { getDictionary, type Locale } from "@/utils/i18n";
import {
  ALERT,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  MUTED,
} from "@/components/ui/styles";

const STATUSES = ["study", "decided", "underway", "done"] as const;

/** An empty project, for a page the office starts without a cron proposal. */
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

const EDIT_FIELD =
  "w-full rounded-[9px] border border-transparent bg-transparent px-2 py-1.5 outline-none transition-colors hover:border-[#e5ded7] hover:bg-[#fffdfb] focus:border-[#fa3250] focus:bg-white focus:ring-2 focus:ring-[#fa3250]/10 disabled:opacity-60";
const META_FIELD =
  "w-full rounded-[10px] border border-[#ddd5cd] bg-white px-3 py-2.5 text-[14px] leading-[20px] outline-none focus:border-[#fa3250] focus:ring-2 focus:ring-[#fa3250]/10";
const EDIT_LABEL =
  "mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#817b82]";

const blankLocalized = (): Localized => ({ fr: "", en: "" });

function writeLocalized(value: Localized | undefined, lang: Locale, text: string): Localized {
  return { ...(value ?? blankLocalized()), [lang]: text };
}

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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** A quiet warning on the language tabs, not a second completeness authority. */
function languageLooksReady(content: ProjectContent, lang: Locale): boolean {
  return Boolean(
    content.title[lang].trim() &&
      content.summary[lang].trim() &&
      content.description.length > 0 &&
      content.description.every((paragraph) => paragraph[lang].trim()) &&
      content.photos.length > 0 &&
      content.photos.every((photo) => photo.caption[lang].trim()) &&
      content.milestones.length >= 2 &&
      content.milestones.every(
        (milestone) =>
          milestone.title[lang].trim() &&
          (!milestone.body || milestone.body[lang].trim()) &&
          (!milestone.onLabel || milestone.onLabel[lang].trim()) &&
          (!milestone.source || milestone.source.label[lang].trim()),
      ) &&
      content.sources.every((source) => source.label[lang].trim()),
  );
}

/**
 * The title is edited where a title is read, the timeline as dated updates,
 * photographs stay photographs, and sources remain a list of links. Changing
 * language changes only the prose; structural actions apply to both at once.
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

  const set = (patch: Partial<ProjectContent>) =>
    setContent((current) => ({ ...current, ...patch }));

  const submit = (publish: boolean) =>
    start(async () => {
      setError(null);
      const result = await saveProject(revisionId, { projectId, slug, content, publish });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (publish && result.slug) {
        router.push(`/${lang}/projets/${result.slug}`);
      } else if (result.revisionId) {
        router.push(`/${lang}/projets/revisions/${result.revisionId}`);
      } else {
        router.push(`/${lang}/projets/revisions`);
      }
      router.refresh();
    });

  const addPhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    const { url, error: uploadError } = await uploadProjectPhoto(slug || "sans-nom", file);
    setUploading(false);
    if (uploadError || !url) {
      setError(uploadError ?? a.uploadFailed);
      return;
    }
    set({
      photos: [
        ...content.photos,
        { src: url, caption: blankLocalized(), credit: "" },
      ] as ProjectContent["photos"],
    });
  };

  const patchMilestone = (index: number, patch: Partial<Milestone>) =>
    set({
      milestones: content.milestones.map((milestone, at) =>
        at === index ? { ...milestone, ...patch } : milestone,
      ) as ProjectContent["milestones"],
    });

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <div className="sticky top-2 z-30 mb-6 rounded-[16px] border border-[#ded7d0] bg-white/95 p-3 shadow-[0_8px_24px_rgba(31,22,16,0.10)] backdrop-blur sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <p className="text-[15px] font-semibold leading-[21px]">{a.visualEditor}</p>
            <p className={`text-[12px] leading-[18px] ${MUTED}`}>{a.visualEditorHint}</p>
          </div>
          <div
            className="inline-flex rounded-[10px] border border-[#ded7d0] bg-[#f8f5f1] p-1"
            aria-label={a.editLanguage}
          >
            {(["fr", "en"] as const).map((option) => {
              const ready = languageLooksReady(content, option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEditingLang(option)}
                  className={`inline-flex min-h-[36px] items-center gap-2 rounded-[8px] px-3 text-[13px] font-semibold transition-colors ${
                    editingLang === option
                      ? "bg-white text-[#1a1a1a] shadow-sm"
                      : "text-[#6e6a72] hover:text-[#1a1a1a]"
                  }`}
                  aria-pressed={editingLang === option}
                  title={ready ? a.languageReady : a.languageIncomplete}
                >
                  {option.toUpperCase()}
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-[#2f8b57]" : "bg-[#fa3250]"}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={pending || uploading}
            onClick={() => submit(false)}
          >
            {pending ? a.working : a.save}
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={pending || uploading}
            onClick={() => submit(true)}
          >
            {pending ? a.working : a.saveAndPublish}
          </button>
        </div>
      </div>

      {error && <p className={`${ALERT} mb-5`}>{error}</p>}

      {sourceNote && (
        <aside className="mb-6 rounded-[14px] border border-[#dcd8f2] bg-[#f4f2ff] p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#2a2a86]">
            {a.whatTheCronRead}
          </p>
          <p className="mt-1 text-[14px] leading-[21px] text-[#4f4a50]">{sourceNote}</p>
        </aside>
      )}

      <p className={`mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] ${MUTED}`}>
        {a.citizenPreview}
      </p>

      <header className="rounded-[18px] border border-[#e5ded7] bg-white p-5 shadow-[0_2px_8px_rgba(31,22,16,0.05)] sm:p-7 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <InlineLocalized
              label={a.title}
              lang={editingLang}
              value={content.title}
              onChange={(title) => {
                set({ title });
                if (!slugTouched && editingLang === "fr") setSlug(slugify(title.fr));
              }}
              className="text-[30px] font-semibold leading-[38px] tracking-[-0.025em] sm:text-[38px] sm:leading-[46px]"
            />
            <InlineText
              label={a.address}
              value={content.address}
              onChange={(address) => set({ address })}
              placeholder={a.addressPlaceholder}
              className={`mt-1 text-[14px] ${MUTED}`}
            />
          </div>
          <label>
            <span className="sr-only">{a.status}</span>
            <select
              className="rounded-full border border-[#dcd8f2] bg-[#f4f2ff] px-3 py-2 text-[13px] font-semibold text-[#2a2a86] outline-none focus:border-[#5d56b4]"
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
          </label>
        </div>
        <InlineLocalized
          label={a.summary}
          lang={editingLang}
          value={content.summary}
          onChange={(summary) => set({ summary })}
          multiline
          rows={3}
          className="mt-4 max-w-[72ch] text-[17px] leading-[27px] text-[#4f4a50]"
        />
        <details className="mt-5 rounded-[12px] border border-[#eee7df] bg-[#fffdfb]">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-[#5d56b4]">
            {a.advanced}
          </summary>
          <div className="grid gap-4 border-t border-[#eee7df] p-4 sm:grid-cols-2">
            <MetaField label={a.slug}>
              <input
                className={META_FIELD}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                placeholder="parc-mackenzie-king"
              />
              <span className={`mt-1 block text-[12px] ${MUTED}`}>
                /{lang}/projets/{slug || "…"}
              </span>
            </MetaField>
            <MetaField label={a.councilTerm}>
              <input
                className={META_FIELD}
                value={content.councilTerm ?? ""}
                onChange={(event) => set({ councilTerm: event.target.value || undefined })}
                placeholder="empress"
              />
            </MetaField>
          </div>
        </details>
      </header>

      <VisualSection
        className="mt-9"
        title={dict.projects.timeline}
        action={
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() =>
              set({
                milestones: [
                  ...content.milestones,
                  { on: "", title: blankLocalized() },
                ] as ProjectContent["milestones"],
              })
            }
          >
            {a.addMilestone}
          </button>
        }
      >
        {content.milestones.length === 0 ? (
          <EmptyBlock text={a.emptyMilestones} />
        ) : (
          <ol className="space-y-3">
            {content.milestones.map((milestone, index) => (
              <li key={index} className={`${CARD} relative p-4 sm:p-5`}>
                <div className="absolute right-3 top-3">
                  <BlockControls
                    index={index}
                    count={content.milestones.length}
                    labels={a}
                    onMove={(to) =>
                      set({
                        milestones: move(content.milestones, index, to) as ProjectContent["milestones"],
                      })
                    }
                    onRemove={() =>
                      set({
                        milestones: content.milestones.filter(
                          (_, at) => at !== index,
                        ) as ProjectContent["milestones"],
                      })
                    }
                  />
                </div>
                <div className="grid gap-4 pt-10 sm:grid-cols-[160px_minmax(0,1fr)] sm:pt-8">
                  <div>
                    <MetaField label={a.milestoneOn}>
                      <input
                        className={META_FIELD}
                        value={milestone.on}
                        onChange={(event) => patchMilestone(index, { on: event.target.value })}
                        placeholder="2026-06-01"
                      />
                    </MetaField>
                    <div className="mt-3">
                      <InlineLocalized
                        label={a.milestoneDateLabel}
                        lang={editingLang}
                        value={milestone.onLabel ?? blankLocalized()}
                        onChange={(onLabel) =>
                          patchMilestone(index, {
                            onLabel: onLabel.fr || onLabel.en ? onLabel : undefined,
                          })
                        }
                        placeholder={a.milestoneDateLabelPlaceholder}
                        className="text-[13px] font-semibold text-[#6e6a72]"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <InlineLocalized
                      label={a.label}
                      lang={editingLang}
                      value={milestone.title}
                      onChange={(title) => patchMilestone(index, { title })}
                      className="text-[20px] font-semibold leading-[28px]"
                    />
                    <InlineLocalized
                      label={a.milestoneBody}
                      lang={editingLang}
                      value={milestone.body ?? blankLocalized()}
                      onChange={(body) =>
                        patchMilestone(index, {
                          body: body.fr || body.en ? body : undefined,
                        })
                      }
                      multiline
                      rows={3}
                      placeholder={a.optional}
                      className={`mt-2 text-[15px] leading-[23px] ${MUTED}`}
                    />
                  </div>
                </div>
                <details className="mt-4 rounded-[10px] border border-[#eee7df] bg-[#fffdfb]">
                  <summary className="cursor-pointer px-3 py-2.5 text-[12px] font-semibold text-[#5d56b4]">
                    {a.milestoneReferences}
                  </summary>
                  <div className="grid gap-4 border-t border-[#eee7df] p-3 sm:grid-cols-2">
                    <MetaField label={a.milestoneResolution}>
                      <input
                        className={META_FIELD}
                        value={milestone.resolution ?? ""}
                        onChange={(event) =>
                          patchMilestone(index, { resolution: event.target.value || undefined })
                        }
                        placeholder="CA26 170129"
                      />
                    </MetaField>
                    {milestone.source ? (
                      <div className="space-y-3">
                        <InlineLocalized
                          label={a.label}
                          lang={editingLang}
                          value={milestone.source.label}
                          onChange={(label) =>
                            patchMilestone(index, {
                              source: { ...milestone.source!, label },
                            })
                          }
                          className="text-[14px] font-semibold"
                        />
                        <MetaField label={a.sourceUrl}>
                          <input
                            className={META_FIELD}
                            value={milestone.source.url}
                            onChange={(event) =>
                              patchMilestone(index, {
                                source: { ...milestone.source!, url: event.target.value },
                              })
                            }
                            placeholder="https://"
                          />
                        </MetaField>
                        <button
                          type="button"
                          className={BTN_GHOST}
                          onClick={() => patchMilestone(index, { source: undefined })}
                        >
                          {a.removeMilestoneSource}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`${BTN_GHOST} self-start justify-self-start`}
                        onClick={() =>
                          patchMilestone(index, {
                            source: { label: blankLocalized(), url: "" },
                          })
                        }
                      >
                        {a.addMilestoneSource}
                      </button>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </VisualSection>

      <VisualSection
        className="mt-10"
        title={a.photosLabel}
        action={
          <label className={`${BTN_SECONDARY} cursor-pointer`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5V20h14v-5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
          <EmptyBlock text={a.emptyPhotos} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {content.photos.map((photo, index) => (
              <article
                key={`${photo.src}-${index}`}
                className={`${CARD} relative overflow-hidden ${index === 0 ? "sm:col-span-2" : ""}`}
              >
                <div className="relative grid min-h-[220px] place-items-center overflow-hidden bg-[#eee8e1] sm:min-h-[280px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt=""
                    className={`max-h-[460px] w-full object-contain ${index === 0 ? "min-h-[280px]" : ""}`}
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#2a2a86] shadow-sm">
                    {index === 0 ? a.mainPhoto : a.galleryPhoto}
                  </div>
                  <div className="absolute right-2 top-2">
                    <BlockControls
                      index={index}
                      count={content.photos.length}
                      labels={a}
                      onMove={(to) =>
                        set({ photos: move(content.photos, index, to) as ProjectContent["photos"] })
                      }
                      onRemove={() =>
                        set({
                          photos: content.photos.filter(
                            (_, at) => at !== index,
                          ) as ProjectContent["photos"],
                        })
                      }
                    />
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <InlineLocalized
                    label={a.photoCaption}
                    lang={editingLang}
                    value={photo.caption}
                    onChange={(caption) =>
                      set({
                        photos: content.photos.map((item, at) =>
                          at === index ? { ...item, caption } : item,
                        ) as ProjectContent["photos"],
                      })
                    }
                    multiline
                    rows={2}
                    className="text-[14px] leading-[21px]"
                  />
                  <InlineText
                    label={a.photoCredit}
                    value={photo.credit}
                    onChange={(credit) =>
                      set({
                        photos: content.photos.map((item, at) =>
                          at === index ? { ...item, credit } : item,
                        ) as ProjectContent["photos"],
                      })
                    }
                    className={`mt-1 text-[12px] ${MUTED}`}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </VisualSection>

      <VisualSection
        className="mt-10"
        title={dict.projects.about}
        action={
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() => set({ description: [...content.description, blankLocalized()] })}
          >
            {a.addParagraph}
          </button>
        }
      >
        <div className={`${CARD} space-y-4 p-5 sm:p-7`}>
          {content.description.length === 0 ? (
            <EmptyBlock text={a.emptyDescription} />
          ) : (
            content.description.map((paragraph, index) => (
              <div key={index} className="relative pr-0 pt-9 sm:pr-32 sm:pt-0">
                <InlineLocalized
                  label={`${a.paragraph} ${index + 1}`}
                  lang={editingLang}
                  value={paragraph}
                  onChange={(next) =>
                    set({
                      description: content.description.map((item, at) =>
                        at === index ? next : item,
                      ),
                    })
                  }
                  multiline
                  rows={4}
                  className="text-[17px] leading-[27px]"
                />
                <div className="absolute right-0 top-0">
                  <BlockControls
                    index={index}
                    count={content.description.length}
                    labels={a}
                    onMove={(to) => set({ description: move(content.description, index, to) })}
                    onRemove={() =>
                      set({ description: content.description.filter((_, at) => at !== index) })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </VisualSection>

      <VisualSection
        className="mt-10"
        title={dict.projects.sources}
        action={
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() =>
              set({ sources: [...content.sources, { label: blankLocalized(), url: "" }] })
            }
          >
            {a.addSource}
          </button>
        }
      >
        {content.sources.length === 0 ? (
          <EmptyBlock text={a.emptySources} />
        ) : (
          <ul className={`${CARD} divide-y divide-[#f2ece4]`}>
            {content.sources.map((source, index) => (
              <li
                key={index}
                className="relative grid gap-3 p-4 pr-4 pt-14 sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] sm:pr-36 sm:pt-4"
              >
                <InlineLocalized
                  label={a.label}
                  lang={editingLang}
                  value={source.label}
                  onChange={(label) =>
                    set({
                      sources: content.sources.map((item, at) =>
                        at === index ? { ...item, label } : item,
                      ),
                    })
                  }
                  className="font-semibold text-[#fa3250]"
                />
                <MetaField label={a.sourceUrl}>
                  <input
                    className={META_FIELD}
                    value={source.url}
                    onChange={(event) =>
                      set({
                        sources: content.sources.map((item, at) =>
                          at === index ? { ...item, url: event.target.value } : item,
                        ),
                      })
                    }
                    placeholder="https://"
                  />
                </MetaField>
                <div className="absolute right-3 top-3">
                  <BlockControls
                    index={index}
                    count={content.sources.length}
                    labels={a}
                    onMove={(to) => set({ sources: move(content.sources, index, to) })}
                    onRemove={() =>
                      set({ sources: content.sources.filter((_, at) => at !== index) })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </VisualSection>

      <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-[#e5ded7] pt-5">
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={pending || uploading}
          onClick={() => submit(false)}
        >
          {pending ? a.working : a.save}
        </button>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={pending || uploading}
          onClick={() => submit(true)}
        >
          {pending ? a.working : a.saveAndPublish}
        </button>
      </div>
    </div>
  );
}

function VisualSection({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-semibold leading-[30px] tracking-[-0.01em] sm:text-[24px]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function InlineLocalized({
  label,
  lang,
  value,
  onChange,
  multiline = false,
  rows = 1,
  placeholder,
  className = "",
}: {
  label: string;
  lang: Locale;
  value: Localized;
  onChange: (value: Localized) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const shared = `${EDIT_FIELD} ${className}`;
  return (
    <label className="block min-w-0">
      <span className={EDIT_LABEL}>
        {label} · {lang.toUpperCase()}
      </span>
      {multiline ? (
        <textarea
          className={`${shared} resize-y`}
          rows={rows}
          value={value[lang]}
          placeholder={placeholder}
          onChange={(event) => onChange(writeLocalized(value, lang, event.target.value))}
        />
      ) : (
        <input
          className={shared}
          value={value[lang]}
          placeholder={placeholder}
          onChange={(event) => onChange(writeLocalized(value, lang, event.target.value))}
        />
      )}
    </label>
  );
}

function InlineText({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className={EDIT_LABEL}>{label}</span>
      <input
        className={`${EDIT_FIELD} ${className}`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={EDIT_LABEL}>{label}</span>
      {children}
    </label>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#d8d0c8] bg-[#fffdfb] px-5 py-8 text-center">
      <p className={`text-[14px] leading-[21px] ${MUTED}`}>{text}</p>
    </div>
  );
}

function BlockControls({
  index,
  count,
  labels,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  labels: ReturnType<typeof getDictionary>["projectAdmin"];
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[9px] border border-[#e5ded7] bg-white/95 p-1 shadow-sm">
      <IconButton label={labels.moveUp} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <path d="m7 14 5-5 5 5" />
      </IconButton>
      <IconButton
        label={labels.moveDown}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <path d="m7 10 5 5 5-5" />
      </IconButton>
      <IconButton label={labels.remove} danger onClick={onRemove}>
        <path d="M5 7h14M9.5 7V5h5v2M7 7l.8 12h8.4L17 7" />
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  disabled = false,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-[7px] transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
        danger
          ? "text-[#ab1f5c] hover:bg-[#fdeaf2]"
          : "text-[#6e6a72] hover:bg-[#f4eee8] hover:text-[#1a1a1a]"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </g>
      </svg>
    </button>
  );
}
