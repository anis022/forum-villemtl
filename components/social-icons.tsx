/** Monochrome brand marks for the footer's "Nous suivre" column. */

const base = { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": true } as const;

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

export function YouTubeIcon() {
  return (
    <svg {...base} fill="currentColor">
      <path d="M23 12s0-3.2-.41-4.73a3.01 3.01 0 0 0-2.12-2.12C18.94 4.74 12 4.74 12 4.74s-6.94 0-8.47.41A3.01 3.01 0 0 0 1.41 7.27C1 8.8 1 12 1 12s0 3.2.41 4.73a3.01 3.01 0 0 0 2.12 2.12c1.53.41 8.47.41 8.47.41s6.94 0 8.47-.41a3.01 3.01 0 0 0 2.12-2.12C23 15.2 23 12 23 12ZM9.79 15.3V8.7L15.5 12l-5.71 3.3Z" />
    </svg>
  );
}
