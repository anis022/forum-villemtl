import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { projectBySlug } from "@/utils/supabase/projects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE = "emtl_visitor";
const YEAR = 60 * 60 * 24 * 365;
const payload = z.object({
  contentType: z.enum(["event", "project"]),
  contentId: z.string().trim().min(1).max(200),
});

/**
 * Record one intentional content opening without building a browsing profile.
 *
 * The random cookie never leaves this route. Postgres receives only an HMAC,
 * stores no IP address or user agent, and its unique key collapses repeated
 * openings of the same item on the same UTC day.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 512) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let parsed: z.infer<typeof payload>;
  try {
    parsed = payload.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new NextResponse(null, { status: 204 });

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Both live in Supabase now. Validate either before recording, otherwise
  // arbitrary strings could pollute the rank.
  if (parsed.contentType === "project") {
    if (!(await projectBySlug(parsed.contentId))) {
      return NextResponse.json({ error: "unknown content" }, { status: 404 });
    }
  } else {
    const { data, error } = await supabase
      .from("borough_events")
      .select("id")
      .eq("id", parsed.contentId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "unknown content" }, { status: 404 });
    }
  }

  const existing = request.cookies.get(COOKIE)?.value;
  const visitor = existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : randomUUID();
  const viewerHash = createHmac("sha256", key).update(visitor).digest("hex");

  const { error } = await supabase.rpc("record_content_view", {
    p_viewer_hash: viewerHash,
    p_content_type: parsed.contentType,
    p_content_id: parsed.contentId,
  });

  // A deployment whose migration has not landed yet should never block the
  // destination the person asked to read. Tracking is deliberately best-effort.
  const response = new NextResponse(null, { status: error ? 204 : 201 });
  if (!existing) {
    response.cookies.set(COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: YEAR,
    });
  }
  return response;
}
