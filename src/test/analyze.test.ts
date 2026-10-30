import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import actsData from "@/assets/acts.json";
import { analyzeCaseSmart } from "@/lib/analyze";
import { semanticSearch, type SemanticHit } from "@/lib/semantic";
import type { Act, ConversationContext } from "@/lib/search";

vi.mock("@/lib/semantic", () => ({
  MIN_SEMANTIC_SIMILARITY: 0.45,
  semanticSearch: vi.fn(),
}));

const acts = actsData as Act[];

const hit = (section: string, similarity: number): SemanticHit => {
  const act = acts.find((candidate) => candidate.section_number === section);
  if (!act) throw new Error(`Test setup: section ${section} is missing from acts.json`);
  return { act, similarity };
};

const geminiAnswer = {
  case_summary: "A heavy vehicle's brakes failed and it hit a pedestrian.",
  facts: {
    injured: true,
    injured_count: 1,
    brake_failure: true,
    fled: false,
    overspeeding: null,
    wrong_side: null,
    drunk: null,
    death: false,
  },
  matches: [
    {
      act: "Motor Vehicles Act, 1988",
      section: "190",
      confidence: 86,
      reason: "The vehicle was being used in an unsafe condition.",
    },
    {
      act: "Indian Penal Code, 1860",
      section: "337",
      confidence: 74,
      reason: "The pedestrian was hurt.",
    },
  ],
  clarification_question: "Did the driver stop after the collision?",
  clarification_options: ["Stopped", "Fled / Hit-and-run", "Not sure"],
  liability_notes: "The owner/operator may also be responsible for maintenance.",
};

const geminiResponse = {
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [
      {
        content: { parts: [{ text: JSON.stringify(geminiAnswer) }] },
        finishReason: "STOP",
      },
    ],
  }),
};

const weakAccidentQuery =
  "the heavy vehicle's stopping mechanism failed and it crushed a pedestrian";

describe("analyzeCaseSmart", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a solid rule-engine match without calling any AI", async () => {
    localStorage.setItem("evakil.gemini.apiKey", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeCaseSmart(
      "I was hit by a car while crossing the road and the driver ran away without stopping",
    );

    expect(result.engine).toBe("rules");
    expect(result.confidence_score).toBeGreaterThanOrEqual(60);
    expect(semanticSearch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to local semantic search when the rules are weak", async () => {
    vi.mocked(semanticSearch).mockResolvedValue([hit("190", 0.54), hit("337", 0.52)]);

    const result = await analyzeCaseSmart(weakAccidentQuery);

    expect(result.engine).toBe("semantic");
    expect(result.domain).toBe("mva");
    expect(result.section_number).toBe("190");
    expect(result.matchNote).toContain("Matched by meaning");
    expect(semanticSearch).toHaveBeenCalledWith(expect.any(String), 12, undefined, "mva");
  });

  it("uses Google AI before semantic search when a key is configured", async () => {
    localStorage.setItem("evakil.gemini.apiKey", "test-key");
    const fetchMock = vi.fn(async () => geminiResponse);
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeCaseSmart(weakAccidentQuery);

    expect(result.engine).toBe("gemini");
    expect(result.section_number).toBe("190");
    expect(result.matches?.map((match) => match.sectionNumber)).toEqual(["190", "337"]);
    expect(result.matchNote).toContain("Google");
    expect(result.clarificationFlow?.shouldAsk).toBe(true);
    expect(semanticSearch).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps Gemini on follow-up turns and sends labelled Q/A context", async () => {
    localStorage.setItem("evakil.gemini.apiKey", "test-key");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => geminiResponse);
    vi.stubGlobal("fetch", fetchMock);

    const context: ConversationContext = {
      collectedAnswers: { ai_1: "yes" },
      questionsAsked: ["ai_1"],
      questionTexts: { ai_1: "Were you and your wife injured?" },
      readyForResult: false,
    };

    const result = await analyzeCaseSmart(
      "I was hit by a car while crossing the road and the driver ran away without stopping",
      context,
    );

    expect(result.engine).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      contents: { parts: { text: string }[] }[];
    };
    const userText = body.contents[0].parts[0].text;
    expect(userText).toContain("Q: Were you and your wife injured?");
    expect(userText).toContain("A: yes");
  });

  it("falls back to semantic search when Google AI rejects the key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem("evakil.gemini.apiKey", "bad-key");
    vi.mocked(semanticSearch).mockResolvedValue([hit("190", 0.54)]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "API key not valid" } }),
      })),
    );

    const result = await analyzeCaseSmart(weakAccidentQuery);

    expect(result.engine).toBe("semantic");
    expect(result.section_number).toBe("190");
    expect(result.matchNote).toContain("Google AI was unavailable");
    expect(result.matchNote).toMatch(/rejected|API key/i);
    expect(semanticSearch).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns the rule-engine answer when semantic search also fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(semanticSearch).mockRejectedValue(new Error("model download failed"));

    const result = await analyzeCaseSmart(weakAccidentQuery);

    expect(result.engine).toBe("rules");
    expect(result.matchNote).toContain("semantic model could not load");
    warn.mockRestore();
  });

  it("does not guess a section when the case type is unclear", async () => {
    const result = await analyzeCaseSmart("please help me understand this problem");

    expect(result.engine).toBe("rules");
    expect(result.matchNote).toContain("couldn't confidently tell");
    expect(semanticSearch).not.toHaveBeenCalled();
  });

  it("can skip Google AI explicitly", async () => {
    localStorage.setItem("evakil.gemini.apiKey", "test-key");
    vi.mocked(semanticSearch).mockResolvedValue([hit("190", 0.54)]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeCaseSmart(weakAccidentQuery, undefined, { useGemini: false });

    expect(result.engine).toBe("semantic");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
