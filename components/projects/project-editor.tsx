"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProject, uploadProjectPhoto } from "@/app/actions/projects";
import type { ProjectContent } from "@/utils/projects";
import type { getDictionary } from "@/utils/i18n";
import {
  ALERT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_GHOST,
  CARD,
  FIELD,
  LABEL,
  MUTED,
  SECTION_TITLE,
} from "@/components/ui/styles";

/**
 * Writing a project, in both languages, without writing JSON.
 *
 * The content this edits is one JSONB column, and the obvious cheap build is a
 * textarea holding the JSON. That would work exactly once, for whoever wrote
 * it: the people this is for maintain a borough's project page, not a schema,
 * and a missing brace should not be able to take a page down.
 *
 * So every repeated group — paragraph, photo, date, source — is a row that can
 * be added and removed, and both languages sit side by side rather than behind
 * a toggle. Side by side is deliberate. A language toggle makes it easy to
 * publish a project whose English half is still the French text, which is
 * exactly the state the cron leaves its drafts in, and the way to stop that is
 * to keep the gap visible while somebody types.
 *
 * The state is the whole `ProjectContent` and every edit replaces it. At this
 * size that is simpler to follow than field-level reducers and costs nothing:
 * the largest project in the corpus is four photos and eleven dates.
 */

type Dict = ReturnType<typeof getDictionary>;
type Localized = { fr: string; en: string };

const STATUSES = ["study", "decided", "underway", "done"] as const;

/** An empty project, for the create case. */
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

export function ProjectEditor({
  lang,
  t,
  revisionId,
  projectId,
  initialSlug,
  initialContent,
  sourceNote,
}: {
  lang: string;
  t: Dict;
  /** Continues an existing proposal. Null starts one. */
  revisionId: string | null;
  /** The project being edited. Null creates one. */
  projectId: string | null;
  initialSlug: string;
  initialContent: ProjectContent;
  /** What the cron read, shown so a reviewer can check rather than trust. */
  sourceNote: string | null;
}) {
  const a = t.projectAdmin;
  const router = useRouter();
  const [pending, start] = useTransition();

  const [slug, setSlug] = useState(initialSlug);
  const [content, setContent] = useState<ProjectContent>(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = (patch: Partial<ProjectContent>) =>
    setContent((current) => ({ ...current, ...patch }));

  const submit = (publish: boolean) =>
    start(async () => {
      setError(null);
      const result = await saveProject(revisionId, {
        projectId,
        slug,
        content,
        publish,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/${lang}/projets/revisions`);
      router.refresh();
    });

  const addPhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    const { url, error: uploadError } = await uploadProjectPhoto(slug || "sans-nom", file);
    setUploading(false);
    if (uploadError || !url) {
      setError(uploadError ?? "Téléversement impossible.");
      return;
    }
    set({
      photos: [
        ...content.photos,
        { src: url, caption: { fr: "", en: "" }, credit: "" },
      ] as ProjectContent["photos"],
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error && <p className={ALERT}>{error}</p>}

      {sourceNote && (
        <div className={`${CARD} flex flex-col gap-1.5 p-4`}>
          <p className="text-[13px] font-bold uppercase tracking-wide text-[#2a2a86]">
            {a.whatTheCronRead}
          </p>
          <p className={`text-[14px] leading-[21px] ${MUTED}`}>{sourceNote}</p>
        </div>
      )}

      <section className={`${CARD} flex flex-col gap-4 p-4 md:p-5`}>
        <h2 className={SECTION_TITLE}>{a.basics}</h2>

        <Pair
          label={a.titleFr}
          labelEn={a.titleEn}
          value={content.title}
          onChange={(title) => set({ title })}
        />
        <Pair
          label={a.summaryFr}
          labelEn={a.summaryEn}
          value={content.summary}
          onChange={(summary) => set({ summary })}
          multiline
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="slug">
              {a.slug}
            </label>
            <input
              id="slug"
              className={FIELD}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="parc-mackenzie-king"
            />
            <p className={`mt-1.5 text-[13px] ${MUTED}`}>/{lang}/projets/{slug || "…"}</p>
          </div>
          <div>
            <label className={LABEL} htmlFor="address">
              {a.address}
            </label>
            <input
              id="address"
              className={FIELD}
              value={content.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="5560, rue Sherbrooke Ouest"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="status">
              {a.status}
            </label>
            <select
              id="status"
              className={`${FIELD} min-w-0`}
              value={content.status}
              onChange={(e) =>
                set({ status: e.target.value as ProjectContent["status"] })
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.projects.status[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="term">
              {a.councilTerm}
            </label>
            <input
              id="term"
              className={FIELD}
              value={content.councilTerm ?? ""}
              onChange={(e) => set({ councilTerm: e.target.value || undefined })}
              placeholder="empress"
            />
          </div>
        </div>
      </section>

      <Repeated
        title={a.descriptionLabel}
        addLabel={a.addParagraph}
        removeLabel={a.remove}
        items={content.description}
        onAdd={() => set({ description: [...content.description, { fr: "", en: "" }] })}
        onRemove={(i) =>
          set({ description: content.description.filter((_, k) => k !== i) })
        }
        render={(paragraph, i) => (
          <Pair
            label={`${a.paragraph} ${i + 1} — français`}
            labelEn={`${a.paragraph} ${i + 1} — anglais`}
            value={paragraph}
            onChange={(next) =>
              set({
                description: content.description.map((p, k) => (k === i ? next : p)),
              })
            }
            multiline
          />
        )}
      />

      <section className={`${CARD} flex flex-col gap-4 p-4 md:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={SECTION_TITLE}>{a.photosLabel}</h2>
          <label className={`${BTN_SECONDARY} cursor-pointer`}>
            {uploading ? "…" : a.addPhoto}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void addPhoto(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {content.photos.map((photo, i) => (
          <div key={`${photo.src}-${i}`} className="flex flex-col gap-3 border-t border-[#e9e0d6] pt-4 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt=""
                className="h-20 w-28 shrink-0 rounded-[12px] object-cover"
              />
              <button
                type="button"
                className={BTN_GHOST}
                onClick={() =>
                  set({
                    photos: content.photos.filter((_, k) => k !== i) as ProjectContent["photos"],
                  })
                }
              >
                {a.remove}
              </button>
            </div>
            <Pair
              label={`${a.photoCaption} — français`}
              labelEn={`${a.photoCaption} — anglais`}
              value={photo.caption}
              onChange={(caption) =>
                set({
                  photos: content.photos.map((p, k) =>
                    k === i ? { ...p, caption } : p,
                  ) as ProjectContent["photos"],
                })
              }
            />
            <div>
              <label className={LABEL}>{a.photoCredit}</label>
              <input
                className={FIELD}
                value={photo.credit}
                onChange={(e) =>
                  set({
                    photos: content.photos.map((p, k) =>
                      k === i ? { ...p, credit: e.target.value } : p,
                    ) as ProjectContent["photos"],
                  })
                }
                placeholder="Conrad Poirier, BAnQ (domaine public)"
              />
            </div>
          </div>
        ))}
      </section>

      <Repeated
        title={a.milestonesLabel}
        addLabel={a.addMilestone}
        removeLabel={a.remove}
        items={content.milestones}
        onAdd={() =>
          set({
            milestones: [
              ...content.milestones,
              { on: "", title: { fr: "", en: "" } },
            ] as ProjectContent["milestones"],
          })
        }
        onRemove={(i) =>
          set({
            milestones: content.milestones.filter(
              (_, k) => k !== i,
            ) as ProjectContent["milestones"],
          })
        }
        render={(milestone, i) => {
          const patch = (next: Partial<(typeof content.milestones)[number]>) =>
            set({
              milestones: content.milestones.map((m, k) =>
                k === i ? { ...m, ...next } : m,
              ) as ProjectContent["milestones"],
            });
          return (
            <div className="flex flex-col gap-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>{a.milestoneOn}</label>
                  <input
                    className={FIELD}
                    value={milestone.on}
                    onChange={(e) => patch({ on: e.target.value })}
                    placeholder="2026-06-01"
                  />
                </div>
                <div>
                  <label className={LABEL}>{a.milestoneResolution}</label>
                  <input
                    className={FIELD}
                    value={milestone.resolution ?? ""}
                    onChange={(e) => patch({ resolution: e.target.value || undefined })}
                    placeholder="CA26 170129"
                  />
                </div>
              </div>
              <Pair
                label={`${a.label} — français`}
                labelEn={`${a.label} — anglais`}
                value={milestone.title}
                onChange={(title) => patch({ title })}
              />
            </div>
          );
        }}
      />

      <Repeated
        title={a.sourcesLabel}
        addLabel={a.addSource}
        removeLabel={a.remove}
        items={content.sources}
        onAdd={() =>
          set({ sources: [...content.sources, { label: { fr: "", en: "" }, url: "" }] })
        }
        onRemove={(i) => set({ sources: content.sources.filter((_, k) => k !== i) })}
        render={(source, i) => {
          const patch = (next: Partial<(typeof content.sources)[number]>) =>
            set({
              sources: content.sources.map((s, k) => (k === i ? { ...s, ...next } : s)),
            });
          return (
            <div className="flex flex-col gap-3">
              <Pair
                label={`${a.label} — français`}
                labelEn={`${a.label} — anglais`}
                value={source.label}
                onChange={(label) => patch({ label })}
              />
              <div>
                <label className={LABEL}>{a.sourceUrl}</label>
                <input
                  className={FIELD}
                  value={source.url}
                  onChange={(e) => patch({ url: e.target.value })}
                  placeholder="https://"
                />
              </div>
            </div>
          );
        }}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={pending}
          onClick={() => submit(true)}
        >
          {a.saveAndPublish}
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={pending}
          onClick={() => submit(false)}
        >
          {a.save}
        </button>
      </div>
    </div>
  );
}

/**
 * Both languages of one string, side by side.
 *
 * Never stacked behind a toggle — see the note at the top of this file. On a
 * phone they fall into one column, which keeps them adjacent rather than a
 * click apart.
 */
function Pair({
  label,
  labelEn,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  labelEn: string;
  value: Localized;
  onChange: (next: Localized) => void;
  multiline?: boolean;
}) {
  const Input = multiline ? "textarea" : "input";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={LABEL}>{label}</label>
        <Input
          className={FIELD}
          rows={multiline ? 4 : undefined}
          value={value.fr}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange({ ...value, fr: e.target.value })
          }
        />
      </div>
      <div>
        <label className={LABEL}>{labelEn}</label>
        <Input
          className={FIELD}
          rows={multiline ? 4 : undefined}
          value={value.en}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange({ ...value, en: e.target.value })
          }
        />
      </div>
    </div>
  );
}

/** A titled card holding a list of removable rows and one add button. */
function Repeated<T>({
  title,
  addLabel,
  removeLabel,
  items,
  onAdd,
  onRemove,
  render,
}: {
  title: string;
  addLabel: string;
  removeLabel: string;
  items: readonly T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  render: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <section className={`${CARD} flex flex-col gap-4 p-4 md:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={SECTION_TITLE}>{title}</h2>
        <button type="button" className={BTN_SECONDARY} onClick={onAdd}>
          {addLabel}
        </button>
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 border-t border-[#e9e0d6] pt-4 first:border-0 first:pt-0"
        >
          {render(item, i)}
          <div>
            <button type="button" className={BTN_GHOST} onClick={() => onRemove(i)}>
              {removeLabel}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
