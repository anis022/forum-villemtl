/**
 * Feed the real tool output to the real prompt and read what comes back.
 *
 *   npm run prompt:test                    # deneigement
 *   npm run prompt:test -- stationnement
 *
 * The chat route requires a signed-in member, so there is no longer any way to
 * try a wording change against the live corpus through a browser without being
 * one. This is that way: same system prompt, read straight out of the source,
 * same rows out of the same RPC, one model call.
 *
 * The one thing it does NOT share with the route is the shape of the tool
 * result, which is rebuilt below. Keep the two in step when the tool changes —
 * particularly `commencer_par`, which is what decides the order of the answer.
 * A drift here shows up as this harness passing while the site does not.
 *
 * It spends the free Mistral allowance, so run it a few times, not a hundred.
 */
import { Client } from "pg";
import { generateText } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { readFileSync } from "node:fs";

/* The prompt is read out of the source rather than imported: council-agent.ts
   resolves through the `@/` alias, which only the Next bundler provides. Same
   single source of truth, no second copy to drift. */
const AGENT = readFileSync("utils/council-agent.ts", "utf8");
const COUNCIL_SYSTEM_PROMPT = AGENT.slice(
  AGENT.indexOf("COUNCIL_SYSTEM_PROMPT = `") + "COUNCIL_SYSTEM_PROMPT = `".length,
).split("`;")[0];
import { expandQuery } from "../../utils/council-terms.ts";

const term = process.argv[2] ?? "déneigement";
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const expanded = expandQuery(term);
const { rows } = await c.query(
  "select name, subject, to_char(meeting_date,'YYYY-MM-DD') d, lexical, heard from search_council_questions($1,null,null,null,null,8)",
  [expanded],
);
await c.end();

const counted = rows.filter((r) => r.lexical);
const heard = rows.filter((r) => r.heard);
let n = 0;
const lead =
  counted.length > 0
    ? `${new Set(counted.map((r) => r.name)).size} personne(s) ont fait inscrire ce sujet au procès-verbal. Commence par ce chiffre, nomme-les avec leurs dates, puis donne les entendus dans une phrase à part.`
    : heard.length > 0
      ? `Personne n'a fait inscrire ce sujet au procès-verbal, mais il revient ${heard.length} fois dans les enregistrements. Ouvre sur ces ${heard.length} fois. N'ouvre pas sur l'absence : « Aucune personne… » en tête de réponse est interdit ici, l'absence vient après, dans la phrase suivante.`
      : "Rien dans les archives là-dessus. Dis-le franchement, en une phrase.";

const result = {
  commencer_par: lead,
  recherche: expanded,
  total_comptes: counted.length,
  personnes_distinctes: new Set(counted.map((r) => r.name)).size,
  seances_distinctes: new Set(counted.map((r) => r.d)).size,
  total_entendus: heard.length,
  personnes_entendues: new Set(heard.map((r) => r.name)).size,
  seances_entendues: new Set(heard.map((r) => r.d)).size,
  comptes: counted.map((r) => ({ source: ++n, personne: r.name, date: r.d, sujet: r.subject })),
  entendus: heard.map((r) => ({ source: ++n, personne_au_micro_a_ce_moment: r.name, date: r.d, sujet_inscrit: r.subject })),
  rapprochees: [],
};

console.log(`comptes=${result.total_comptes}  entendus=${result.total_entendus}  personnes_entendues=${result.personnes_entendues}  seances_entendues=${result.seances_entendues}\n`);

const out = await generateText({
  model: mistral(process.env.COUNCIL_MISTRAL_MODEL_ID ?? "mistral-medium-latest"),
  system: COUNCIL_SYSTEM_PROMPT,
  messages: [
    { role: "user", content: `Combien de personnes ont parlé de ${term} ?` },
    { role: "assistant", content: [{ type: "tool-call", toolCallId: "t1", toolName: "chercher_questions_du_public", input: { sujet: term } }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: "t1", toolName: "chercher_questions_du_public", output: { type: "json", value: result } }] },
  ],
  maxRetries: 0,
});
console.log(out.text);
