// Single source of truth for control styling, so every surface on the site
// renders identically.
//
// The palette is Ensemble Montréal's, sampled off ensemblemtl.org rather than
// guessed from the wordmark — the logo is blue and aubergine, but almost
// nothing on their site is: the ground is a warm cream, every action is red,
// navigation is indigo, and the dark bars are aubergine.
//
//   ink #1a1a1a · muted #6e6a72 · line #e9e0d6
//   cream #fef7f0 (page) · butter #fffbe5 (bands) · wash #faf1e8 (hovers)
//   accent #fa3250 · accent soft #fde8eb
//   indigo #2a2a86 · deep #32004a · pink #d6337a
//
// Before this the site was built on the borough teal with montreal.ca's
// near-black, which made it read as an arm of the city. It is not one, and the
// city's palette is not ours to use — so nothing here descends from it.
//
// Corners stay generous. A 4px radius reads as a government form; a 16px card
// reads as somewhere people talk to each other. Their site runs closer to
// square, and that is the one place this deliberately does not follow it.

export const INK = "#1a1a1a";
export const MUTED_HEX = "#6e6a72";
export const LINE = "#e9e0d6";

/** Every action on their site is this red. Buttons, links, selected chips. */
export const ACCENT = "#fa3250";
export const ACCENT_SOFT = "#fde8eb";

/** Their navigation colour. Carries "an official spoke" here. */
export const INDIGO = "#2a2a86";
export const INDIGO_SOFT = "#e8e8f6";

/** The aubergine of the wordmark and of their utility bar. */
export const DEEP = "#32004a";

/** The page itself — warm cream, not white and not grey. */
export const CREAM = "#fef7f0";

/** Their second band colour, for the one section that needs to lift off it. */
export const BUTTER = "#fffbe5";

/** Backing a neighbour. Warm, and not the red every button already uses. */
export const PINK = "#d6337a";

/** Page measure: 1200px with 16px side padding. */
export const CONTAINER = "mx-auto w-full max-w-[1200px] px-4";

/** Narrower measure for reading: long body text past ~70 characters tires. */
export const READABLE = "mx-auto w-full max-w-[720px]";

export const LABEL = "mb-2 block text-[15px] font-bold text-[#1a1a1a]";

// No `outline-none`: the global :focus-visible ring is the keyboard indicator.
export const FIELD =
  "w-full rounded-[12px] border border-[#e9e0d6] bg-white px-4 py-[12px] text-[16px] leading-[24px] text-[#1a1a1a] placeholder:text-[#a09a94] transition-colors focus:border-[#fa3250] disabled:bg-[#faf1e8]";

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#fa3250] bg-[#fa3250] px-5 py-[10px] text-[15px] font-bold leading-[22px] text-white transition-all hover:bg-[#d81f3c] hover:border-[#d81f3c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#e9e0d6] bg-white px-5 py-[10px] text-[15px] font-bold leading-[22px] text-[#fa3250] transition-all hover:border-[#fa3250] hover:bg-[#fde8eb] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Radius for controls that have no shell of their own — header nav items, text
 * buttons, links. The focus ring is a box-shadow tracing whatever radius the
 * element has, so a control left at 0 gets a hard-cornered rectangle while its
 * neighbours get rounded ones, and one left rounder than it looks gets a ring
 * drawn around a button that was never there.
 */
export const BARE_CONTROL = "rounded-[8px]";

/** Quiet button for row actions — comment, share. Reads as a control on hover. */
export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[14px] font-bold leading-[20px] text-[#6e6a72] transition-colors hover:bg-[#faf1e8] hover:text-[#1a1a1a]";

/**
 * `py-2.5` rather than `py-2`: a 20px line plus 16px of padding is a 36px
 * target, and chips are a phone control. 40px is the floor, so it belongs in
 * the token instead of being patched back on at each call site.
 */
export const CHIP =
  "inline-flex items-center rounded-full border border-[#e9e0d6] bg-white px-4 py-2.5 text-[14px] font-bold leading-[20px] text-[#fa3250] transition-colors hover:border-[#fa3250] hover:bg-[#fde8eb]";

/** Selected state of a CHIP — filled, matching the primary button. */
export const CHIP_ACTIVE =
  "inline-flex items-center rounded-full border border-[#fa3250] bg-[#fa3250] px-4 py-2.5 text-[14px] font-bold leading-[20px] text-white transition-colors hover:bg-[#d81f3c] hover:border-[#d81f3c]";

export const LINK = "font-bold text-[#fa3250] underline hover:text-[#d81f3c]";

/**
 * A link inside a list where every row already leads with one, and a rule under
 * each is stripe after stripe of underline rather than one thing to click.
 *
 * The trait comes back on hover, so the affordance is not spent — only moved to
 * the moment it is asked for. At rest the row still separates itself from its
 * own subtitle by weight and colour, not by colour alone.
 */
export const LINK_QUIET =
  "font-bold text-[#fa3250] no-underline hover:text-[#d81f3c] hover:underline";

/**
 * Errors sit in the same red family as the accent, a shade deeper. On their
 * site red is simply the loud colour; a separate error hue would be a fourth
 * red on the page rather than a clearer signal.
 */
export const ALERT =
  "rounded-[12px] border border-[#f8c9d0] bg-[#fdeaed] px-4 py-3 text-[15px] text-[#b3122c]";

/**
 * The card. A hairline border plus a whisper of shadow, rather than the heavy
 * 0.8px grey box: on a feed of thirty posts the border is what you notice, and
 * it should not be. White on the cream ground, so it lifts without a shadow
 * doing the work.
 */
export const CARD =
  "rounded-[16px] border border-[#e9e0d6] bg-white shadow-[0_1px_2px_rgba(26,26,26,0.04)]";

/** Same card, raised on hover — used where the whole card is a target. */
export const CARD_INTERACTIVE = `${CARD} transition-shadow hover:shadow-[0_4px_16px_rgba(26,26,26,0.08)]`;

export const MUTED = "text-[#6e6a72]";

/** Shared page rhythm. Route-level pages should differ in content, not in the
 * size, weight and breathing room of the frame around it. */
export const PAGE_SHELL = "flex min-h-screen flex-col bg-[#fef7f0] text-[#1a1a1a]";
export const PAGE_HERO_INNER = `${CONTAINER} py-7 md:py-9`;
export const PAGE_TITLE =
  "max-w-[900px] break-words text-[28px] font-bold leading-[35px] tracking-[-0.02em] md:text-[34px] md:leading-[42px]";
export const PAGE_INTRO = `mt-3 max-w-[720px] text-[16px] leading-[25px] ${MUTED}`;
export const PAGE_MAIN = `${CONTAINER} flex-1 py-7 md:py-9`;
export const SECTION_TITLE =
  "text-[22px] font-bold leading-[29px] tracking-[-0.01em] md:text-[26px] md:leading-[34px]";

/**
 * The rule a threaded reply hangs off. A shade darker than `line` (#e9e0d6),
 * because this one has a different job: a card border only ever sits on white,
 * while a thread line has to stay legible over the tint of an official answer
 * as well — and unlike a border it is carrying meaning, not just an edge.
 */
export const THREAD_LINE = "border-[#ddd2c5]";

/** The one band allowed to lift off the cream page: their pale butter. */
export const HERO_BAND = "border-b border-[#f2eadf] bg-[#fffbe5]";
