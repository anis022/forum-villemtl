// Single source of truth for control styling, so every form on the site
// renders identically.
//
// Values are measured off montreal.ca, not approximated:
//   text #212529 · muted #637381 · primary #097d6c · border #ced4da
//   hero band #f8f9fa · page white · borders 0.8px · radius 4px
//   controls 40px tall, padding 9px 16px, 16px/24px body, buttons 700 weight

// montreal.ca's `.container`: max-width 1200px with 16px side padding.
export const CONTAINER = "mx-auto w-full max-w-[1200px] px-4";

export const LABEL = "mb-2 block text-[16px] font-bold text-[#212529]";

// No `outline-none`: the global :focus-visible ring is the keyboard indicator.
export const FIELD =
  "w-full rounded-[4px] border-[0.8px] border-[#637381] bg-white px-4 py-[11px] text-[16px] leading-[24px] text-[#212529] focus:border-[#097d6c] disabled:bg-[#f8f9fa]";

export const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-[4px] border-[0.8px] border-[#097d6c] bg-[#097d6c] px-4 py-[9px] text-[16px] font-bold leading-[20px] text-white hover:bg-[#075f53] hover:border-[#075f53] disabled:cursor-not-allowed disabled:opacity-60";

export const BTN_SECONDARY =
  "inline-flex items-center justify-center rounded-[4px] border-[0.8px] border-[#ced4da] bg-white px-4 py-[9px] text-[16px] font-bold leading-[20px] text-[#097d6c] hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-60";

/** Small bordered button, as used under "Les plus recherchés". */
export const CHIP =
  "inline-flex items-center rounded-[4px] border-[0.8px] border-[#ced4da] bg-white px-4 py-[9px] text-[14px] font-bold leading-[20px] text-[#097d6c] hover:bg-[#f8f9fa]";

/** Selected state of a CHIP — filled, matching the primary button. */
export const CHIP_ACTIVE =
  "inline-flex items-center rounded-[4px] border-[0.8px] border-[#097d6c] bg-[#097d6c] px-4 py-[9px] text-[14px] font-bold leading-[20px] text-white hover:bg-[#075f53] hover:border-[#075f53]";

export const LINK = "font-bold text-[#097d6c] underline hover:text-[#075f53]";

export const ALERT =
  "rounded-[4px] border-[0.8px] border-[#f1c9c7] bg-[#fdeceb] px-4 py-3 text-[16px] text-[#a4231f]";

export const CARD = "rounded-[4px] border-[0.8px] border-[#ced4da] bg-white";

export const MUTED = "text-[#637381]";

export const HERO_BAND = "bg-[#f8f9fa]";
