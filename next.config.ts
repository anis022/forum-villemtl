import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Hides the dev-only route indicator in the bottom-left corner.
  devIndicators: false,
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
