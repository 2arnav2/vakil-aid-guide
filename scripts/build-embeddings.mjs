import fs from "node:fs";
import { pipeline, env } from "@xenova/transformers";

const MODEL = "Xenova/bge-small-en-v1.5";
const ACTS_PATH = "src/assets/acts.json";
const OUT_PATH = "src/assets/section-embeddings.json";

env.allowLocalModels = false;

const acts = JSON.parse(fs.readFileSync(ACTS_PATH, "utf8"));

const docText = (act) =>
  [
    `${act.act_name} Section ${act.section_number}: ${act.section_title}`,
    act.simplified_explanation,
    (act.keywords || []).join(", "),
  ]
    .filter(Boolean)
    .join(". ");

console.log(`Loading ${MODEL}…`);
const extractor = await pipeline("feature-extraction", MODEL, { quantized: true });

const ids = [];
const vectors = [];
const BATCH = 8;

for (let i = 0; i < acts.length; i += BATCH) {
  const batch = acts.slice(i, i + BATCH);
  const output = await extractor(batch.map(docText), {
    pooling: "mean",
    normalize: true,
  });
  const list = output.tolist();

  batch.forEach((act, j) => {
    ids.push(`${act.act_name}|${act.section_number}`);
    vectors.push(list[j].map((n) => Math.round(n * 1000) / 1000));
  });

  console.log(`Embedded ${Math.min(i + BATCH, acts.length)}/${acts.length}`);
}

const payload = {
  model: MODEL,
  dimensions: vectors[0]?.length ?? 0,
  generated_at: new Date().toISOString(),
  ids,
  vectors,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
console.log(`Wrote ${OUT_PATH} (${vectors.length} vectors, ${payload.dimensions} dims)`);
