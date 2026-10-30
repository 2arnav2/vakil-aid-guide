import actsData from "@/assets/acts.json";
import embeddingsData from "@/assets/section-embeddings.json";
import { ACCIDENT_IPC_SECTIONS, type Act } from "./search";

/**
 * Meaning-based section search.
 *
 * Why this exists:
 *   The rule engine only matches words that are hard-coded in search.ts.
 *   This module embeds every section and the user's sentence with a small
 *   sentence-transformer, then compares them by cosine similarity. That lets
 *   "the lorry rammed us" match "truck accident" even when no keyword matches.
 *
 * The section vectors are precomputed by scripts/build-embeddings.mjs, so at
 * runtime we only embed the user's sentence. The model itself (~23 MB) is
 * downloaded once on first use and cached by the browser.
 */

export const SEMANTIC_MODEL = "Xenova/bge-small-en-v1.5";

/** Below this cosine similarity we treat the result as "no real match". */
export const MIN_SEMANTIC_SIMILARITY = 0.45;

const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

export interface SemanticHit {
  act: Act;
  similarity: number;
}

export type SemanticDomain = "mva" | "ipc" | "it_act";

interface EmbeddingFile {
  model: string;
  ids: string[];
  vectors: number[][];
}

interface DocVectors {
  ids: string[];
  vectors: number[][];
}

type TensorLike = {
  tolist: () => number[][] | number[];
};

type Embedder = (
  texts: string | string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<TensorLike>;

const acts = actsData as Act[];
const bundled = embeddingsData as EmbeddingFile;

let embedderPromise: Promise<Embedder> | null = null;
let runtimeVectorsPromise: Promise<DocVectors> | null = null;

const sectionId = (act: Act): string => `${act.act_name}|${act.section_number}`;

const matchesDomain = (act: Act, domain?: SemanticDomain): boolean => {
  if (!domain) return true;
  if (domain === "mva") {
    return (
      act.act_name.includes("Motor") ||
      (act.act_name.includes("Penal") && ACCIDENT_IPC_SECTIONS.has(act.section_number))
    );
  }
  if (domain === "ipc") return act.act_name.includes("Penal");
  return act.act_name.includes("Information");
};

const docText = (act: Act): string =>
  [
    `${act.act_name} Section ${act.section_number}: ${act.section_title}`,
    act.simplified_explanation,
    (act.keywords ?? []).join(", "),
  ]
    .filter(Boolean)
    .join(". ");

const loadEmbedder = async (onProgress?: (message: string) => void): Promise<Embedder> => {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      onProgress?.("Loading the local semantic model (first time only)…");
      const { pipeline, env } = await import("@xenova/transformers");
      // Fetch the model from Hugging Face once; the browser caches it.
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      const pipe = await pipeline("feature-extraction", SEMANTIC_MODEL, { quantized: true });
      return pipe as unknown as Embedder;
    })().catch((error) => {
      embedderPromise = null;
      throw error;
    });
  }

  return embedderPromise;
};

const embed = async (texts: string[], onProgress?: (message: string) => void): Promise<number[][]> => {
  const embedder = await loadEmbedder(onProgress);
  const output = await embedder(texts, { pooling: "mean", normalize: true });
  const list = output.tolist();
  return Array.isArray(list[0]) ? (list as number[][]) : [list as number[]];
};

const dot = (a: number[], b: number[]): number => {
  let sum = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) sum += a[i] * b[i];
  return sum;
};

const rounded = (vector: number[]): number[] => vector.map((value) => Math.round(value * 1000) / 1000);

const readRuntimeCache = (): DocVectors | null => {
  try {
    const raw = localStorage.getItem("evakil.semantic.vectors.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { model?: string; ids?: string[]; vectors?: number[][] };
    if (parsed.model !== SEMANTIC_MODEL) return null;
    if (!Array.isArray(parsed.ids) || !Array.isArray(parsed.vectors)) return null;
    if (parsed.ids.length !== acts.length || parsed.vectors.length !== acts.length) return null;
    if (!parsed.ids.every((id, index) => id === sectionId(acts[index]))) return null;
    return { ids: parsed.ids, vectors: parsed.vectors };
  } catch {
    return null;
  }
};

const writeRuntimeCache = (docs: DocVectors): void => {
  try {
    localStorage.setItem("evakil.semantic.vectors.v1", JSON.stringify({ model: SEMANTIC_MODEL, ...docs }));
  } catch {
    // localStorage can be full or disabled; the in-memory copy still works.
  }
};

const computeRuntimeVectors = async (onProgress?: (message: string) => void): Promise<DocVectors> => {
  const ids: string[] = [];
  const vectors: number[][] = [];
  const batchSize = 8;

  for (let index = 0; index < acts.length; index += batchSize) {
    const batch = acts.slice(index, index + batchSize);
    onProgress?.(`Building the semantic index… ${Math.min(index + batchSize, acts.length)}/${acts.length}`);
    const batchVectors = await embed(batch.map(docText), onProgress);
    batch.forEach((act, offset) => {
      ids.push(sectionId(act));
      vectors.push(rounded(batchVectors[offset]));
    });
  }

  const docs = { ids, vectors };
  writeRuntimeCache(docs);
  return docs;
};

const bundledIsValid = (): boolean =>
  bundled.model === SEMANTIC_MODEL &&
  Array.isArray(bundled.ids) &&
  Array.isArray(bundled.vectors) &&
  bundled.ids.length === acts.length &&
  bundled.vectors.length === acts.length &&
  bundled.ids.every((id, index) => id === sectionId(acts[index]));

const getDocVectors = async (onProgress?: (message: string) => void): Promise<DocVectors> => {
  if (bundledIsValid()) {
    return { ids: bundled.ids, vectors: bundled.vectors };
  }

  if (!runtimeVectorsPromise) {
    runtimeVectorsPromise = (async () => {
      const cached = readRuntimeCache();
      if (cached) return cached;
      return computeRuntimeVectors(onProgress);
    })().catch((error) => {
      runtimeVectorsPromise = null;
      throw error;
    });
  }

  return runtimeVectorsPromise;
};

/**
 * Returns the sections whose meaning is closest to the query.
 * Throws if the embedding model cannot be loaded (offline first run, etc.);
 * the caller should then fall back to the rule engine.
 */
export const semanticSearch = async (
  query: string,
  topK = 6,
  onProgress?: (message: string) => void,
  domain?: SemanticDomain,
): Promise<SemanticHit[]> => {
  const [queryVector] = await embed([QUERY_PREFIX + query], onProgress);
  const docs = await getDocVectors(onProgress);
  const byId = new Map(acts.map((act) => [sectionId(act), act]));

  onProgress?.("Comparing the meaning of your description…");

  const seen = new Set<string>();

  return docs.ids
    .map((id, index) => {
      const act = byId.get(id);
      if (!act || !matchesDomain(act, domain)) return null;
      return { act, similarity: dot(queryVector, docs.vectors[index]) };
    })
    .filter((hit): hit is SemanticHit => Boolean(hit))
    .sort((a, b) => b.similarity - a.similarity)
    .filter((hit) => {
      const key = `${hit.act.act_name}|${hit.act.section_number}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, topK);
};
