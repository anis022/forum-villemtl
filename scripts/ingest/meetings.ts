/**
 * The council meetings known to be ingestible.
 *
 * Sourced from the channel's /streams tab — recent sittings are livestreamed,
 * so they do not appear under /videos. Dates come from the video title, or
 * from the description when the title carries none; none are inferred.
 *
 * Excluded on purpose:
 *   zN9WIzrj5C0  9 mar 2026  — no caption track of any kind
 *   ocpBhVKogeY  2 feb 2026  — 5-minute aborted stream (real one: eAdQaeKWXxE)
 *   dwtuiT2irT4  2 feb 2026  — 1-minute duplicate
 */

export type MeetingSeed = {
  youtubeId: string;
  /** ISO date of the sitting itself, not of the upload. */
  date: string;
  title: string;
};

export const MEETINGS: MeetingSeed[] = [
  { youtubeId: "RGOnvurDyxs", date: "2026-07-06", title: "Séance ordinaire du conseil d'arrondissement — 6 juillet 2026" },
  { youtubeId: "Jo73VwX55zQ", date: "2026-06-01", title: "Séance ordinaire du conseil d'arrondissement — 1er juin 2026" },
  { youtubeId: "bjBQBY3Mvjo", date: "2026-05-04", title: "Séance ordinaire du conseil d'arrondissement — 4 mai 2026" },
  { youtubeId: "jQoMGEnaZaw", date: "2026-04-13", title: "Séance ordinaire du conseil d'arrondissement — 13 avril 2026" },
  { youtubeId: "eAdQaeKWXxE", date: "2026-02-02", title: "Séance ordinaire du conseil d'arrondissement — 2 février 2026" },
  { youtubeId: "niHU4GMRyg8", date: "2025-12-08", title: "Séance ordinaire du conseil d'arrondissement — 8 décembre 2025" },
  { youtubeId: "gdUFR41SvLY", date: "2025-11-26", title: "Séance du conseil d'arrondissement — 26 novembre 2025" },
  { youtubeId: "Hdx4R5PPMjM", date: "2025-11-17", title: "Séance extraordinaire du conseil d'arrondissement — 17 novembre 2025" },
  { youtubeId: "htykOiQE4ME", date: "2025-09-02", title: "Séance ordinaire du conseil d'arrondissement — 2 septembre 2025" },
  { youtubeId: "-tEJiepqszQ", date: "2025-08-04", title: "Séance ordinaire du conseil d'arrondissement — 4 août 2025" },
  { youtubeId: "aUHqg22me5U", date: "2025-07-07", title: "Séance ordinaire du conseil d'arrondissement — 7 juillet 2025" },
  { youtubeId: "VUcqfnk-iUo", date: "2025-06-09", title: "Séance ordinaire du conseil d'arrondissement — 9 juin 2025" },
];
