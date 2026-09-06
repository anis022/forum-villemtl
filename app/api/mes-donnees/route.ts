import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Everything the forum holds about the person asking, as one JSON file.
 *
 * A route handler rather than a server action, because the answer is a download
 * and an action returns a value. `Content-Disposition` is what turns it into a
 * file the browser saves instead of a wall of braces in a tab.
 *
 * Read with the caller's own session, so RLS decides what comes back and this
 * cannot be turned into a way to read somebody else's account by changing an
 * id — there is no id to change.
 *
 * The format is the one the law asks for and the one a person can actually use:
 * structured, commonly used, and readable without our software. Column names
 * are the ones a resident would recognise rather than the ones the database
 * uses, since the point is that they can read it.
 */
export async function GET() {
  const supabase = createClient(await cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "not_signed_in" }, { status: 401 });
  }

  const [profile, issues, comments, votes, polls, pollVotes, mapResponses, flags] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, role, avatar_url, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("issues")
      .select("id, title, body, category, status, lat, lon, image_path, created_at")
      .eq("author_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("comments")
      .select("id, issue_id, body, is_official, created_at")
      .eq("author_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("votes")
      .select("issue_id")
      .eq("user_id", user.id),
    // `question` and `description` were dropped by migration 0036, when a poll
    // became a ballot hanging off an ordinary topic. Asking for them here did
    // not fail loudly: PostgREST refused the whole select, the `?? []` below
    // turned that into an empty list, and every export since has told its
    // reader they had created no polls. The wording now comes back with the
    // topic, under `signalements`, and `sujet` is the link between the two.
    supabase
      .from("polls")
      .select("id, issue_id, kind, total_vote_count, map_response_count, created_at")
      .eq("author_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("poll_votes")
      .select("poll_id, option_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("poll_map_responses")
      .select("id, poll_id, lat, lon, description, image_path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    // Returns nothing for a resident — the SELECT policy on this table is
    // officials-only. Asked for anyway rather than skipped: an official
    // exporting their own account should get their own dismissals, and leaving
    // the key out entirely would read as "there is no such thing".
    supabase
      .from("moderation_flags")
      .select("id, score, created_at, cleared_at")
      .eq("cleared_by", user.id),
  ]);

  /**
   * A section that could not be read says so.
   *
   * Every list below ends in `?? []`, which cannot tell "you have none of
   * these" apart from "this query failed". That is the wrong way round for an
   * export a person is entitled to: a silent empty list reads as an answer, and
   * this file is the answer. Naming the failures keeps the export honest and
   * makes the next schema drift visible on the first download instead of never.
   */
  const failed = Object.entries({
    profil: profile.error,
    signalements: issues.error,
    reponses: comments.error,
    appuis: votes.error,
    sondages_crees: polls.error,
    votes_aux_sondages: pollVotes.error,
    points_ajoutes_aux_sondages: mapResponses.error,
    moderation_traitee_par_vous: flags.error,
  })
    .filter(([, error]) => error)
    .map(([section, error]) => `${section}: ${error!.message}`);

  const body = {
    exported_at: new Date().toISOString(),
    ...(failed.length > 0
      ? {
          sections_illisibles: failed,
          avertissement:
            "Une ou plusieurs sections n'ont pas pu être lues et sont vides ci-dessous." +
            " Signalez-le : l'export est incomplet.",
        }
      : {}),
    about:
      "Renseignements détenus par le forum de Côte-des-Neiges–Notre-Dame-de-Grâce" +
      " sur le compte identifié ci-dessous. Voir /fr/confidentialite.",
    compte: {
      identifiant: user.id,
      courriel: user.email ?? null,
      inscrit_le: user.created_at ?? null,
      derniere_connexion: user.last_sign_in_at ?? null,
    },
    profil: profile.data ?? null,
    signalements: issues.data ?? [],
    reponses: comments.data ?? [],
    appuis: (votes.data ?? []).map((v) => v.issue_id),
    sondages_crees: polls.data ?? [],
    votes_aux_sondages: pollVotes.data ?? [],
    points_ajoutes_aux_sondages: mapResponses.data ?? [],
    moderation_traitee_par_vous: flags.data ?? [],
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mes-donnees-${stamp}.json"`,
      // Nothing about this is cacheable, anywhere, ever.
      "cache-control": "no-store",
    },
  });
}
