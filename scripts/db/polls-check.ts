/**
 * Exercise poll creation, first vote and vote switching in one transaction.
 * Everything is rolled back, including the temporary poll and its votes.
 */

import { Client } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env).");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const become = async (id: string, email: string) => {
  await client.query(
    "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
    [id, JSON.stringify({ sub: id, email, role: "authenticated" })],
  );
};

try {
  await client.query("begin");

  const staff = await client.query<{ id: string; email: string }>(
    `select u.id, lower(u.email) as email
       from auth.users u
       join public.profiles p on p.id = u.id and p.role = 'official'
       join public.staff s on s.email = lower(u.email) and s.active
      where u.email_confirmed_at is not null
      limit 1`,
  );
  if (!staff.rows[0]) throw new Error("aucun compte administrateur confirmé pour le test");

  const voter = await client.query<{ id: string; email: string }>(
    `select u.id, lower(u.email) as email
       from auth.users u
       join public.profiles p on p.id = u.id and p.role = 'citizen'
      where u.email_confirmed_at is not null
        and public.membership_status(lower(u.email)) = 'ok'
      limit 1`,
  );
  const voterAccount = voter.rows[0] ?? staff.rows[0];

  if (voter.rows[0]) {
    await become(voter.rows[0].id, voter.rows[0].email);
    await client.query("savepoint citizen_creation");
    let creationDenied = false;
    try {
      await client.query(
        "select public.create_poll($1, $2, $3::text[], $4, $5, $6, $7)",
        ["Un membre peut-il créer ceci?", "", ["Oui", "Non"], "choice", false, false, 1],
      );
    } catch {
      creationDenied = true;
    }
    await client.query("rollback to savepoint citizen_creation");
    if (!creationDenied) throw new Error("un compte citoyen a pu créer un sondage");
  }

  await become(staff.rows[0].id, staff.rows[0].email);
  const created = await client.query<{ id: string }>(
    "select public.create_poll($1, $2, $3::text[], $4, $5, $6, $7) as id",
    [
      "Quel projet devrait être priorisé?",
      "Sondage de vérification automatiquement annulé.",
      ["Le parc", "La bibliothèque", "La piste cyclable"],
      "choice",
      false,
      false,
      1,
    ],
  );
  const pollId = created.rows[0]?.id;
  if (!pollId) throw new Error("le sondage de vérification n'a pas été créé");

  const options = await client.query<{ id: string; vote_count: number }>(
    "select id, vote_count from public.poll_options where poll_id = $1 order by position",
    [pollId],
  );
  if (options.rows.length !== 3) throw new Error("les trois choix n'ont pas été créés");

  await become(voterAccount.id, voterAccount.email);
  await client.query("select public.cast_poll_vote($1, $2)", [pollId, options.rows[0].id]);
  await client.query("select public.cast_poll_vote($1, $2)", [pollId, options.rows[1].id]);

  const counts = await client.query<{ total_vote_count: number; counts: number[] }>(
    `select p.total_vote_count,
            array_agg(o.vote_count order by o.position)::integer[] as counts
       from public.polls p
       join public.poll_options o on o.poll_id = p.id
      where p.id = $1
      group by p.id`,
    [pollId],
  );
  const result = counts.rows[0];
  if (!result || result.total_vote_count !== 1 || result.counts.join(",") !== "0,1,0") {
    throw new Error(`compteurs inattendus: ${JSON.stringify(result)}`);
  }

  await become(staff.rows[0].id, staff.rows[0].email);
  const mapCreated = await client.query<{ id: string }>(
    "select public.create_poll($1, $2, $3::text[], $4, $5, $6, $7) as id",
    [
      "Où manque-t-il un banc public?",
      "Carte de vérification automatiquement annulée.",
      [],
      "map",
      true,
      true,
      3,
    ],
  );
  const mapPollId = mapCreated.rows[0]?.id;
  if (!mapPollId) throw new Error("le sondage cartographique n'a pas été créé");

  await become(voterAccount.id, voterAccount.email);
  await client.query(
    "select public.submit_poll_map_response($1, $2, $3, $4, $5)",
    [mapPollId, 45.475, -73.63, "Près de l'arrêt d'autobus", null],
  );
  await client.query(
    "select public.submit_poll_map_response($1, $2, $3, $4, $5)",
    [mapPollId, 45.48, -73.64, "À l'entrée du parc", null],
  );

  const mapCounts = await client.query<{ map_response_count: number; public_count: number }>(
    `select p.map_response_count,
            (select count(*)::integer
               from public.poll_map_responses_public r
              where r.poll_id = p.id) as public_count
       from public.polls p
      where p.id = $1`,
    [mapPollId],
  );
  if (
    mapCounts.rows[0]?.map_response_count !== 2 ||
    mapCounts.rows[0]?.public_count !== 2
  ) {
    throw new Error(`compteurs cartographiques inattendus: ${JSON.stringify(mapCounts.rows[0])}`);
  }

  console.log(
    "ok : création staff-only, vote modifiable, configuration carte et points citoyens",
  );
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
