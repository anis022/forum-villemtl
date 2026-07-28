/**
 * Decide the embedding model empirically before the schema commits to a vector
 * dimension — changing it later means re-embedding the whole corpus.
 *
 * Two things are being measured, and the second matters more than the first:
 *   1. cold-load + per-query latency, since this model has to run inside the
 *      Vercel function on every search;
 *   2. cross-lingual retrieval, because council transcripts switch between
 *      French and English mid-sentence.
 *
 * e5 models require "query: " / "passage: " prefixes. Omitting them silently
 * degrades results rather than erroring, so they are applied here exactly as
 * the ingestion pipeline will apply them.
 */

import { pipeline } from "@huggingface/transformers";

const MODELS = ["Xenova/multilingual-e5-small", "Xenova/multilingual-e5-base"];

// Wording taken from the real transcript, not invented.
const passages = [
  "une résidente déplore que la piste cyclable de la rue Terrebonne ait été retirée et demande son retour",
  "the snow removal operations on Côte-des-Neiges were delayed after the last storm",
  "le budget de l'arrondissement pour le déneigement a augmenté de douze pour cent cette année",
  "we are also working right now on the plan d'urbanisme mobilité for the next until 2050 and there is suggestion regarding other tram lines",
];
const queries = [
  "qu'est-ce qui s'est dit sur les pistes cyclables ?",
  "what did they say about snow clearing?",
  "projets de tramway",
];

const cos = (a: number[], b: number[]) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d; // vectors are normalized below
};

for (const model of MODELS) {
  const t0 = Date.now();
  const extract = await pipeline("feature-extraction", model, { dtype: "q8" });
  const loadMs = Date.now() - t0;

  const embed = async (texts: string[]) => {
    const out = await extract(texts, { pooling: "mean", normalize: true });
    return out.tolist() as number[][];
  };

  const P = await embed(passages.map((p) => `passage: ${p}`));

  const t1 = Date.now();
  const Q = await embed(queries.map((q) => `query: ${q}`));
  const queryMs = (Date.now() - t1) / queries.length;

  console.log(`\n=== ${model} — ${P[0].length} dims ===`);
  console.log(`chargement a froid : ${loadMs} ms | par requete : ${queryMs.toFixed(0)} ms`);
  queries.forEach((q, qi) => {
    const best = P.map((v, pi) => ({ pi, s: cos(Q[qi], v) })).sort((a, b) => b.s - a.s);
    console.log(`  Q: ${q}`);
    best.slice(0, 2).forEach(({ pi, s }) =>
      console.log(`     ${s.toFixed(3)}  ${passages[pi].slice(0, 64)}…`),
    );
  });
}
