import Link from "next/link";
import { CHIP, CHIP_ACTIVE } from "@/components/ui/styles";
import type { Category } from "@/utils/issues";

/**
 * How many categories the hero offers. Seven exist, but this row replaced the
 * search field precisely to give the page back to the feed — three rows of
 * pills on a phone would have spent the space rather than saved it. The ones
 * that get used most are the ones that earn a slot; the rest are still a search
 * away, and the active one is always shown whether it made the cut or not.
 */
export const TOP_CATEGORIES = 5;

export type CategoryChip = {
  key: Category;
  label: string;
  count: number;
  href: string;
};

/**
 * Filters with few options are chips, not a dropdown: five categories behind a
 * select box hide all five behind a click and say nothing about how busy each
 * one is. Links, not buttons — the filter belongs in the URL, so it survives a
 * reload, a share and the back button, and works before the JavaScript lands.
 */
export function CategoryChips({
  label,
  allLabel,
  allHref,
  total,
  items,
  active,
}: {
  label: string;
  allLabel: string;
  allHref: string;
  total: number;
  items: CategoryChip[];
  active: Category | null;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-[13px] font-bold leading-[18px] text-[#6e6a72]">{label}</p>

      {/* One calm row on the narrowest phones. Wrapping five categories into
          four or five lines made this filter consume more space than the
          introduction it belongs to; from `sm` up, everything is visible in
          the ordinary wrapped row. */}
      <ul className="chip-strip -mx-4 mt-2.5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <li className="shrink-0 snap-start">
          <Link
            href={allHref}
            aria-current={active ? undefined : "true"}
            className={active ? CHIP : CHIP_ACTIVE}
          >
            {allLabel}
            <Count value={total} muted={Boolean(active)} />
          </Link>
        </li>

        {items.map((item) => (
          <li key={item.key} className="shrink-0 snap-start">
            <Link
              href={item.href}
              aria-current={active === item.key ? "true" : undefined}
              className={active === item.key ? CHIP_ACTIVE : CHIP}
            >
              {item.label}
              <Count value={item.count} muted={active !== item.key} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `tabular-nums` so a column of counts doesn't shimmy as the digits change. */
function Count({ value, muted }: { value: number; muted: boolean }) {
  return (
    <span className={`ml-2 tabular-nums ${muted ? "text-[#6e6a72]" : "text-white/75"}`}>
      {value}
    </span>
  );
}
