import actsData from "@/assets/acts.json";
import {
  analyzeLegalCase,
  conversationAnswerValues,
  extractCaseFacts,
  formatConversationAnswers,
  type Act,
  type AnalysisResult,
  type CaseFacts,
  type ConversationContext,
  type RankedSection,
} from "./search";

/**
 * Optional Google AI Studio (Gemini) fallback.
 *
 * Nothing here runs unless the user has saved their own API key. The app is
 * still a local Vite app: this file only makes a direct HTTPS request to
 * Google's Generative Language API when a weak-match case is being analysed.
 *
 * Security: this is a browser app, so a key stored in localStorage is visible
 * to the user (and to anyone who can run code on the page). For a public
 * deployment, point VITE_GEMINI_BASE_URL at a backend proxy instead of using
 * a browser key.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export const GEMINI_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (recommended)" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (fastest / cheapest)" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
];

const KEY_STORAGE = "evakil.gemini.apiKey";
const MODEL_STORAGE = "evakil.gemini.model";

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};

export interface GeminiStatus {
  configured: boolean;
  available: boolean;
  models: string[];
  modelAvailable?: boolean;
  error?: string;
}

export interface GeminiMatch {
  act: string;
  section: string;
  confidence: number;
  reason: string;
}

export interface GeminiFacts {
  injured?: boolean | null;
  injured_count?: number | null;
  brake_failure?: boolean | null;
  fled?: boolean | null;
  overspeeding?: boolean | null;
  wrong_side?: boolean | null;
  drunk?: boolean | null;
  death?: boolean | null;
}

export interface GeminiAnalysis {
  case_summary?: string;
  facts?: GeminiFacts;
  matches?: GeminiMatch[];
  clarification_question?: string | null;
  clarification_options?: string[];
  liability_notes?: string;
}

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  domainHint?: string;
  onProgress?: (message: string) => void;
}

export const getGeminiKey = (): string => {
  try {
    const stored = localStorage.getItem(KEY_STORAGE);
    if (stored?.trim()) return stored.trim();
  } catch {
    // localStorage is unavailable in some test/SSR environments.
  }
  return (env.VITE_GOOGLE_AI_API_KEY || env.VITE_GEMINI_API_KEY || "").trim();
};

export const hasGeminiKey = (): boolean => Boolean(getGeminiKey());

export const getGeminiModel = (): string => {
  try {
    const stored = localStorage.getItem(MODEL_STORAGE);
    if (stored?.trim()) return stored.trim();
  } catch {
    // ignore
  }
  return env.VITE_GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
};

export const getGeminiBaseUrl = (): string =>
  (env.VITE_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");

export const saveGeminiSettings = (settings: { apiKey: string; model?: string }): void => {
  try {
    const key = settings.apiKey.trim();
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);

    if (settings.model?.trim()) localStorage.setItem(MODEL_STORAGE, settings.model.trim());
    else localStorage.removeItem(MODEL_STORAGE);
  } catch {
    // ignore storage failures
  }
};

export const clearGeminiSettings = (): void => {
  try {
    localStorage.removeItem(KEY_STORAGE);
    localStorage.removeItem(MODEL_STORAGE);
  } catch {
    // ignore
  }
};

const extractApiError = (data: unknown): string => {
  if (!data || typeof data !== "object" || !("error" in data)) return "";
  const error = (data as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : "";
};

const friendlyHttpError = (status: number, apiMessage: string): string => {
  if (status === 400 || status === 401 || status === 403) {
    return `Google AI rejected the API key or request (HTTP ${status}). Open AI Settings and check your key.`;
  }
  if (status === 429) {
    return "Google AI rate limit or quota reached. Try again later, or use the offline fallback.";
  }
  if (status >= 500) {
    return "Google AI is temporarily unavailable. Try again shortly.";
  }
  return apiMessage || `Google AI returned HTTP ${status}.`;
};

export const checkGemini = async (options?: GeminiOptions): Promise<GeminiStatus> => {
  const apiKey = (options?.apiKey ?? getGeminiKey()).trim();
  const model = options?.model ?? getGeminiModel();
  const baseUrl = (options?.baseUrl ?? getGeminiBaseUrl()).replace(/\/$/, "");

  if (!apiKey) {
    return { configured: false, available: false, models: [], error: "No Google AI API key configured." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 10_000);

  try {
    const response = await fetch(`${baseUrl}/v1beta/models`, {
      headers: { "x-goog-api-key": apiKey },
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };

    if (!response.ok) {
      throw new Error(friendlyHttpError(response.status, extractApiError(data)));
    }

    const models = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => String(m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);

    return {
      configured: true,
      available: true,
      models,
      modelAvailable: models.length === 0 ? undefined : models.includes(model),
    };
  } catch (error) {
    return {
      configured: true,
      available: false,
      models: [],
      error:
        error instanceof Error
          ? error.name === "AbortError"
            ? "Google AI took too long to respond."
            : error.message
          : "Could not reach Google AI.",
    };
  } finally {
    clearTimeout(timer);
  }
};

const buildCatalog = (): string =>
  (actsData as Act[])
    .map(
      (act) =>
        `${act.act_name} | ${act.section_number} | ${act.section_title} | ${(act.keywords ?? [])
          .slice(0, 4)
          .join(", ")}`,
    )
    .join("\n");

const buildPrompt = (
  query: string,
  context?: ConversationContext,
): { system: string; user: string } => {
  const answers = formatConversationAnswers(context);

  const system = `You are a legal triage assistant for Indian law. You help ordinary people understand which laws may apply to their situation.

Choose sections ONLY from the CATALOG below. Never invent an Act, a section number, or a quotation. If a section is not in the catalog, do not mention it.

For road accidents, consider BOTH the Motor Vehicles Act and the accident-related IPC sections (rash driving, hurt, death by negligence, mischief).

Return strict JSON with exactly this shape:
{
  "case_summary": "one or two plain-English sentences using the user's own facts",
  "facts": {
    "injured": true or false or null,
    "injured_count": number or null,
    "brake_failure": true or false or null,
    "fled": true or false or null,
    "overspeeding": true or false or null,
    "wrong_side": true or false or null,
    "drunk": true or false or null,
    "death": true or false or null
  },
  "matches": [
    { "act": "exact act name from the catalog", "section": "exact section number", "confidence": 0-100, "reason": "short plain-English reason" }
  ],
  "clarification_question": "one short question if a key fact is missing, otherwise null",
  "clarification_options": ["Yes", "No", "Not sure"],
  "liability_notes": "balanced note about possible liability, or an empty string"
}

Rules:
- Pick 3 to 6 sections, most relevant first. Include a section only when the facts support it.
- Confidence is your honest estimate, not a keyword score.
- If brake failure is mentioned, do not blame only the driver: mention that the owner/operator may be responsible for maintenance, and that the driver may argue the failure was unforeseen.
- If the user has NOT said whether anyone was injured, ask "Was anyone injured?" as the clarification question.
- If the user has already answered a question, do not ask it again.
- If the description does not describe a legal problem, return an empty matches array.
- Keep case_summary to one or two sentences.
- liability_notes must be balanced and short.
- Keep the entire JSON response under 300 words. Return JSON only, with no markdown fences.

CATALOG (act | section | title | keywords):
${buildCatalog()}`;

  const user = `Case description:
${query}

Answers the user has already given:
${answers || "(none yet)"}`;

  return { system, user };
};

/** Models occasionally return numbers/objects where strings were requested. */
const asText = (value: unknown, maxLength = 2000): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const asStringArray = (value: unknown, maxItems = 4): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const asObject = <T extends object>(value: unknown): T | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as T) : undefined;

const coerceAnalysis = (value: unknown): GeminiAnalysis | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as GeminiAnalysis)
    : null;

export const parseGeminiJson = (content: string): GeminiAnalysis | null => {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return coerceAnalysis(JSON.parse(cleaned));
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return coerceAnalysis(JSON.parse(cleaned.slice(start, end + 1)));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const requestGemini = async (
  query: string,
  context: ConversationContext | undefined,
  config: { apiKey: string; model: string; baseUrl: string; timeoutMs: number },
  onProgress?: (message: string) => void,
): Promise<GeminiAnalysis | null> => {
  const { system, user } = buildPrompt(query, context);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    onProgress?.(`Google AI (${config.model}) is reading your case…`);

    const response = await fetch(
      `${config.baseUrl}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        finishReason?: string;
      }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(friendlyHttpError(response.status, extractApiError(data)));
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error("Google AI returned no answer. Try rephrasing your case.");
    }
    if (candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
      throw new Error("Google AI blocked this response. Try describing the facts in neutral language.");
    }

    const content =
      candidate.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    return parseGeminiJson(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Google AI took too long to respond. Try again or use the offline fallback.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const findAct = (actName: string, section: string): Act | null => {
  const acts = actsData as Act[];
  const candidates = acts.filter((act) => act.section_number === section);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const name = (actName || "").toLowerCase();
  return (
    candidates.find((act) => {
      const full = act.act_name.toLowerCase();
      return (
        full.includes(name) ||
        name.includes(full) ||
        (name.includes("motor") && full.includes("motor")) ||
        (name.includes("penal") && full.includes("penal")) ||
        (name.includes("information") && full.includes("information"))
      );
    }) ?? null
  );
};

const domainOf = (actName: string): string => {
  if (actName.includes("Motor Vehicles")) return "mva";
  if (actName.includes("Information Technology")) return "it_act";
  return "ipc";
};

const clampConfidence = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 60;
  return Math.min(95, Math.max(1, Math.round(number)));
};

const mergeFacts = (local: CaseFacts, ai?: GeminiFacts): CaseFacts => {
  const merged: CaseFacts = { ...local };
  if (!ai) return merged;

  if (merged.injured === undefined && typeof ai.injured === "boolean") merged.injured = ai.injured;
  if (merged.injuredCount == null && typeof ai.injured_count === "number" && ai.injured_count > 0) {
    merged.injuredCount = ai.injured_count;
  }
  if (merged.brakeFailure === undefined && typeof ai.brake_failure === "boolean") {
    merged.brakeFailure = ai.brake_failure;
  }
  if (merged.fled === undefined && typeof ai.fled === "boolean") merged.fled = ai.fled;
  if (merged.overspeeding === undefined && typeof ai.overspeeding === "boolean") {
    merged.overspeeding = ai.overspeeding;
  }
  if (merged.wrongSide === undefined && typeof ai.wrong_side === "boolean") {
    merged.wrongSide = ai.wrong_side;
  }
  if (merged.drunk === undefined && typeof ai.drunk === "boolean") merged.drunk = ai.drunk;
  if (merged.death === undefined && typeof ai.death === "boolean") merged.death = ai.death;

  return merged;
};

const defaultOptionsFor = (question: string): string[] => {
  if (/injur|hurt/i.test(question)) return ["Yes", "No", "Not sure"];
  if (/stop|flee|hit.?and.?run/i.test(question)) return ["Stopped", "Fled / Hit-and-run", "Not sure"];
  if (/wrong side|opposite/i.test(question)) return ["Yes", "No", "Not sure"];
  if (/speed|rash|reckless/i.test(question)) return ["Yes", "No", "Not sure"];
  return [];
};

const normalizeQuestionText = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Convert Gemini's answer into the app's existing AnalysisResult shape.
 * Returns null if the model did not pick a single valid catalog section,
 * which keeps hallucinated sections out of the UI.
 */
export const buildGeminiResult = (
  query: string,
  context: ConversationContext | undefined,
  ai: GeminiAnalysis,
  localResult: AnalysisResult,
  model = DEFAULT_GEMINI_MODEL,
  domainHint?: string,
): AnalysisResult | null => {
  const matches: RankedSection[] = [];
  const seen = new Set<string>();
  const candidates = Array.isArray(ai.matches) ? ai.matches : [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    if (typeof candidate.section !== "string" && typeof candidate.section !== "number") continue;

    const act = findAct(asText(candidate.act, 120), String(candidate.section));
    if (!act) continue;

    const key = `${act.act_name}|${act.section_number}`;
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({
      sectionNumber: act.section_number,
      sectionTitle: act.section_title,
      actName: act.act_name,
      confidence: clampConfidence(candidate.confidence),
      applicableLaw: act.official_text || "Text not available.",
      explanation: act.simplified_explanation || "No simple explanation available.",
      punishment: act.punishment || "Refer to Act.",
      whatToDo: act.legal_procedure_guidance || "Consult a lawyer.",
      reasons: [asText(candidate.reason, 500) || "Selected by Google AI"],
      notes: undefined,
    });

    if (matches.length >= 6) break;
  }

  if (matches.length === 0) return null;

  const top = matches[0];
  const answerText = [query, conversationAnswerValues(context)].filter(Boolean).join("\n");
  const localFacts = localResult.facts ?? extractCaseFacts(answerText);
  const facts = mergeFacts(localFacts, asObject<GeminiFacts>(ai.facts));
  const caseSummary = asText(ai.case_summary, 1000) || localResult.caseSummary || "";
  const aiLiability = asText(ai.liability_notes, 1500);
  const liabilityNotes = facts.brakeFailure
    ? localResult.liabilityNotes || aiLiability
    : aiLiability || localResult.liabilityNotes || "";
  const domain = domainHint || domainOf(top.actName);

  if (liabilityNotes) matches[0].notes = liabilityNotes;

  const question = asText(ai.clarification_question, 500);
  const alreadyAsked = context?.questionsAsked?.length ?? 0;
  const previousQuestionTexts = Object.values(context?.questionTexts ?? {}).map(
    normalizeQuestionText,
  );
  const repeatedQuestion =
    Boolean(question) && previousQuestionTexts.includes(normalizeQuestionText(question));
  const shouldAsk = Boolean(question) && alreadyAsked < 4 && !repeatedQuestion;
  const aiOptions = asStringArray(ai.clarification_options, 4);
  const options = aiOptions.length > 0 ? aiOptions : defaultOptionsFor(question);
  const repeatNote = repeatedQuestion
    ? " Google AI repeated a question you already answered, so I stopped asking and used the facts available."
    : "";

  return {
    section_number: top.sectionNumber,
    section_title: top.sectionTitle,
    act_name: top.actName,
    confidence_score: top.confidence,
    reasoning_summary: `Google ${model} analyzed the facts and selected **${top.sectionTitle}** (${top.actName}). Reason: ${top.reasons[0]}`,
    applicable_law: top.applicableLaw,
    simplified_explanation: top.explanation,
    possible_punishment: top.punishment,
    what_user_can_do: top.whatToDo,
    clarification_question_if_needed: shouldAsk ? question : "",
    domain,
    facts,
    caseSummary,
    liabilityNotes,
    matches,
    engine: "gemini",
    matchNote: `Analyzed by Google ${model} (AI Studio). Every section was validated against the local legal database; AI can still make mistakes.${repeatNote}`,
    clarificationFlow: shouldAsk
      ? {
          shouldAsk: true,
          question,
          questionKey: `ai_${alreadyAsked + 1}`,
          options: options.length > 0 ? options : undefined,
        }
      : { shouldAsk: false },
  };
};

/** Calls Gemini and maps the result. Throws a user-readable Error on failure. */
export const analyzeWithGemini = async (
  query: string,
  context?: ConversationContext,
  options?: GeminiOptions,
): Promise<AnalysisResult | null> => {
  const apiKey = (options?.apiKey ?? getGeminiKey()).trim();
  if (!apiKey) return null;

  const model = options?.model || getGeminiModel();
  const baseUrl = (options?.baseUrl ?? getGeminiBaseUrl()).replace(/\/$/, "");
  const localResult = analyzeLegalCase(query, context);

  const ai = await requestGemini(
    query,
    context,
    {
      apiKey,
      model,
      baseUrl,
      timeoutMs: options?.timeoutMs ?? 45_000,
    },
    options?.onProgress,
  );

  if (!ai) return null;
  return buildGeminiResult(query, context, ai, localResult, model, options?.domainHint);
};
