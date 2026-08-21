import sharp from "sharp";

type WebpOptions = {
  /** Longest output edge. Large originals are reduced without being cropped. */
  maxDimension?: number;
  quality?: number;
};

/**
 * Decode an uploaded photograph, apply its EXIF orientation, remove embedded
 * metadata, constrain oversized originals and encode one predictable WebP.
 *
 * This runs on the server for every upload path. A custom client or a renamed
 * file therefore cannot bypass the conversion, and storage never receives the
 * original JPEG/PNG payload.
 */
export async function imageFileToWebp(
  file: File,
  { maxDimension = 2400, quality = 78 }: WebpOptions = {},
): Promise<Buffer> {
  const input = Buffer.from(await file.arrayBuffer());

  const encode = (outputQuality: number) =>
    sharp(input, {
      failOn: "error",
      // Enough for current high-resolution phone cameras, while refusing images
      // whose decoded size would be unreasonable for a five-megabyte upload.
      limitInputPixels: 100_000_000,
    })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: outputQuality,
        alphaQuality: 85,
        effort: 5,
        smartSubsample: true,
      })
      .toBuffer();

  let output = await encode(quality);

  // A very aggressively compressed JPEG can occasionally beat a high-quality
  // WebP. In that case make one measured second pass so "optimization" never
  // stores a larger replacement. An original WebP may be kept as-is because it
  // already has the required format.
  if (output.length >= input.length) {
    if (file.type === "image/webp") return input;
    output = await encode(Math.max(60, quality - 10));
  }

  return output;
}
