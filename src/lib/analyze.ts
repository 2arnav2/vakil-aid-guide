import {
  ACCIDENT_TERMS,
  CYBER_INTENT_TERMS,
  THEFT_INTENT_TERMS,
  VEHICLE_TERMS,
  analyzeLegalCase,
  buildCaseSummary,
  computeAnswerBoost,
  computeFactBoost,
  extractCaseFacts,
  factScoreBoost,
  formatConversationAnswers,
  getAvailableQuestions,
  type AnalysisResult,
  type CaseFacts,
  type ConversationContext,
  type RankedSection,
} from "./search";
import {
  MIN_SEMANTIC_SIMILARITY,
  semanticSearch,
  type SemanticDomain,
  type SemanticHit,
} from "./semantic";
import { analyzeWithGemini, hasGeminiKey, type GeminiOptions } from "./gemini";

export interface SmartAnalysisOptions extends GeminiOptions {
  /** Set to false to force the deterministic rule engine only. */
  useSemantic?: boolean;
  /** Set to false to skip the optional Google AI fallback. */
  useGemini?: boolean;
}

const domainOf = (actName: string): string => {
  if (actName.includes("Motor Vehicles")) return "mva";
  if (actName.includes("Information Technology")) return "it_act";
  return "ipc";
};

const answerText = (query: string, context?: ConversationContext): string =>
  [query, formatConversationAnswers(context)].filter(Boolean).join("\n");

// Coarse category hints. These do NOT choose a section — they only stop the
// semantic model from comparing an accident story against cyber-crime sections.
const DOMAIN_HINTS: Record<SemanticDomain, string[]> = {
  mva: [
    "road", "traffic", "vehicle", "truck", "lorry", "car", "bike", "motorcycle",
    "scooter", "bus", "auto", "driver", "driving", "accident", "crash", "collision",
    "pedestrian", "brake", "highway", "flyover", "crossing", "hit by", "hit and run",
  ],
  it_act: [
    "online", "internet", "computer", "laptop", "phone", "mobile", "account",
    "email", "password", "hack", "hacked", "hacking", "data", "website", "cyber",
    "instagram", "facebook", "whatsapp", "social media", "photo", "photos", "video",
    "privacy", "posted", "profile", "message", "chat",
  ],
  ipc: [
    "theft", "stole", "stolen", "robbed", "robbery", "snatched", "grabbed",
    "pickpocket", "assault", "hurt", "injured", "threat", "extortion", "fraud",
    "cheated", "landlord", "deposit", "property", "house", "money", "murder",
    "kidnap", "dowry", "beat",
  ],
};

const hasTerm = (text: string, term: string): boolean => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
};

const INJURY_HINT_TERMS = new Set(["injury", "injured", "injuries", "hurt", "injur"]);
const ROAD_HINT_TERMS = ACCIDENT_TERMS.filter((term) => !INJURY_HINT_TERMS.has(term));

const hasAnyHint = (text: string, terms: readonly string[]): boolean =>
  terms.some((term) => hasTerm(text, term));

const detectDomainHint = (text: string): SemanticDomain | undefined => {
  // Same disambiguation as the rule engine: a stolen vehicle or an assault
  // must not be pushed into the road-accident bucket by nouns like "car"/"hit".
  const theftIntent = hasAnyHint(text, THEFT_INTENT_TERMS);
  const cyberIntent = hasAnyHint(text, CYBER_INTENT_TERMS);
  const vehicleContext = hasAnyHint(text, VEHICLE_TERMS);
  const roadContext = hasAnyHint(text, ROAD_HINT_TERMS);

  if (cyberIntent && !roadContext) return "it_act";
  if (theftIntent && !roadContext) return "ipc";
  if (hasTerm(text, "hit") && !vehicleContext) return "ipc";

  const scores: Record<SemanticDomain, number> = { mva: 0, it_act: 0, ipc: 0 };

  (Object.keys(DOMAIN_HINTS) as SemanticDomain[]).forEach((domain) => {
    DOMAIN_HINTS[domain].forEach((term) => {
      if (hasTerm(text, term)) scores[domain] += term.includes(" ") ? 2 : 1;
    });
  });

  if (scores.mva === 0 && scores.it_act === 0 && scores.ipc === 0) return undefined;
  if (scores.mva >= scores.it_act && scores.mva >= scores.ipc) return "mva";
  if (scores.it_act >= scores.ipc) return "it_act";
  return "ipc";
};

/**
 * Turn semantic hits into the same AnalysisResult shape the rest of the app
 * already understands, so the UI does not need a second rendering path.
 */
export const buildSemanticResult = (
  query: string,
  context: ConversationContext | undefined,
  base: AnalysisResult,
  hits: SemanticHit[],
  domainHint?: SemanticDomain,
): AnalysisResult => {
  const top = hits[0];
  const domain = domainHint ?? domainOf(top.act.act_name);
  const facts: CaseFacts = base.facts ?? extractCaseFacts(answerText(query, context));
  const caseSummary = base.caseSummary ?? buildCaseSummary(facts);
  const liabilityNotes = base.liabilityNotes ?? "";

  const available = getAvailableQuestions(domain, context, facts);
  const importantUnknown = available.some(
    (question) => question.key === "injured" || question.key === "hit_and_run",
  );

  const rawConfidence = Math.min(80, Math.round(30 + top.similarity * 70));
  const preliminary = Math.min(80, rawConfidence + computeFactBoost(facts));
  const final = Math.min(
    80,
    rawConfidence + computeAnswerBoost(context) + computeFactBoost(facts),
  );

  const shouldAsk = available.length > 0 && (rawConfidence < 70 || importantUnknown);
  const next = available[0];
  const confidence = shouldAsk ? preliminary : final;

  const matches: RankedSection[] = hits.slice(0, 6).map((hit, index) => {
    const relative = top.similarity > 0 ? Math.max(0.35, hit.similarity / top.similarity) : 1;
    const percentage = Math.round(Math.min(1, Math.max(0, hit.similarity)) * 100);

    return {
      sectionNumber: hit.act.section_number,
      sectionTitle: hit.act.section_title,
      actName: hit.act.act_name,
      confidence: Math.max(20, Math.min(confidence, Math.round(confidence * relative))),
      applicableLaw: hit.act.official_text || "Text not available.",
      explanation: hit.act.simplified_explanation || "No simple explanation available.",
      punishment: hit.act.punishment || "Refer to Act.",
      whatToDo: hit.act.legal_procedure_guidance || "Consult a lawyer.",
      reasons: [`Matched by meaning (${percentage}% similarity)`],
      notes: index === 0 && liabilityNotes ? liabilityNotes : undefined,
    };
  });

  return {
    section_number: top.act.section_number,
    section_title: top.act.section_title,
    act_name: top.act.act_name,
    confidence_score: confidence,
    reasoning_summary: `No strong keyword match, so I compared the meaning of your description with the local legal database using a neural embedding model. Closest match: **${top.act.section_title}** (${top.act.act_name}).`,
    applicable_law: top.act.official_text || "Text not available.",
    simplified_explanation: top.act.simplified_explanation || "No simple explanation available.",
    possible_punishment: top.act.punishment || "Refer to Act.",
    what_user_can_do: top.act.legal_procedure_guidance || "Consult a lawyer.",
    clarification_question_if_needed: shouldAsk ? next.question : "",
    domain,
    facts,
    caseSummary,
    liabilityNotes,
    matches,
    engine: "semantic",
    matchNote:
      "Matched by meaning with a local AI embedding model — not a hard-coded keyword list. Sections still come from the local legal database.",
    clarificationFlow: shouldAsk
      ? {
          shouldAsk: true,
          question: next.question,
          questionKey: next.key,
          options: next.options,
        }
      : { shouldAsk: false },
  };
};

/**
 * Main UI entry point.
 *
 * 1. Run the fast, deterministic rule engine.
 * 2. If it has a solid match, return immediately (no network, no AI cost).
 * 3. Otherwise, use Google AI if the user configured an API key.
 * 4. If Google AI is not configured or fails, use local semantic search.
 * 5. If everything fails, return the honest rule-engine answer + a note.
 */
export const analyzeCaseSmart = async (
  query: string,
  context?: ConversationContext,
  options?: SmartAnalysisOptions,
): Promise<AnalysisResult> => {
  const base = analyzeLegalCase(query, context);

  // If Google AI asked the previous question, keep the same engine for the
  // follow-up. Otherwise a "yes" answer could push the local score above 60
  // and silently switch away from the AI mid-conversation.
  const usedGeminiBefore =
    context?.questionsAsked?.some((key) => key.startsWith("ai_")) ?? false;
  const weakMatch =
    usedGeminiBefore || (base.matches?.length ?? 0) === 0 || base.confidence_score < 60;

  if (!weakMatch) {
    return { ...base, engine: "rules" };
  }

  const hint = detectDomainHint(answerText(query, context));

  let geminiError: string | undefined;

  if (options?.useGemini !== false && hasGeminiKey()) {
    try {
      options?.onProgress?.("Google AI is reading your case…");
      const aiResult = await analyzeWithGemini(query, context, {
        ...options,
        domainHint: hint,
      });
      if (aiResult) return aiResult;
      geminiError = "Google AI did not return a usable section match.";
    } catch (error) {
      geminiError = error instanceof Error ? error.message : "Google AI failed.";
      console.warn("Gemini analysis failed:", error);
    }
  }

  const noHintNote =
    "I couldn't confidently tell what type of case this is, so I didn't want to guess a section. Add a detail like \"road accident\", \"online\", or \"theft\".";

  // Gemini can classify a case even when the local keyword hints are empty.
  // If it was not available, ask for one useful detail instead of guessing.
  if (!hint) {
    return {
      ...base,
      engine: "rules",
      matchNote: geminiError ? `${geminiError} ${noHintNote}` : noHintNote,
    };
  }

  let failureNote = geminiError
    ? `${geminiError} This answer uses the offline fallback.`
    : "No strong keyword or semantic match was found. Add a little more detail — what happened, who was hurt, and what was damaged — for a better result.";

  if (options?.useSemantic !== false) {
    try {
      options?.onProgress?.("Looking for a meaning-based match…");
      const rawHits = await semanticSearch(
        answerText(query, context),
        12,
        options?.onProgress,
        hint,
      );

      if (rawHits.length > 0 && rawHits[0].similarity >= MIN_SEMANTIC_SIMILARITY) {
        const adjusted = rawHits
          .map((hit) => ({
            ...hit,
            similarity: Math.min(
              1,
              hit.similarity + factScoreBoost(hit.act, base.facts ?? {}) / 200,
            ),
          }))
          .sort((a, b) => b.similarity - a.similarity);

        const semanticResult = buildSemanticResult(query, context, base, adjusted, hint);
        if (geminiError) {
          semanticResult.matchNote = `${semanticResult.matchNote} (Google AI was unavailable: ${geminiError})`;
        }
        return semanticResult;
      }

      options?.onProgress?.("No strong meaning-based match found.");
    } catch (error) {
      console.warn("Semantic fallback failed:", error);
      failureNote = geminiError
        ? `${geminiError} The local semantic model also could not load, so this answer uses the offline rule engine.`
        : "The semantic model could not load (the first use needs internet). This answer uses the offline rule engine.";
      options?.onProgress?.("Semantic model unavailable; using offline rules.");
    }
  }

  return {
    ...base,
    engine: "rules",
    matchNote: failureNote,
  };
};
