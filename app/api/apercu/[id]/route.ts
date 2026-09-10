import sharp from "sharp";
import { getIssue } from "@/utils/supabase/issues";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** What every scraper lays out for, so the card is never letterboxed twice. */
const WIDTH = 1200;
const HEIGHT = 630;

/** The backdrop is blurred past recognition, so it is enlarged from a thumbnail. */
const BACKDROP_WIDTH = 120;
const BACKDROP_HEIGHT = 63;

/**
 * The topic's photograph, rendered as the picture that shows up when somebody
 * pastes the link into a conversation.
 *
 * The stored file cannot be linked directly. Every upload is converted to WebP
 * (`utils/server-image.ts`), and WhatsApp and LinkedIn draw no preview at all
 * for a WebP `og:image`. The link arrives as a bare card, which is the thing
 * the photograph was supposed to fix. So it is re-encoded here as a JPEG at the
 * one size those cards are built around.
 *
 * The photo is never cropped to fill that box, for the reason `IssuePhoto`
 * never crops it: somebody framed the flooded curb the way they framed it, and
 * a centre band of a portrait photograph proves nothing. Anything that does not
 * fit the box is letterboxed over a blurred, veiled copy of itself, which is
 * what the photo looks like on the site and what a reader on Facebook or Reddit
 * already reads as a photograph rather than as a gap.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const issue = await getIssue(id);
  // No photograph, a video, or no such topic: the metadata only points here
  // when there is a photo, so this is a stale or hand-typed URL either way.
  if (!issue?.imageUrl) return new Response(null, { status: 404 });

  // A demonstration topic carries a path under `public/` rather than a stored
  // upload, so it has to be asked for from this site rather than from storage.
  // From this deployment specifically, not from the canonical origin: on a
  // preview build the file being previewed is the one served here.
  const source = issue.imageUrl.startsWith("/")
    ? new URL(issue.imageUrl, request.url).toString()
    : issue.imageUrl;

  let card: Buffer;
  try {
    const response = await fetch(source);
    if (!response.ok) return new Response(null, { status: 404 });
    const original = Buffer.from(await response.arrayBuffer());

    const photo = await sharp(original)
      .resize({ width: WIDTH, height: HEIGHT, fit: "inside" })
      .toBuffer();

    // Two passes, not one chain: sharp honours only the last `resize` in a
    // pipeline, and a single chain would hand back the whole photo squashed
    // into the box rather than a crop of its middle blown up.
    const thumbnail = await sharp(original)
      .resize({ width: BACKDROP_WIDTH, height: BACKDROP_HEIGHT, fit: "cover" })
      .toBuffer();

    // Sharp blurs after it resizes whatever the order of the calls, so this
    // radius is the one applied to the full-size backdrop. Heavy on purpose:
    // anything the eye can still read back there competes with the photograph.
    const backdrop = await sharp(thumbnail)
      .resize({ width: WIDTH, height: HEIGHT, fit: "fill" })
      .blur(24)
      .toBuffer();

    card = await sharp(backdrop)
      .composite([
        // The same white veil the page puts over its bars: without it a
        // saturated backdrop competes with the photograph in front of it.
        {
          input: {
            create: {
              width: WIDTH,
              height: HEIGHT,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 0.15 },
            },
          },
          blend: "over",
        },
        { input: photo, gravity: "center" },
      ])
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();
  } catch {
    // A file that will not decode is not worth a 500 on somebody's paste of a
    // link: the card falls back to the title and the description.
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(card), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(card.length),
      // Scrapers re-fetch this far more often than an edit changes the photo,
      // and every one of them keeps its own copy for much longer than a day.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
