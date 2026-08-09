import Image from "next/image";

/**
 * A report's photo, shown whole.
 *
 * The photo is evidence, not decoration — someone attached it to show you the
 * pothole. So it is never cropped: `object-cover` on a feed of mixed shapes
 * takes a phone-held portrait of a dark underpass and shows you a band from its
 * middle, which is the part that proves nothing. A resident who framed the
 * broken slab with the curb in it framed it that way on purpose.
 *
 * Showing it whole means letterboxing anything taller than the box, and empty
 * grey bars either side of a narrow strip look like a bug. So the bars are
 * filled the way Reddit and Facebook fill them: the same image behind, blown
 * up, blurred and veiled. It reads as the photo's own light spilling out rather
 * than as a gap, and it costs one extra request for a 32px thumbnail.
 *
 * A landscape photo gets no bars at all — the box takes its height from the
 * image and only tall ones ever reach the cap.
 */
export function IssuePhoto({
  src,
  alt,
  /** Tailwind max-height for the box. Taller on the report's own page. */
  cap,
  /** What width the foreground will be asked to render at, for the srcset. */
  sizes,
}: {
  src: string;
  alt: string;
  cap: string;
  sizes: string;
}) {
  return (
    <div className="relative overflow-hidden border-y border-[#eef2f0] bg-[#f2f6f4]">
      {/* Decorative, and already on screen in full beside it: hidden from
          assistive technology so a screen reader is not handed the same
          photo twice. `sizes` keeps it to a thumbnail — at this blur radius
          nothing larger would survive to be seen. */}
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        sizes="32px"
        className="scale-110 object-cover blur-2xl"
      />
      {/* Quiet enough that the photo stays the subject: without it a saturated
          background competes with the thing it is a backdrop for. Light, not
          opaque — much past this and the bars go flat grey, which is the dead
          gap the backdrop exists to avoid. */}
      <div aria-hidden="true" className="absolute inset-0 bg-white/15" />

      {/* `w-full` with the cap as a max-height, so the box is the image's own
          shape until the image is taller than the cap and only then letterboxes. */}
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={800}
        sizes={sizes}
        className={`relative ${cap} w-full object-contain`}
      />
    </div>
  );
}
