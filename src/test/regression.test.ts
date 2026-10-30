import { describe, expect, it } from "vitest";
import actsData from "@/assets/acts.json";
import embeddingsData from "@/assets/section-embeddings.json";
import { analyzeLegalCase, extractCaseFacts, type Act, type ConversationContext } from "@/lib/search";
import { buildGeminiResult, parseGeminiJson, type GeminiAnalysis } from "@/lib/gemini";
import { buildSceneScript } from "@/lib/scene";

const acts = actsData as Act[];

const sectionId = (act: Act) => `${act.act_name}|${act.section_number}`;

describe("domain disambiguation regressions", () => {
  it("keeps a stolen car in the IPC domain", () => {
    const result = analyzeLegalCase("my car was stolen");
    expect(result.domain).toBe("ipc");
    expect(result.act_name).toContain("Indian Penal Code");
  });

  it("keeps an assault without a vehicle in the IPC domain", () => {
    const result = analyzeLegalCase("someone hit me on the road");
    expect(result.domain).toBe("ipc");
    expect(result.act_name).toContain("Indian Penal Code");
  });

  it("does not let an injury move a stolen car into the MVA domain", () => {
    const result = analyzeLegalCase("my car was stolen and I was injured");
    expect(result.domain).toBe("ipc");
  });

  it("keeps a hacking-plus-theft case in the IT Act domain", () => {
    const result = analyzeLegalCase("my email was hacked and money was stolen");
    expect(result.domain).toBe("it_act");
    expect(result.act_name).toContain("Information Technology Act");
  });

  it("still classifies a genuine road accident as MVA", () => {
    const result = analyzeLegalCase("the truck hit me from the wrong side and drove away");
    expect(result.domain).toBe("mva");
    expect(result.act_name).toContain("Motor Vehicles Act");
  });

  it("does not treat a bare 'brake' action as a brake failure", () => {
    const facts = extractCaseFacts("I had to brake suddenly to avoid a dog");
    expect(facts.brakeFailure).toBeFalsy();
  });

  it("treats a fractured limb as an injury and grievous hurt", () => {
    const facts = extractCaseFacts("my scooter slipped on a wet road and I fractured my arm");
    expect(facts.injured).toBe(true);
    expect(facts.grievous).toBe(true);
  });
});

describe("question flow regressions (one-question cap)", () => {
  it("skips the question entirely when a non-accident match is already strong", () => {
    const theft = analyzeLegalCase("my wallet was stolen in the market");
    expect(theft.domain).toBe("ipc");
    expect(theft.clarificationFlow?.shouldAsk ?? false).toBe(false);
  });

  it("asks exactly one question for a weaker cyber match, then stops", () => {
    const query = "my email was hacked and money was stolen";
    const first = analyzeLegalCase(query);
    expect(first.domain).toBe("it_act");
    // Score is below the strong-match threshold, so one question is allowed...
    expect(first.clarificationFlow?.shouldAsk).toBe(true);
    expect(first.preliminary).toBe(true);

    const key = first.clarificationFlow!.questionKey!;
    const second = analyzeLegalCase(query, {
      collectedAnswers: { [key]: "Not sure" },
      questionsAsked: [key],
      readyForResult: false,
    });

    // ...but never a second one, even though the answer was unhelpful.
    expect(second.clarificationFlow?.shouldAsk ?? false).toBe(false);
    expect(second.preliminary).toBeFalsy();
  });

  it("keeps asking useful accident questions, up to four, and marks them preliminary", () => {
    const query = "a scooter hit me near the signal";
    const first = analyzeLegalCase(query);
    expect(first.domain).toBe("mva");
    expect(first.clarificationFlow?.shouldAsk).toBe(true);
    expect(first.preliminary).toBe(true);

    const context: ConversationContext = {
      collectedAnswers: {},
      questionsAsked: [],
      readyForResult: false,
    };
    let result = first;
    const keys: string[] = [];
    let guard = 0;
    while (result.clarificationFlow?.shouldAsk && guard < 6) {
      const key = result.clarificationFlow.questionKey!;
      keys.push(key);
      context.collectedAnswers[key] = "Not sure";
      context.questionsAsked.push(key);
      result = analyzeLegalCase(query, context);
      guard++;
    }

    // The old one-question cap is gone: more than one question, at most four,
    // and never the same question twice.
    expect(keys.length).toBeGreaterThan(1);
    expect(keys.length).toBeLessThanOrEqual(4);
    expect(new Set(keys).size).toBe(keys.length);
    expect(result.clarificationFlow?.shouldAsk ?? false).toBe(false);
    expect(result.preliminary).toBeFalsy();
  });
});

describe("scene script", () => {
  it("renders a theft scene for a stolen car", () => {
    const script = buildSceneScript("my car was stolen last night");
    expect(script.kind).toBe("theft");
    expect(script.vehicle).toBe("car");
    expect(script.cues.some((cue) => cue.label.includes("Theft"))).toBe(true);
  });

  it("renders a cyber scene for a hacked account with stolen money", () => {
    const script = buildSceneScript("my email was hacked and money was stolen");
    expect(script.kind).toBe("cyber");
    expect(script.cues.some((cue) => cue.label.includes("Financial"))).toBe(true);
  });

  it("renders a traffic scene with truck, fled and injury cues", () => {
    const script = buildSceneScript("the truck hit us and the driver fled, my wife was injured");
    expect(script.kind).toBe("traffic");
    expect(script.vehicle).toBe("truck");
    expect(script.showFlee).toBe(true);
    expect(script.showInjury).toBe(true);
  });

  it("renders a bike traffic scene for a scooter injury", () => {
    const script = buildSceneScript("my scooter slipped on the road and I was injured");
    expect(script.kind).toBe("traffic");
    expect(script.vehicle).toBe("bike");
  });

  it("shows a pedestrian when crossing is mentioned", () => {
    const script = buildSceneScript("a car hit me while crossing the road");
    expect(script.kind).toBe("traffic");
    expect(script.showPedestrian).toBe(true);
  });

  it("composes a solo accident when only one vehicle fell", () => {
    const script = buildSceneScript("my scooter slipped on the road and I was injured");
    expect(script.kind).toBe("traffic");
    expect(script.trafficLayout).toBe("solo");
    expect(script.showImpact).toBe(false);
  });

  it("composes a pedestrian scene for a crossing accident", () => {
    const script = buildSceneScript("a car hit me while crossing the road");
    expect(script.trafficLayout).toBe("pedestrian");
  });

  it("composes a two-vehicle collision by default", () => {
    const script = buildSceneScript("the truck hit us and the driver fled");
    expect(script.trafficLayout).toBe("collision");
    expect(script.showImpact).toBe(true);
  });

  it("composes a parked scene when no crash is described", () => {
    const script = buildSceneScript("two people were sitting in the car");
    expect(script.trafficLayout).toBe("parked");
    expect(script.showImpact).toBe(false);
  });

  it("reads the environment (signal, night, rain, highway) from the description", () => {
    const city = buildSceneScript("the truck hit us near the signal at night in the rain");
    expect(city.environment.signal).toBe(true);
    expect(city.environment.night).toBe(true);
    expect(city.environment.rain).toBe(true);
    expect(city.environment.highway).toBe(false);

    const away = buildSceneScript("the truck hit us on the national highway");
    expect(away.environment.highway).toBe(true);
  });

  it("marks speeding as fast and drunk driving as wobble", () => {
    const script = buildSceneScript("a drunk driver was overspeeding when he hit us");
    expect(script.kind).toBe("traffic");
    expect(script.speed).toBe("fast");
    expect(script.wobble).toBe(true);
  });

  it("keeps a drunk driver without a named vehicle in the traffic scene", () => {
    const script = buildSceneScript("a drunk driver hit us");
    expect(script.kind).toBe("traffic");
    expect(script.trafficLayout).toBe("collision");
    expect(script.wobble).toBe(true);
  });

  it("adds licence and insurance cues when the other driver lacked them", () => {
    const script = buildSceneScript(
      "the truck hit us and the driver had no licence and no insurance",
    );
    expect(script.kind).toBe("traffic");
    expect(script.cues.some((cue) => /licence/i.test(cue.label))).toBe(true);
    expect(script.cues.some((cue) => /insur/i.test(cue.label))).toBe(true);
  });

  it("renders an assault scene for a bare hit", () => {
    const script = buildSceneScript("someone hit me near the market");
    expect(script.kind).toBe("assault");
  });

  it("falls back to the generic scene for a non-criminal dispute", () => {
    const script = buildSceneScript("my landlord is not returning my security deposit");
    expect(script.kind).toBe("generic");
  });

  it("does not invent an injury for passenger counts without injury words", () => {
    const script = buildSceneScript("two people were sitting in the car");
    expect(script.showInjury).toBe(false);
    expect(script.cues.some((cue) => cue.label.includes("Injury"))).toBe(false);
  });

  it("summarises what the screen shows", () => {
    const script = buildSceneScript("the truck's brakes failed and it hit us");
    expect(script.summary).toContain("Road accident scene");
    expect(script.summary).toContain("Brake failure");
  });
});

describe("bundled legal data integrity", () => {
  it("has one row per act and section", () => {
    expect(acts.length).toBeGreaterThan(0);
    const keys = acts.map(sectionId);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps required text fields on every row", () => {
    for (const act of acts) {
      expect(act.act_name?.trim().length, `act_name for ${sectionId(act)}`).toBeGreaterThan(0);
      expect(act.section_number?.trim().length, `section_number for ${sectionId(act)}`).toBeGreaterThan(0);
      expect(act.section_title?.trim().length, `section_title for ${sectionId(act)}`).toBeGreaterThan(0);
      expect(act.domain?.trim().length, `domain for ${sectionId(act)}`).toBeGreaterThan(0);
    }
  });

  it("merged duplicate sections without losing keywords", () => {
    const mva8 = acts.filter((act) => sectionId(act) === "Motor Vehicles Act, 1988|8");
    expect(mva8).toHaveLength(1);
    expect(mva8[0].keywords).toContain("learner licence refusal");
    expect(mva8[0].keywords).toContain("apply learner licence");

    const mva203 = acts.filter((act) => sectionId(act) === "Motor Vehicles Act, 1988|203");
    expect(mva203).toHaveLength(1);
    expect(mva203[0].section_title).toBe("Breath tests");
  });

  it("keeps embeddings aligned index-by-index with acts.json", () => {
    expect(embeddingsData.ids.length).toBe(acts.length);
    expect(embeddingsData.vectors.length).toBe(acts.length);
    embeddingsData.ids.forEach((id, index) => {
      expect(id).toBe(sectionId(acts[index]));
      expect(embeddingsData.vectors[index]).toHaveLength(embeddingsData.dimensions);
    });
  });
});

describe("malformed AI output is rejected safely", () => {
  const local = analyzeLegalCase("the truck's brakes failed and it hit us");

  it("parseGeminiJson rejects arrays, scalars and null", () => {
    expect(parseGeminiJson("[1,2,3]")).toBeNull();
    expect(parseGeminiJson("42")).toBeNull();
    expect(parseGeminiJson("null")).toBeNull();
    expect(parseGeminiJson('"just a string"')).toBeNull();
  });

  it("drops non-string matches and invalid sections", () => {
    const malformed = {
      case_summary: 42,
      facts: ["injured"],
      matches: [
        "not an object",
        null,
        { act: 7, section: { nope: true }, confidence: "abc", reason: 9 },
        {
          act: "Motor Vehicles Act, 1988",
          section: 190,
          confidence: "88",
          reason: { text: "unsafe vehicle" },
        },
      ],
      clarification_question: "Was anyone hurt?",
      clarification_options: ["Yes", 3, "No", null],
    } as unknown as GeminiAnalysis;

    const result = buildGeminiResult("truck hit us", undefined, malformed, local, "test-model", "mva");
    expect(result).not.toBeNull();
    expect(result?.matches).toHaveLength(1);
    expect(result?.matches?.[0].sectionNumber).toBe("190");
    expect(typeof result?.matches?.[0].reasons[0]).toBe("string");
    expect(result?.caseSummary).toBeTruthy();
    expect(result?.clarificationFlow?.options).toEqual(["Yes", "No"]);
  });

  it("returns null instead of throwing when all matches are unusable", () => {
    const malformed = {
      matches: [{ act: 1, section: 2, confidence: 90, reason: null }],
      facts: { injured: "yes" },
    } as unknown as GeminiAnalysis;

    expect(buildGeminiResult("", undefined, malformed, local)).toBeNull();
  });
});
