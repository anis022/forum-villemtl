/**
 * The masthead's "Recherche" control and the forum's search field live in two
 * different trees — the header is on every page, the field belongs to the feed
 * — so they talk over the window rather than through a context provider
 * wrapping the entire site for the sake of one button.
 *
 * Plain constants, no "use client": both sides import this, and the header
 * should not pull the search field into its bundle to learn an event name.
 */

/** Header → field: show yourself, or hide again if you already are. */
export const SEARCH_TOGGLE = "forum-search:toggle";

/** Field → header: `detail.open`, so the control can report `aria-expanded`. */
export const SEARCH_STATE = "forum-search:state";

/** Marks the field's wrapper, so the header can tell this page has one. */
export const SEARCH_PANEL_ID = "forum-search-panel";

/**
 * Asks the forum to open its field on arrival. The search only exists on the
 * feed, so the control on every other page is a navigation that carries the
 * request with it — as a parameter rather than a hash, so the server renders
 * the field already unfolded instead of the page shifting once React arrives.
 * It falls out of the URL again the moment anything is typed.
 */
export const SEARCH_PARAM = "recherche";
