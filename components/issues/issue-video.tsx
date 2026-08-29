"use client";

import { useState } from "react";

/**
 * A report's video.
 *
 * Shown whole, for the reason `IssuePhoto` is: somebody filmed the water coming
 * up over the curb and framed it that way on purpose. What it does not borrow
 * from the photo is the blurred backdrop behind the letterbox bars, which would
 * mean decoding a second copy of the file to fill the edges of the first. The
 * bars are dark instead, which is what every player people already use does.
 *
 * `preload="metadata"` is the important attribute here. A feed with three
 * videos on it must not pull three videos over somebody's data plan to show
 * three still frames, and without this some browsers will do exactly that.
 *
 * Nothing autoplays. A municipal forum is read in offices and on buses, and a
 * page that starts making noise on its own is a page people close.
 */
export function IssueVideo({
  src,
  /** Tailwind max-height for the box. Taller on the report's own page. */
  cap,
  label,
  unsupported,
  openLabel,
}: {
  src: string;
  cap: string;
  label: string;
  unsupported: string;
  openLabel: string;
}) {
  const [failed, setFailed] = useState(false);

  /*
   * An iPhone records .mov wrapping HEVC. Safari plays it; Chrome and Firefox
   * usually will not, and nothing on this site re-encodes it. A browser that
   * cannot decode the file fires `error` on the element and otherwise shows a
   * black rectangle with a crossed-out play button and no explanation.
   *
   * So the failure is caught and said out loud, with a link to the file itself:
   * the reader can hand it to something that does play it, which is a worse
   * outcome than inline playback and a much better one than a dead frame.
   */
  if (failed) {
    return (
      <div className="border-y border-[#f2ece4] bg-[#faf1e8] px-4 py-6 text-center">
        <p className="text-[15px] leading-[22px] text-[#5c5148]">{unsupported}</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[15px] font-bold text-[#a3162c] hover:underline"
        >
          {openLabel}
        </a>
      </div>
    );
  }

  return (
    <div className="border-y border-[#f2ece4] bg-[#1c1714]">
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={label}
        onError={() => setFailed(true)}
        className={`${cap} mx-auto w-full`}
      />
    </div>
  );
}
