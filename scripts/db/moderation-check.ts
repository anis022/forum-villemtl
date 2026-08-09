/**
 * Read the lexicon back to yourself.
 *
 *   npm run moderation:check
 *
 * `public.moderation_score` decides, in Postgres, whether a message is refused,
 * queued for an elected official, or left alone. Weights in that table are meant
 * to be tuned — which is exactly why the tuning needs somewhere to land: change
 * one number and this says which of these sentences changed side.
 *
 * Half the cases below are ordinary complaints about potholes and delays, and
 * they are the important half. A matcher that flags a resident for writing
 * "c'est de la merde, cette ruelle" teaches everybody to write to the machine
 * instead of to their neighbours, and no amount of catching real abuse pays for
 * that. The French words that mean something harmless — retard, conseil,
 * contrat, connaître, cool — are here to stay clear, permanently.
 */

import { Client } from "pg";

type Verdict = "clear" | "flag" | "block";

const cases: [Verdict, string][] = [
  // Ordinary civic speech. All of this has to get through untouched.
  ["clear", "Le nid-de-poule sur Monkland est dangereux depuis trois mois."],
  ["clear", "Les travaux ont du retard, et le retard est inacceptable."],
  ["clear", "Le conseil d'arrondissement a signé un contrat sans nous consulter."],
  ["clear", "Il faut connaître le dossier avant de commenter."],
  ["clear", "C'est de la merde, cette ruelle. Personne ne l'entretient."],
  ["clear", "Franchement c'est idiot comme règlement."],
  ["clear", "Crisse que c'est long, ces travaux."],
  ["clear", "LES TRAVAUX SUR SHERBROOKE DURENT DEPUIS DIX-HUIT MOIS MAINTENANT"],
  ["clear", "La piste cyclable est cool et bien entretenue."],
  ["clear", "Bonne nouvelle pour la bibliothèque de Côte-des-Neiges."],

  // Aimed at a person. Queued for a human, not refused.
  ["flag", "Le conseiller est un connard fini."],
  ["flag", "Ta gueule avec tes histoires de stationnement."],
  ["flag", "You are such an asshole about this."],
  ["flag", "Retourne dans ton pays si t'es pas content."],

  // Refused outright.
  ["block", "Espèce de connard, tu es un abruti."],
  ["block", "Je vais te tuer si tu reviens ici."],
  ["block", "kill yourself"],
  ["block", "Sale pédé, dégage."],

  // Folding: digit substitutions and stretched letters.
  ["block", "esp3ce de c0nnard, espèce d'abruti"],
  ["flag", "quel connnnnnard celui-là"],
];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env).");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

let failures = 0;
try {
  for (const [expected, text] of cases) {
    const { rows } = await client.query<{
      score: string;
      verdict: Verdict;
      terms: string[];
    }>("select score, verdict, terms from public.moderation_score($1)", [text]);

    const got = rows[0];
    const ok = got.verdict === expected;
    if (!ok) failures++;

    console.log(
      [
        ok ? "ok  " : "ECHEC",
        expected.padEnd(5),
        `${got.verdict}`.padEnd(5),
        `${got.score}`.padEnd(5),
        JSON.stringify(got.terms).padEnd(24),
        text.slice(0, 50),
      ].join(" "),
    );
  }
} finally {
  await client.end();
}

console.log(failures === 0 ? `\n${cases.length} cas, tous conformes` : `\n${failures} echec(s)`);
if (failures > 0) process.exitCode = 1;
