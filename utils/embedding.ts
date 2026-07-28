/**
 * The embedding model, shared by ingestion and by query time.
 *
 * These must never diverge: vectors produced by different models — or by the
 * same model with different prefixes — are not comparable, and the failure is
 * silent. Search simply returns nonsense rather than erroring. Hence one
 * module, imported by both the ingestion script and the search route.
 *
 * Runs locally via ONNX, so search costs nothing to operate. Measured on the
 * real corpus: ~1.1 s to load from disk, ~11 ms per query afterwards.
 */

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/multilingual-e5-base";

/** Must match the vector(768) columns in migration 0006. */
export const EMBEDDING_DIMS = 768;

let extractor: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Loaded once per process. On Fluid Compute the instance is reused across
 * requests, so the load cost is paid on cold start only.
 */
function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractor ??= pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });
  return extractor;
}

async function embed(texts: string[]): Promise<number[][]> {
  const extract = await getExtractor();
  const out = await extract(texts, { pooling: "mean", normalize: true });
  return out.tolist() as number[][];
}

/**
 * e5 is asymmetric: it expects "passage: " on indexed text and "query: " on
 * searches. Dropping the prefixes degrades retrieval measurably without any
 * error, which is why they are applied here and nowhere else.
 */
export function embedPassages(texts: string[]): Promise<number[][]> {
  return embed(texts.map((t) => `passage: ${t}`));
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embed([`query: ${text}`]);
  return v;
}

/** pgvector accepts its literal form, not a JSON array. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
