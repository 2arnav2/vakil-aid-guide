import { extractCaseFacts, type CaseFacts } from "./search";

/**
 * Turns a free-text case description into a small, deterministic "scene
 * script". The UI component (CaseSceneAnimation) renders this as an animated
 * illustration, so the user can immediately see what the app understood.
 *
 * This module deliberately contains no legal reasoning: it only picks visual
 * facts that are already extracted by the rule engine.
 */

export type SceneKind = "traffic" | "theft" | "cyber" | "assault" | "generic";
export type SceneVehicle = "car" | "truck" | "bike";
export type SceneCueTone = "danger" | "warn" | "info" | "good";

/**
 * How the traffic scene is composed:
 * - collision: two vehicles met (the usual "X hit us" accident)
 * - pedestrian: someone was hit while crossing (one vehicle + zebra stripes)
 * - solo: a fall / skid without another vehicle ("my scooter slipped")
 * - parked: a vehicle is mentioned, but nothing indicates a crash
 */
export type SceneTrafficLayout = "collision" | "pedestrian" | "solo" | "parked";

export interface SceneEnvironment {
  night: boolean;
  rain: boolean;
  /** A traffic signal / junction was mentioned. */
  signal: boolean;
  /** A highway / expressway was mentioned (otherwise a city street is shown). */
  highway: boolean;
}

export interface SceneCue {
  id: string;
  label: string;
  tone: SceneCueTone;
}

export interface SceneScript {
  kind: SceneKind;
  kindLabel: string;
  vehicle: SceneVehicle;
  facts: CaseFacts;
  cues: SceneCue[];
  summary: string;
  /** How the traffic scene is composed (only meaningful for kind "traffic"). */
  trafficLayout?: SceneTrafficLayout;
  environment: SceneEnvironment;
  /** "fast" when speeding was mentioned: wheels spin faster and rush lines show. */
  speed: "normal" | "fast";
  /** Drunk driving was mentioned: the other vehicle wobbles. */
  wobble: boolean;
  showImpact: boolean;
  showFlee: boolean;
  showInjury: boolean;
  showDeath: boolean;
  showBrakeSmoke: boolean;
  showSnatch: boolean;
  /** The user mentioned crossing / pedestrian / zebra area. */
  showPedestrian: boolean;
}

const ROAD_RE =
  /\b(accident|crash\w*|collision|collid\w*|hit\w*|ramm\w*|smash\w*|road|highway|traffic|driver\w*|driv\w*|brake\w*|overspeed\w*|speeding|rash|pedestrian|crossing|helmet|insurance|licen[cs]e|challan)\b/i;
const VEHICLE_RE =
  /\b(car|cars|bike|scooter|scooty|motorcycle|truck|lorry|bus|auto|vehicle|taxi|van|tempo|tractor|jeep|two wheeler)\b/i;
const CYBER_RE =
  /\b(cyber|online|internet|hack\w*|email|password|otp|phishing|malware|ransomware|instagram|facebook|whatsapp|website|social media|upi|net ?banking)\b/i;
const THEFT_RE =
  /\b(theft|stole|steal|stolen|robb\w*|snatch\w*|pickpocket\w*|burglar\w*)\b/i;
const ASSAULT_RE =
  /\b(beat\w*|assault\w*|attack\w*|punch\w*|slap\w*|hit\w*|threat\w*|extort\w*|blackmail\w*|intimidat\w*)\b/i;
const FETCH_RE = /\b(cheat\w*|fraud\w*|scam\w*|online fraud|bank fraud|money was stolen|lost money)\b/i;

// Composition regexes (visual only, never legal):
const ACCIDENT_RE = /\b(accident\w*|crash\w*|collision|collid\w*|smash\w*|ramm\w*)\b/i;
const IMPACT_RE = /\b(hit|hits|knocked|dashed|rammed|struck|collid\w*|smash\w*|ran over|run over|ran into)\b/i;
/** Road context without naming a vehicle ("a drunk driver hit us"). */
const DRIVER_RE = /\b(driv\w*|driver\w*|vehicle)\b/i;
/** A hit aimed at a person ("hit us", "hit by a car") — not "hit a pothole". */
const PERSON_HIT_RE =
  /\b(hit|hits)\s+(us|me|him|her|them|by)\b|\b(knocked|dashed|rammed|struck|collid\w*|smash\w*)\b/i;
const SOLO_RE =
  /\b(slipped|slipping|skidded|skid\w*|slid\w*|lost control|overturned|toppled|fell off|tyre burst|tire burst|pothole)\b/i;
const CROSSING_RE = /\b(crossing|crosswalk|zebra|pedestrian)\b/i;
const NIGHT_RE = /\b(at night|last night|night|midnight|evening|dark)\b/i;
const RAIN_RE = /\b(rain\w*|monsoon|drizz\w*|wet road|road was wet)\b/i;
const SIGNAL_RE = /\b(signal|traffic light|junction|intersection)\b/i;
const HIGHWAY_RE = /\b(highway|expressway|flyover|national highway|ring road|nh[- ]?\d+)\b/i;

const VEHICLE_KIND = (text: string): SceneVehicle => {
  if (/\b(truck|lorry|bus|auto|van|tempo|tractor|jeep)\b/i.test(text)) return "truck";
  if (/\b(bike|scooter|scooty|motorcycle|two wheeler)\b/i.test(text)) return "bike";
  return "car";
};

export const buildSceneScript = (text: string): SceneScript => {
  const facts = extractCaseFacts(text);
  const road = ROAD_RE.test(text);
  const vehicle = VEHICLE_RE.test(text);
  const cyber = CYBER_RE.test(text);
  const theft = THEFT_RE.test(text);
  const assault = ASSAULT_RE.test(text);
  const vehicleKind = VEHICLE_KIND(text);

  let kind: SceneKind = "generic";
  if (cyber && !road) kind = "cyber";
  else if (theft && !road) kind = "theft";
  else if (road && (vehicle || facts.injured || facts.death || facts.brakeFailure || DRIVER_RE.test(text) || ACCIDENT_RE.test(text))) kind = "traffic";
  else if (vehicle && (facts.brakeFailure || facts.fled || facts.overspeeding || facts.wrongSide || facts.injured || facts.death)) {
    kind = "traffic";
  } else if (vehicle) kind = "traffic";
  else if (assault) kind = "assault";

  // Compose the traffic picture from what was actually described.
  let trafficLayout: SceneTrafficLayout | undefined;
  if (kind === "traffic") {
    if (CROSSING_RE.test(text)) trafficLayout = "pedestrian";
    else if (SOLO_RE.test(text) && !PERSON_HIT_RE.test(text)) trafficLayout = "solo";
    else if (IMPACT_RE.test(text) || ACCIDENT_RE.test(text) || facts.brakeFailure) trafficLayout = "collision";
    else trafficLayout = "parked";
  }

  const environment: SceneEnvironment = {
    night: NIGHT_RE.test(text),
    rain: RAIN_RE.test(text),
    signal: SIGNAL_RE.test(text),
    highway: HIGHWAY_RE.test(text),
  };

  const cues: SceneCue[] = [];
  const addCue = (condition: boolean, id: string, label: string, tone: SceneCueTone) => {
    if (condition && !cues.some((cue) => cue.id === id)) cues.push({ id, label, tone });
  };

  if (kind === "traffic") {
    addCue(road || facts.brakeFailure, "collision", "Vehicle collision", "danger");
    addCue(Boolean(facts.brakeFailure), "brake", "Brake failure", "danger");
    addCue(Boolean(facts.fled), "fled", "Driver fled the scene", "warn");
    addCue(Boolean(facts.overspeeding), "speed", "Overspeeding", "warn");
    addCue(Boolean(facts.wrongSide), "wrong-side", "Wrong-side driving", "warn");
    addCue(Boolean(facts.drunk), "drunk", "Drunk driving", "danger");
    addCue(Boolean(facts.noLicence), "no-licence", "No driving licence", "warn");
    addCue(Boolean(facts.uninsured), "no-insurance", "Vehicle not insured", "warn");
    addCue(Boolean(facts.injured), "injury", "Injury mentioned", "danger");
    addCue(Boolean(facts.death), "death", "Death mentioned", "danger");
    addCue(Boolean(facts.property), "vehicle-theft", "Stolen property mentioned", "warn");
  } else if (kind === "theft") {
    const snatch = /\b(snatch\w*|robb\w*|grabbed|loot\w*)\b/i.test(text);
    addCue(true, "theft", "Theft of movable property", "danger");
    addCue(snatch, "snatch", "Snatching / robbery", "danger");
    addCue(/\b(burglar\w*|house.?break\w*|break.?in)\b/i.test(text), "burglary", "House-breaking", "danger");
    addCue(Boolean(facts.threat), "threat", "Threat or intimidation", "warn");
    addCue(Boolean(facts.injured), "injury", "Injury mentioned", "danger");
  } else if (kind === "cyber") {
    addCue(Boolean(facts.unauthorizedAccess) || /\bhack\w*\b/i.test(text), "access", "Unauthorised access", "danger");
    addCue(Boolean(facts.dataTheft), "data", "Personal data at risk", "warn");
    addCue(Boolean(facts.financialLoss) || Boolean(facts.property) || FETCH_RE.test(text), "money", "Financial loss or stolen money", "danger");
    addCue(Boolean(facts.threat), "online-threat", "Online threat", "warn");
  } else if (kind === "assault") {
    addCue(true, "assault", "Physical assault", "danger");
    addCue(Boolean(facts.threat), "threat", "Threats / intimidation", "warn");
    addCue(Boolean(facts.injured), "injury", "Injury mentioned", "danger");
    addCue(Boolean(facts.death), "death", "Death mentioned", "danger");
  } else {
    addCue(true, "general", "General legal issue", "info");
  }

  const kindLabels: Record<SceneKind, string> = {
    traffic: "Road accident scene",
    theft: "Theft scene",
    cyber: "Cyber incident scene",
    assault: "Assault scene",
    generic: "Legal scene",
  };

  return {
    kind,
    kindLabel: kindLabels[kind],
    vehicle: vehicleKind,
    facts,
    cues,
    summary: [kindLabels[kind], ...cues.map((cue) => cue.label)].join(" · "),
    trafficLayout,
    environment,
    speed: facts.overspeeding ? "fast" : "normal",
    wobble: Boolean(facts.drunk),
    showImpact:
      kind === "traffic" && (trafficLayout === "pedestrian" || trafficLayout === "collision"),
    showFlee: kind === "traffic" && Boolean(facts.fled),
    showInjury: Boolean(facts.injured),
    showDeath: Boolean(facts.death),
    showBrakeSmoke: Boolean(facts.brakeFailure),
    showSnatch: kind === "theft" && /\b(snatch\w*|robb\w*|grabbed)\b/i.test(text),
    showPedestrian: kind === "traffic" && CROSSING_RE.test(text),
  };
};
