import { describe, it, expect } from "vitest";
import {
  analyzeLegalCase,
  buildCaseSummary,
  extractResearchTerms,
  searchActs,
  getWhereToFile,
  extractCaseFacts,
  formatConversationAnswers,
  computeAnswerBoost,
  type ConversationContext,
} from "@/lib/search";

const freshContext = (): ConversationContext => ({
  collectedAnswers: {},
  questionsAsked: [],
  readyForResult: false,
});

describe("search engine", () => {
  describe("analyzeLegalCase", () => {
    it("should detect MVA domain for hit by truck overspeeding query", () => {
      const result = analyzeLegalCase(
        "i got hit by the truck it was at the wrong side and overspeeding",
      );
      expect(result.confidence_score).toBeGreaterThanOrEqual(15);
      expect(result.act_name).toContain("Motor Vehicles Act");
      expect(result.section_title).toBeTruthy();
    });

    it("should return sufficient information for MVA hit/truck query", () => {
      const result = analyzeLegalCase(
        "i got hit by the truck it was at the wrong side and overspeeding",
      );
      expect(result.section_title).not.toBe("Insufficient Information");
      expect(result.section_title).not.toBe("Needs Clarification");
      expect(result.applicable_law).toBeTruthy();
      expect(result.simplified_explanation).toBeTruthy();
      expect(result.possible_punishment).toBeTruthy();
      expect(result.what_user_can_do).toBeTruthy();
    });

    it("should detect IPC domain for theft query", () => {
      const result = analyzeLegalCase("someone stole my wallet");
      expect(result.confidence_score).toBeGreaterThanOrEqual(15);
      expect(result.act_name).toContain("Indian Penal Code");
    });

    it("should detect IT Act domain for hacking query", () => {
      const result = analyzeLegalCase("my email was hacked");
      expect(result.confidence_score).toBeGreaterThanOrEqual(15);
      expect(result.act_name).toContain("Information Technology Act");
    });

    it("should return Needs Clarification for unrelated query", () => {
      const result = analyzeLegalCase("the weather is nice today");
      expect(result.confidence_score).toBe(0);
      expect(result.section_title).toBe("Needs Clarification");
    });

    it("should return empty string for empty query", () => {
      const result = analyzeLegalCase("");
      expect(result.confidence_score).toBe(0);
    });

    it("should include ranked section matches with section numbers", () => {
      const result = analyzeLegalCase("someone stole my wallet");
      expect(result.matches?.length).toBeGreaterThan(0);
      expect(result.matches?.[0].sectionNumber).toBeTruthy();
      expect(result.matches?.[0].sectionTitle).toBeTruthy();
      expect(result.matches?.[0].actName).toContain("Indian Penal Code");
    });
  });

  describe("searchActs", () => {
    it("should return results for hit by truck overspeeding query", () => {
      const results = searchActs(
        "i got hit by the truck it was at the wrong side and overspeeding",
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sectionName).toBeTruthy();
      expect(results[0].confidence).toBeGreaterThanOrEqual(15);
      expect(results[0].explanation).toBeTruthy();
      expect(results[0].punishment).toBeTruthy();
    });

    it("should return empty array for unrelated query", () => {
      const results = searchActs("the weather is nice today");
      expect(results.length).toBe(0);
    });

    it("should return results for theft query", () => {
      const results = searchActs("someone stole my phone");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should return multiple IPC sections with visible section numbers", () => {
      const results = searchActs("someone stole my wallet from my bag");
      expect(results.length).toBeGreaterThan(1);
      expect(results[0].sectionName).toMatch(/Section \d+/);
      expect(results.some((r) => /Section (378|379)/.test(r.sectionName))).toBe(true);
      expect(results[0].applicableLaw).toBeTruthy();
      expect(results[0].explanation).toBeTruthy();
    });

    it("should include accident-related IPC sections alongside Motor Vehicles Act sections", () => {
      const results = searchActs(
        "I was hit by a car while crossing the road and the driver ran away without stopping",
      );
      const names = results.map((r) => r.sectionName).join(" | ");

      expect(names).toMatch(/Section 132|Section 134/); // Motor Vehicles Act
      expect(names).toMatch(/Section 279/); // IPC rash driving
      expect(names).toMatch(/Section (337|338|304A)/); // IPC hurt/death by negligence
    });
  });

  describe("multi-turn clarification", () => {
    const MVA_QUERY =
      "I was hit by a car while crossing the road and the driver ran away without stopping";

    it("should ask a clarifying question for a weak MVA match", () => {
      const result = analyzeLegalCase(MVA_QUERY, freshContext());

      expect(result.clarificationFlow?.shouldAsk).toBe(true);
      expect(result.clarificationFlow?.question).toBeTruthy();
      expect(result.clarificationFlow?.questionKey).toBeTruthy();
      expect(result.clarificationFlow?.options?.length).toBeGreaterThan(0);
      expect(result.domain).toBe("mva");
    });

    it("should ask up to four distinct questions, then return a confident result", () => {
      const context = freshContext();
      let result = analyzeLegalCase(MVA_QUERY, context);
      const initialConfidence = result.confidence_score;

      // The first result is a preliminary preview: a question is pending and
      // the UI must not show a final confidence score yet.
      expect(result.preliminary).toBe(true);
      expect(result.confidence_score).toBeLessThanOrEqual(85);

      // Simulate the user answering the questions the engine asks.
      const answered: string[] = [];
      let guard = 0;
      while (result.clarificationFlow?.shouldAsk && guard < 10) {
        const flow = result.clarificationFlow;
        const key = flow.questionKey!;
        const options = flow.options ?? [];
        // Pick the strongest option where available ("Fled / Hit-and-run").
        const answer = options.find((o) => /fled/i.test(o)) ?? options[0] ?? "Yes";

        context.collectedAnswers[key] = answer;
        context.questionsAsked.push(key);
        answered.push(key);

        result = analyzeLegalCase(MVA_QUERY, context);
        guard++;
      }

      // Accident cases get a short interview: more than one question, at most
      // four, and every question asked only once.
      expect(guard).toBeGreaterThan(1);
      expect(guard).toBeLessThanOrEqual(4);
      expect(new Set(answered).size).toBe(answered.length);
      expect(result.clarificationFlow?.shouldAsk).toBe(false);
      expect(result.preliminary).toBeFalsy();
      expect(result.domain).toBe("mva");
      expect(result.act_name).toContain("Motor Vehicles Act");
      expect(result.section_title).not.toBe("Insufficient Information");
      expect(result.confidence_score).toBeGreaterThan(initialConfidence);
      expect(result.confidence_score).toBeGreaterThanOrEqual(70);
    });

    it("asks a different follow-up question when the first answer was unhelpful", () => {
      const context: ConversationContext = {
        collectedAnswers: { injured: "Not sure" },
        questionsAsked: ["injured"],
        readyForResult: false,
      };

      // The interview continues, but never with a question already asked.
      const result = analyzeLegalCase("there was an accident on the road", context);
      expect(result.clarificationFlow?.shouldAsk).toBe(true);
      expect(result.clarificationFlow?.questionKey).not.toBe("injured");
      expect(result.preliminary).toBe(true);
    });

    it("asks about the FIR first in the reference interview order", () => {
      const context: ConversationContext = {
        collectedAnswers: { injured: "Yes", hit_and_run: "Stopped" },
        questionsAsked: ["injured", "hit_and_run"],
        readyForResult: false,
      };

      const result = analyzeLegalCase("a bus hit our auto near the market", context);
      expect(result.clarificationFlow?.shouldAsk).toBe(true);
      expect(result.clarificationFlow?.questionKey).toBe("fir");
    });

    it("asks about the driver's licence once the reference facts are covered", () => {
      const context: ConversationContext = {
        collectedAnswers: {
          fir: "FIR filed",
          witnesses: "witnesses available",
          evidence: "evidence available",
          insurance: "insurance active",
          injured: "No injury",
          hit_and_run: "Stopped",
          drunk: "No alcohol",
        },
        questionsAsked: [],
        readyForResult: false,
      };

      const result = analyzeLegalCase("a car hit my scooter on the highway", context);
      expect(result.clarificationFlow?.shouldAsk).toBe(true);
      expect(result.clarificationFlow?.questionKey).toBe("licence");
    });

    it("stops after four questions even when facts are still missing", () => {
      const context: ConversationContext = {
        collectedAnswers: {
          injured: "Not sure",
          hit_and_run: "Not sure",
          drunk: "Not sure",
          licence: "Not sure",
        },
        questionsAsked: ["injured", "hit_and_run", "drunk", "licence"],
        readyForResult: false,
      };

      const result = analyzeLegalCase("there was an accident on the road", context);
      expect(result.clarificationFlow?.shouldAsk ?? false).toBe(false);
      expect(result.preliminary).toBeFalsy();
    });

    it("treats a skipped question as final and gives it no confidence boost", () => {
      const context: ConversationContext = {
        collectedAnswers: { injured: "Skip — show best answer" },
        questionsAsked: ["injured"],
        // Skipping ends the whole interview: the UI sets this flag.
        readyForResult: true,
      };

      const result = analyzeLegalCase("a truck hit us on the road", context);

      expect(result.clarificationFlow?.shouldAsk).toBe(false);
      expect(result.preliminary).toBeFalsy();
      // Skipping adds no facts, so it must not inflate the score...
      expect(computeAnswerBoost(context)).toBe(0);
      // ...unlike a real answer.
      expect(
        computeAnswerBoost({
          ...context,
          collectedAnswers: { injured: "Yes" },
        }),
      ).toBeGreaterThan(0);
    });

    it("should resolve an unclear query after the incident-type answer", () => {
      const context = freshContext();
      const first = analyzeLegalCase("something happened to me yesterday", context);

      expect(first.clarificationFlow?.questionKey).toBe("incident_type");
      expect(first.clarificationFlow?.shouldAsk).toBe(true);

      context.collectedAnswers.incident_type = "Road / traffic accident";
      context.questionsAsked.push("incident_type");

      const second = analyzeLegalCase("something happened to me yesterday", context);
      expect(second.domain).toBe("mva");
    });

    it("should not repeat the incident-type question once it has been answered", () => {
      const context: ConversationContext = {
        collectedAnswers: { incident_type: "Something else" },
        questionsAsked: ["incident_type"],
        readyForResult: false,
      };

      const result = analyzeLegalCase("something happened to me yesterday", context);
      expect(result.clarificationFlow?.shouldAsk).toBe(false);
    });

    it("should pass collected answers through searchActs", () => {
      const context = freshContext();
      context.collectedAnswers = {
        injured: "Yes",
        hit_and_run: "Fled / Hit-and-run",
        wrong_side: "Yes",
        overspeeding: "Yes",
      };
      context.questionsAsked = ["injured", "hit_and_run", "wrong_side", "overspeeding"];

      const results = searchActs(MVA_QUERY, context);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sectionName).toMatch(/Section \d+/);
      expect(results[0].whereToFile).toMatch(/Traffic Police/i);
    });
  });

  describe("getWhereToFile", () => {
    it("should return traffic police guidance for MVA cases", () => {
      expect(getWhereToFile("mva")).toMatch(/Traffic Police/i);
      expect(getWhereToFile("mva")).toMatch(/Motor Accident Claims Tribunal/i);
    });

    it("should return cyber crime guidance for IT Act cases", () => {
      expect(getWhereToFile("it_act")).toMatch(/Cyber Crime/i);
    });

    it("should return police station guidance for IPC cases", () => {
      expect(getWhereToFile("ipc")).toMatch(/Police Station/i);
    });
  });

  describe("free-text fact understanding", () => {
    it("understands 'yes me and my wife' as two injured people", () => {
      const facts = extractCaseFacts("yes me and my wife");
      expect(facts.injured).toBe(true);
      expect(facts.injuredCount).toBe(2);
      expect(facts.injuredWith).toMatch(/wife/i);
    });

    it("detects brake failure from natural phrasing", () => {
      expect(extractCaseFacts("the truck brakes failed").brakeFailure).toBe(true);
      expect(extractCaseFacts("the brakes had a problem").brakeFailure).toBe(true);
      expect(extractCaseFacts("there was no brake").brakeFailure).toBe(true);
      // A bare verb is not a defect: "I had to brake suddenly" is normal driving.
      expect(extractCaseFacts("I had to brake suddenly").brakeFailure).toBeFalsy();
    });

    it("does not treat 'brakes were working fine' as a failure", () => {
      expect(extractCaseFacts("the brakes were working fine").brakeFailure).toBeFalsy();
    });

    it("skips the injury question when the query already says who was hurt", () => {
      const result = analyzeLegalCase("a truck hit us and me and my wife were injured");
      expect(result.clarificationFlow?.shouldAsk).toBe(true);
      expect(result.clarificationFlow?.questionKey).not.toBe("injured");
    });

    it("uses a typed answer as the injury fact and moves on", () => {
      const query = "a truck hit us on the road";
      const context: ConversationContext = {
        collectedAnswers: {},
        questionsAsked: [],
        readyForResult: false,
      };

      const first = analyzeLegalCase(query, context);
      expect(first.clarificationFlow?.questionKey).toBe("fir");

      context.collectedAnswers.fir = "Not yet";
      context.questionsAsked.push("fir");
      context.collectedAnswers.injured = "yes me and my wife";
      context.questionsAsked.push("injured");

      const second = analyzeLegalCase(query, context);
      expect(second.facts?.injuredCount).toBe(2);
      expect(second.clarificationFlow?.questionKey).not.toBe("injured");
    });

    it("includes the unsafe-vehicle section when brake failure is mentioned", () => {
      const result = analyzeLegalCase("a truck hit us because its brakes failed");
      const sections = (result.matches ?? []).map((m) => `${m.sectionNumber}:${m.sectionTitle}`);
      expect(sections.some((s) => s.startsWith("190:"))).toBe(true);
    });

    it("builds a personalised summary and a balanced liability note", () => {
      const result = analyzeLegalCase(
        "a truck hit us, me and my wife were injured, and the truck's brakes failed",
      );
      expect(result.caseSummary).toMatch(/you and your wife were injured/i);
      expect(result.caseSummary).toMatch(/2 people/i);
      expect(result.caseSummary).toMatch(/brakes failed/i);
      expect(result.liabilityNotes).toMatch(/Section 190/);
      expect(result.liabilityNotes).toMatch(/unforeseen/i);
    });

    it("captures FIR, witnesses, evidence and insurance for the summary and terms", () => {
      const facts = extractCaseFacts(
        "No FIR was filed. There were no witnesses. I don't have any evidence. I have car insurance.",
      );

      expect(facts.firFiled).toBe(false);
      expect(facts.witnesses).toBe(false);
      expect(facts.evidence).toBe(false);
      expect(facts.uninsured).toBe(false);

      const summary = buildCaseSummary(facts);
      expect(summary).toMatch(/No FIR has been filed/i);
      expect(summary).toMatch(/No witnesses are available/i);
      expect(summary).toMatch(/No documentary evidence/i);
      expect(summary).toMatch(/vehicle was insured/i);

      const terms = extractResearchTerms(
        "No FIR was filed. There were no witnesses. I don't have any evidence. I have car insurance.",
        "mva",
        facts,
      );
      expect(terms).toEqual(
        expect.arrayContaining(["no FIR", "no witnesses", "no evidence", "insurance"]),
      );
    });

    it("does not let a negative answer inflate confidence like a positive one", () => {
      const negative = computeAnswerBoost({
        collectedAnswers: { witnesses: "No witnesses" },
        questionsAsked: ["witnesses"],
      });
      const positive = computeAnswerBoost({
        collectedAnswers: { witnesses: "Yes, I have witnesses" },
        questionsAsked: ["witnesses"],
      });

      expect(negative).toBeLessThan(positive);
    });
  });

  describe("conversation answer formatting", () => {
    it("labels AI-generated questions with their stored text", () => {
      const text = formatConversationAnswers({
        collectedAnswers: { ai_1: "yes", ai_2: "Fled / Hit-and-run" },
        questionsAsked: ["ai_1", "ai_2"],
        questionTexts: {
          ai_1: "Were you and your wife injured?",
          ai_2: "Did the driver stop after the accident?",
        },
        readyForResult: false,
      });

      expect(text).toContain("Q: Were you and your wife injured?\nA: yes");
      expect(text).toContain("Q: Did the driver stop after the accident?\nA: Fled / Hit-and-run");
    });

    it("uses built-in labels for scripted questions", () => {
      const text = formatConversationAnswers({
        collectedAnswers: { injured: "Yes" },
        questionsAsked: ["injured"],
        readyForResult: false,
      });

      expect(text).toContain("Q: Was anyone injured in the accident?\nA: Yes");
    });

    it("skips empty answers and handles a missing context", () => {
      expect(formatConversationAnswers(undefined)).toBe("");
      expect(
        formatConversationAnswers({
          collectedAnswers: { injured: "   " },
          questionsAsked: [],
          readyForResult: false,
        }),
      ).toBe("");
    });
  });
});
