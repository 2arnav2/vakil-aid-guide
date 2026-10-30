import { afterEach, describe, expect, it, vi } from "vitest";
import actsData from "@/assets/acts.json";
import { analyzeLegalCase, type Act, type ConversationContext } from "@/lib/search";
import {
  buildGeminiResult,
  checkGemini,
  parseGeminiJson,
  type GeminiAnalysis,
} from "@/lib/gemini";

const acts = actsData as Act[];

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseResult = () =>
  analyzeLegalCase(
    "The truck's brakes failed and it hit us. The driver sped off. My wife and I were injured.",
  );

const aiAnalysis = (overrides: Partial<GeminiAnalysis> = {}): GeminiAnalysis => ({
  case_summary: "A truck with failed brakes hit the user and their wife, then the driver fled.",
  facts: {
    injured: true,
    injured_count: 2,
    brake_failure: true,
    fled: true,
    overspeeding: null,
    wrong_side: null,
    drunk: null,
    death: false,
  },
  matches: [
    {
      act: "Motor Vehicles Act, 1988",
      section: "190",
      confidence: 88,
      reason: "The vehicle was being used in an unsafe condition.",
    },
    {
      act: "Indian Penal Code, 1860",
      section: "337",
      confidence: 78,
      reason: "The collision caused hurt.",
    },
  ],
  clarification_question: null,
  clarification_options: [],
  liability_notes:
    "The owner/operator may also be responsible for maintenance; the driver may argue the brake failure was unforeseen.",
  ...overrides,
});

describe("parseGeminiJson", () => {
  it("parses raw JSON", () => {
    const parsed = parseGeminiJson('{"case_summary":"ok","matches":[]}');
    expect(parsed?.case_summary).toBe("ok");
  });

  it("parses JSON wrapped in markdown fences", () => {
    const parsed = parseGeminiJson('```json\n{"case_summary":"fenced","matches":[]}\n```');
    expect(parsed?.case_summary).toBe("fenced");
  });

  it("returns null for non-JSON output", () => {
    expect(parseGeminiJson("I cannot answer that.")).toBeNull();
  });
});

describe("buildGeminiResult", () => {
  it("maps valid sections and drops hallucinated ones", () => {
    const ai = aiAnalysis({
      matches: [
        ...aiAnalysis().matches,
        {
          act: "Motor Vehicles Act, 1988",
          section: "999",
          confidence: 99,
          reason: "This section does not exist.",
        },
      ],
    });

    const result = buildGeminiResult("truck hit us", undefined, ai, baseResult(), "test-model", "mva");

    expect(result).not.toBeNull();
    expect(result?.engine).toBe("gemini");
    expect(result?.domain).toBe("mva");
    expect(result?.matches).toHaveLength(2);
    expect(result?.matches?.some((m) => m.sectionNumber === "999")).toBe(false);
    expect(result?.section_number).toBe("190");
    expect(result?.confidence_score).toBe(88);
    expect(result?.matchNote).toContain("Google");
    expect(result?.matchNote).toContain("test-model");
    expect(result?.matches?.[0].notes).toContain("owner/operator");
  });

  it("returns null when every proposed section is invalid", () => {
    const ai = aiAnalysis({
      matches: [
        {
          act: "Motor Vehicles Act, 1988",
          section: "999",
          confidence: 90,
          reason: "Invented.",
        },
      ],
    });

    expect(buildGeminiResult("truck hit us", undefined, ai, baseResult())).toBeNull();
  });

  it("deduplicates the same section proposed twice", () => {
    const ai = aiAnalysis({
      matches: [
        ...aiAnalysis().matches,
        {
          act: "Motor Vehicles Act, 1988",
          section: "190",
          confidence: 70,
          reason: "Duplicate.",
        },
      ],
    });

    const result = buildGeminiResult("truck hit us", undefined, ai, baseResult());
    expect(result?.matches).toHaveLength(2);
  });

  it("keeps the local brake-failure liability note instead of blaming only the driver", () => {
    const local = analyzeLegalCase("The truck's brakes failed and it hit us. My wife and I were injured.");
    const ai = aiAnalysis({
      liability_notes: "The driver is fully responsible.",
    });

    const result = buildGeminiResult("brakes failed", undefined, ai, local, "test-model", "mva");
    expect(result?.liabilityNotes).toMatch(/owner|operator|maintenance/i);
    expect(result?.matches?.[0].notes).toMatch(/owner|operator|maintenance/i);
  });

  it("merges AI-only facts with locally extracted facts", () => {
    const local = analyzeLegalCase("A vehicle hit us.");
    const ai = aiAnalysis({
      facts: {
        injured: true,
        injured_count: null,
        brake_failure: null,
        fled: true,
        overspeeding: true,
        wrong_side: null,
        drunk: null,
        death: false,
      },
      clarification_question: "Was anyone injured?",
    });

    const result = buildGeminiResult("A vehicle hit us.", undefined, ai, local, "test-model", "mva");
    expect(result?.facts?.injured).toBe(true);
    expect(result?.facts?.fled).toBe(true);
    expect(result?.facts?.overspeeding).toBe(true);
  });

  it("asks one clarification question and stops after four questions", () => {
    const ai = aiAnalysis({
      clarification_question: "Was anyone injured?",
      clarification_options: ["Yes", "No", "Not sure"],
    });

    const first = buildGeminiResult("A vehicle hit us.", undefined, ai, baseResult(), "test-model", "mva");
    expect(first?.clarificationFlow?.shouldAsk).toBe(true);
    expect(first?.clarificationFlow?.questionKey).toBe("ai_1");
    expect(first?.clarificationFlow?.options).toEqual(["Yes", "No", "Not sure"]);

    const context: ConversationContext = {
      collectedAnswers: {},
      questionsAsked: ["a", "b", "c", "d"],
      readyForResult: false,
    };
    const final = buildGeminiResult("A vehicle hit us.", context, ai, baseResult(), "test-model", "mva");
    expect(final?.clarificationFlow?.shouldAsk).toBe(false);
  });

  it("does not repeat a question the user already answered", () => {
    const ai = aiAnalysis({
      clarification_question: "Was anyone injured?",
      clarification_options: ["Yes", "No", "Not sure"],
    });
    const context: ConversationContext = {
      collectedAnswers: { ai_1: "yes" },
      questionsAsked: ["ai_1"],
      questionTexts: { ai_1: "Was anyone injured?" },
      readyForResult: false,
    };

    const result = buildGeminiResult(
      "A vehicle hit us.",
      context,
      ai,
      baseResult(),
      "test-model",
      "mva",
    );

    expect(result?.clarificationFlow?.shouldAsk).toBe(false);
    expect(result?.matchNote).toMatch(/repeated a question/i);
  });

  it("uses the domain hint for where-to-file routing", () => {
    const ai = aiAnalysis({
      matches: [
        {
          act: "Indian Penal Code, 1860",
          section: "279",
          confidence: 75,
          reason: "Rash driving on a public way.",
        },
      ],
    });

    const result = buildGeminiResult("road accident", undefined, ai, baseResult(), "test-model", "mva");
    expect(result?.domain).toBe("mva");
    expect(result?.act_name).toContain("Indian Penal Code");
  });

  it("accepts a section number returned as a number", () => {
    const ai = aiAnalysis({
      matches: [
        {
          act: "Motor Vehicles Act, 1988",
          section: 190 as unknown as string,
          confidence: "82" as unknown as number,
          reason: "Unsafe vehicle.",
        },
      ],
    });

    const result = buildGeminiResult("truck hit us", undefined, ai, baseResult(), "test-model");
    expect(result?.section_number).toBe("190");
    expect(result?.confidence_score).toBe(82);
  });

  it("has the sections it expects in the local catalog", () => {
    expect(acts.some((a) => a.section_number === "190")).toBe(true);
    expect(acts.some((a) => a.section_number === "337")).toBe(true);
    expect(acts.some((a) => a.section_number === "279")).toBe(true);
  });
});

describe("checkGemini", () => {
  it("lists usable models and confirms the selected one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
            { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] },
          ],
        }),
      })),
    );

    const status = await checkGemini({
      apiKey: "test-key",
      model: "gemini-3.8-flash",
      timeoutMs: 1_000,
    });

    expect(status.configured).toBe(true);
    expect(status.available).toBe(true);
    expect(status.models).toEqual(["gemini-3.8-flash"]);
    expect(status.modelAvailable).toBe(true);
  });

  it("returns a readable error for a rejected key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "API key not valid" } }),
      })),
    );

    const status = await checkGemini({ apiKey: "bad-key", timeoutMs: 1_000 });

    expect(status.configured).toBe(true);
    expect(status.available).toBe(false);
    expect(status.error).toMatch(/rejected the API key/i);
  });

  it("does not call the network without a key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const status = await checkGemini({ apiKey: "" });

    expect(status.configured).toBe(false);
    expect(status.available).toBe(false);
    expect(status.error).toMatch(/No Google AI API key/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
