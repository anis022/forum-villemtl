// Single source of truth for control styling, so every surface on the site
// renders identically.
//
// The palette stays anchored on the borough's own teal (#097d6c) — this is a
// civic site and that colour is its identity. Everything around it is warmed:
// the neutrals carry a green bias so text sits in the same world as the accent
// instead of floating in default grey, and the rosette red is reserved for
// backing a neighbour, so support reads warm rather than administrative.
//
//   ink #16241f · muted #5d6b66 · line #dde5e1 · wash #f2f6f4
//   accent #097d6c · accent soft #e2f0ec · rose #d94f45
//
// Corners are generous on purpose. A 4px radius reads as a government form; a
// 16px card reads as somewhere people talk to each other.

export const INK = "#16241f";
export const MUTED_HEX = "#5d6b66";
export const LINE = "#dde5e1";
export const ACCENT = "#097d6c";
export const ACCENT_SOFT = "#e2f0ec";
export const ROSE = "#d94f45";

/** montreal.ca's `.container`: max-width 1200px with 16px side padding. */
export const CONTAINER = "mx-auto w-full max-w-[1200px] px-4";

/** Narrower measure for reading: long body text past ~70 characters tires. */
export const READABLE = "mx-auto w-full max-w-[720px]";

export const LABEL = "mb-2 block text-[15px] font-bold text-[#16241f]";

// No `outline-none`: the global :focus-visible ring is the keyboard indicator.
export const FIELD =
  "w-full rounded-[12px] border border-[#dde5e1] bg-white px-4 py-[12px] text-[16px] leading-[24px] text-[#16241f] placeholder:text-[#93a19c] transition-colors focus:border-[#097d6c] disabled:bg-[#f2f6f4]";

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[#097d6c] bg-[#097d6c] px-5 py-[10px] text-[15px] font-bold leading-[22px] text-white transition-all hover:bg-[#075f53] hover:border-[#075f53] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[#dde5e1] bg-white px-5 py-[10px] text-[15px] font-bold leading-[22px] text-[#097d6c] transition-all hover:border-[#097d6c] hover:bg-[#e2f0ec] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Radius for controls that have no shell of their own — header nav items, text
 * buttons, links. The focus ring is a box-shadow tracing whatever radius the
 * element has, so a `rounded-full` menu item gets a pill ring drawn around a
 * button that was never there. Only things that actually look like buttons —
 * filled, bordered or hover-filled — earn a pill ring; everything else gets
 * corners just round enough to match the page.
 */
export const BARE_CONTROL = "rounded-[8px]";

/** Quiet button for row actions — comment, share. Reads as a control on hover. */
export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-bold leading-[20px] text-[#5d6b66] transition-colors hover:bg-[#f2f6f4] hover:text-[#16241f]";

/**
 * `py-2.5` rather than `py-2`: a 20px line plus 16px of padding is a 36px
 * target, and chips are a phone control. 40px is the floor, so it belongs in
 * the token instead of being patched back on at each call site.
 */
export const CHIP =
  "inline-flex items-center rounded-full border border-[#dde5e1] bg-white px-4 py-2.5 text-[14px] font-bold leading-[20px] text-[#097d6c] transition-colors hover:border-[#097d6c] hover:bg-[#e2f0ec]";

/** Selected state of a CHIP — filled, matching the primary button. */
export const CHIP_ACTIVE =
  "inline-flex items-center rounded-full border border-[#097d6c] bg-[#097d6c] px-4 py-2.5 text-[14px] font-bold leading-[20px] text-white transition-colors hover:bg-[#075f53] hover:border-[#075f53]";

export const LINK = "font-bold text-[#097d6c] underline hover:text-[#075f53]";

export const ALERT =
  "rounded-[12px] border border-[#f3ccc8] bg-[#fdeceb] px-4 py-3 text-[15px] text-[#a4231f]";

/**
 * The card. A hairline border plus a whisper of shadow, rather than the heavy
 * 0.8px grey box: on a feed of thirty posts the border is what you notice, and
 * it should not be.
 */
export const CARD =
  "rounded-[16px] border border-[#dde5e1] bg-white shadow-[0_1px_2px_rgba(22,36,31,0.04)]";

/** Same card, raised on hover — used where the whole card is a target. */
export const CARD_INTERACTIVE = `${CARD} transition-shadow hover:shadow-[0_4px_16px_rgba(22,36,31,0.08)]`;

export const MUTED = "text-[#5d6b66]";

/**
 * The rule a threaded reply hangs off. A shade darker than `line` (#dde5e1),
 * because this one has a different job: a card border only ever sits on white,
 * while a thread line has to stay legible over the accent-soft tint of an
 * official answer as well — and unlike a border it is carrying meaning, not
 * just an edge. Still quiet enough that a thread of thirty replies does not
 * read as a table.
 */
export const THREAD_LINE = "border-[#cbd9d4]";

export const HERO_BAND = "bg-[#f2f6f4]";
