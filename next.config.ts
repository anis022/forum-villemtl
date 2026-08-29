import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Hides the dev-only route indicator in the bottom-left corner.
  devIndicators: false,
  experimental: {
    serverActions: {
      // A Server Action body is capped at 1 MB unless this says otherwise, and
      // the composer sends the photo inline with the form. So every phone
      // picture was refused with a 413 before `createIssue` ever ran: no row
      // written, and the generic error page instead of the "image too big"
      // message, because nothing in the action had a chance to return one.
      //
      // Kept above MAX_IMAGE_BYTES in app/actions/issues.ts, which is the size
      // the composer actually promises. The extra megabyte is for what
      // multipart/form-data adds around the file (boundaries, part headers,
      // and the other fields), so that a photo just under the limit is judged
      // by the action's message and not by the transport.
      bodySizeLimit: "6mb",
    },
  },
  images: {
    // Issue photos are served from the public Supabase storage bucket.
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing here is meant to be framed. Backing a topic, voting in a
          // poll and the moderation queue are all one click on a signed-in
          // session, which is exactly what a transparent frame over someone
          // else's page steals. frame-ancestors is the modern rule and
          // X-Frame-Options is what older browsers read.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },

          // Issue photos are uploaded by residents. Without this, a file
          // stored as an image but sniffed as HTML runs as a page on the
          // storage origin.
          { key: "X-Content-Type-Options", value: "nosniff" },

          // A topic URL carries its id, and the referrer follows the reader
          // to whatever they click next. Cross-origin gets the origin only.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // The location picker asks for a position, so geolocation stays
          // open to this origin. Nothing here has ever needed a camera or a
          // microphone, and saying so costs nothing.
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
