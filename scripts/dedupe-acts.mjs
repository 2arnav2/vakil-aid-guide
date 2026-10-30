/**
 * One-off maintenance script: remove duplicate sections from
 * src/assets/acts.json and keep src/assets/section-embeddings.json aligned.
 *
 * Policy (deterministic, no legal text is rewritten):
 *   - The FIRST record for each `act_name|section_number` wins for all
 *     statutory fields (official_text, explanation, punishment, procedure).
 *   - Duplicate records may only fill fields that are empty in the first
 *     record and contribute extra keywords.
 *   - Vectors are filtered to the same keys, keeping the new json order equal
 *     to acts.json order (semantic.ts validates index-by-index).
 *
 * Run:  node scripts/dedupe-acts.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const actsPath = path.join(root, "src", "assets", "acts.json");
const embeddingsPath = path.join(root, "src", "assets", "section-embeddings.json");

const STATUTORY_FIELDS = [
  "official_text",
  "simplified_explanation",
  "punishment",
  "legal_procedure_guidance",
];
const META_FIELDS = ["domain", "chapter_number", "chapter_title", "section_title"];

const filled = (value) =>
  Array.isArray(value)
    ? value.length > 0
    : typeof value === "string"
      ? value.trim().length > 0
      : value !== undefined && value !== null;

const unionKeywords = (a = [], b = []) => {
  const out = [...a];
  for (const keyword of b) if (!out.includes(keyword)) out.push(keyword);
  return out;
};

const acts = JSON.parse(readFileSync(actsPath, "utf8"));
const embeddings = JSON.parse(readFileSync(embeddingsPath, "utf8"));

const byKey = new Map();
let duplicates = 0;

for (const row of acts) {
  const key = `${row.act_name}|${row.section_number}`;
  const base = byKey.get(key);
  if (!base) {
    byKey.set(key, { ...row, keywords: [...(row.keywords ?? [])] });
    continue;
  }
  duplicates += 1;
  for (const field of [...STATUTORY_FIELDS, ...META_FIELDS]) {
    if (!filled(base[field]) && filled(row[field])) base[field] = row[field];
  }
  base.keywords = unionKeywords(base.keywords, row.keywords ?? []);
}

const deduped = [...byKey.values()];

const firstIndex = new Map();
embeddings.ids.forEach((id, index) => {
  if (!firstIndex.has(id)) firstIndex.set(id, index);
});

const ids = [];
const vectors = [];
const missing = [];
for (const row of deduped) {
  const key = `${row.act_name}|${row.section_number}`;
  const index = firstIndex.get(key);
  if (index === undefined) {
    missing.push(key);
    continue;
  }
  ids.push(key);
  vectors.push(embeddings.vectors[index]);
}

if (missing.length > 0) {
  console.error("No embedding found for:", missing);
  process.exit(1);
}
if (ids.length !== deduped.length || vectors.length !== deduped.length) {
  console.error("Length mismatch after filtering:", ids.length, vectors.length, deduped.length);
  process.exit(1);
}

writeFileSync(actsPath, `${JSON.stringify(deduped, null, 2)}\n`);
writeFileSync(
  embeddingsPath,
  JSON.stringify({
    ...embeddings,
    generated_at: new Date().toISOString(),
    ids,
    vectors,
  }),
);

console.log(`acts: ${acts.length} -> ${deduped.length} rows (${duplicates} duplicates merged)`);
console.log(`embeddings: ${embeddings.ids.length} -> ${ids.length} vectors (aligned with acts.json)`);
