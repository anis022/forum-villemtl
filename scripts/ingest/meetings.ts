/**
 * The council meetings known to be ingestible.
 *
 * Sourced from the channel's /streams tab — recent sittings are livestreamed,
 * so they do not appear under /videos. Dates come from the video title, or
 * from the description when the title carries none; none are inferred.
 *
 * Scoped to 2026: these are the sittings whose recordings we transcribe
 * ourselves and whose proces-verbaux we parse, so they are the only ones an
 * answer can cite down to the second.
 *
 * Excluded on purpose:
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
  // Carried no caption track of any kind, which is why it used to sit in the
  // excluded list. Transcription no longer depends on YouTube publishing one.
  { youtubeId: "zN9WIzrj5C0", date: "2026-03-09", title: "Séance ordinaire du conseil d'arrondissement — 9 mars 2026" },
  { youtubeId: "eAdQaeKWXxE", date: "2026-02-02", title: "Séance ordinaire du conseil d'arrondissement — 2 février 2026" },
];
