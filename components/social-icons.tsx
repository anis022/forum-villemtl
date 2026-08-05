/** Monochrome brand marks for the footer's "Nous suivre" column. */

// `shrink-0` because each mark sits in a flex row beside its label: without it
// the glyph is what gives way when the row runs out of width, and a squashed
// logo reads as a rendering fault rather than as a tight fit.
const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  className: "shrink-0",
  "aria-hidden": true,
} as const;

export function FacebookIcon() {
  return (
    <svg {...base} fill="currentColor">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

export function InstagramIcon() {
  return (
    <svg {...base} fill="none">
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.25" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg {...base} fill="currentColor">
      <path d="M18.9 2H22l-7.1 8.1L23.2 22h-6.55l-5.13-6.71L5.6 22H2.5l7.6-8.68L1.5 2h6.72l4.63 6.12L18.9 2Zm-1.09 18.06h1.72L7.26 3.84H5.42l12.39 16.22Z" />
    </svg>
  );
}

/** The Octocat mark, for the footer's source-code link. */
export function GitHubIcon() {
  return (
    <svg {...base} fill="currentColor">
      <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.53.1.72-.23.72-.5v-1.8c-2.92.64-3.54-1.25-3.54-1.25-.48-1.21-1.17-1.54-1.17-1.54-.95-.65.07-.64.07-.64 1.06.08 1.61 1.09 1.61 1.09.94 1.61 2.47 1.15 3.07.88.1-.68.37-1.15.67-1.41-2.33-.27-4.78-1.17-4.78-5.19 0-1.15.41-2.08 1.09-2.82-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.89 1.08a10 10 0 0 1 5.26 0c2-1.36 2.88-1.08 2.88-1.08.57 1.45.21 2.52.11 2.79.68.74 1.09 1.67 1.09 2.82 0 4.03-2.46 4.92-4.8 5.18.38.33.71.97.71 1.96v2.9c0 .28.19.61.72.51A10.5 10.5 0 0 0 12 1.5Z" />
    </svg>
  );
}

export function YouTubeIcon() {
  return (
    <svg {...base} fill="currentColor">
      <path d="M23 12s0-3.2-.41-4.73a3.01 3.01 0 0 0-2.12-2.12C18.94 4.74 12 4.74 12 4.74s-6.94 0-8.47.41A3.01 3.01 0 0 0 1.41 7.27C1 8.8 1 12 1 12s0 3.2.41 4.73a3.01 3.01 0 0 0 2.12 2.12c1.53.41 8.47.41 8.47.41s6.94 0 8.47-.41a3.01 3.01 0 0 0 2.12-2.12C23 15.2 23 12 23 12ZM9.79 15.3V8.7L15.5 12l-5.71 3.3Z" />
    </svg>
  );
}
