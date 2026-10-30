
import actsData from "@/assets/acts.json";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ClarificationQuestion {
    question: string;
    options?: string[];
}

export interface LegalCaseAnalysis {
    section_number: string;
    section_title: string;
    act_name: string;
    confidence_score: number;
    reasoning_summary: string;
    applicable_law: string;
    simplified_explanation: string;
    possible_punishment: string;
    what_user_can_do: string;
    clarification_question_if_needed?: string;
}

export interface Act {
    section_number: string;
    section_title: string;
    act_name: string;
    simplified_explanation: string;
    official_text: string;
    keywords: string[];
    punishment: string;
    legal_procedure_guidance: string;
    domain?: string;
}

export interface ConversationContext {
    domain?: string;
    collectedAnswers: Record<string, string>;
    questionsAsked: string[];
    /**
     * The text of each question that was asked, keyed by question key.
     * This keeps AI-generated questions ("ai_1", "ai_2") meaningful when the
     * answers are sent back on the next turn.
     */
    questionTexts?: Record<string, string>;
    readyForResult: boolean;
}

export interface ClarificationFlow {
    shouldAsk: boolean;
    question?: string;
    questionKey?: string;
    options?: string[];
}

type SearchResult = {
    id: string;
    sectionName: string;
    confidence: number;
    applicableLaw: string;
    explanation: string;
    punishment: string;
    whatToDo: string;
    whereToFile: string;
    keywords: string[];
    matchReason: string;
};

// ── NLP & Domain Constants ──────────────────────────────────────────────────

const DOMAIN_KEYWORDS = {
    ipc: [
        "theft", "stole", "steal", "stolen", "murder", "kill", "death", "beat", "assault", "hurt",
        "injury", "injured", "injur", "wound", "wounded", "cheat", "fraud", "forgery", "rape", "dowry", "cruelty", "husband",
        "wife", "marriage", "threat", "extortion", "robbery", "robbed", "dacoity", "kidnap",
        "trespass", "defamation", "neighbor", "money", "house",
        "phone", "mobile", "snatched", "snatching", "grabbed", "pickpocket", "purse", "wallet",
        "burglary", "burglar"
    ],
    it_act: [
        "computer", "internet", "cyber", "online", "email", "password", "hack",
        "hacking", "data", "website", "bank account", "digital", "photo", "photos", "video",
        "viral", "privacy", "identity", "instagram", "facebook", "whatsapp",
        "social media", "posted", "profile", "message", "chat"
    ],
    mva: [
        "drive", "driving", "car", "bike", "scooter", "truck", "bus", "vehicle",
        "road", "traffic", "signal", "accident", "crash", "hit", "licence",
        "license", "insurance", "helmet", "seatbelt", "drink", "drunk", "alcohol",
        "lorry", "auto", "collision", "collide", "collided", "rammed", "smashed", "ploughed"
    ]
};

// Strong intent signals used to disambiguate domains before scoring. These are
// exported so the semantic fallback in analyze.ts uses the same rules.
export const THEFT_INTENT_TERMS = [
    "theft", "stole", "steal", "stolen", "robbed", "robbery", "snatched",
    "snatching", "pickpocket", "pickpocketed", "burglary", "burglar",
];
export const CYBER_INTENT_TERMS = [
    "cyber", "online", "internet", "hack", "hacked", "hacking", "email",
    "password", "otp", "phishing", "malware", "ransomware", "instagram",
    "facebook", "whatsapp", "website", "social",
];
export const VEHICLE_TERMS = [
    "car", "bike", "scooter", "truck", "bus", "lorry", "auto", "vehicle",
    "motorcycle", "taxi", "van", "tempo", "tractor", "jeep",
];
export const ACCIDENT_TERMS = [
    "accident", "crash", "collision", "collided", "collide", "hit", "rammed",
    "smashed", "road", "traffic", "driver", "driving", "drove", "brake",
    "brakes", "overspeed", "overspeeding", "speeding", "rash", "pedestrian",
    "helmet", "insurance", "licence", "license", "injury", "injured",
    "injuries", "hurt", "injur",
];

const theftTermSet = new Set(THEFT_INTENT_TERMS);
const cyberTermSet = new Set(CYBER_INTENT_TERMS);
const vehicleTermSet = new Set(VEHICLE_TERMS);
const injuryTermSet = new Set(["injury", "injured", "injuries", "hurt", "injur"]);
// Road context for disambiguation ignores injury words: a stolen car plus an
// injured owner is still a theft case, not an unsafe-vehicle case.
const roadAccidentTermSet = new Set(
    ACCIDENT_TERMS.filter((term) => !injuryTermSet.has(term)),
);

const STOP_WORDS = new Set([
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by",
    "is", "am", "are", "was", "were", "be", "been", "being",
    "i", "me", "my", "we", "us", "our", "you", "your", "he", "him", "his",
    "she", "her", "it", "its", "they", "them", "their",
    "and", "but", "or", "so", "because", "if", "when", "where", "how", "why",
    "what", "which", "who", "whom", "whose", "this", "that", "these", "those",
    "please", "help", "can", "could", "would"
]);

const SYNONYM_MAP: Record<string, string[]> = {
    // IPC
    "stole": ["theft", "theft", "dishonest"], // Double weight on intent
    "steal": ["theft"],
    "stolen": ["theft", "theft", "dishonest"],
    "taking": ["theft"],
    "kill": ["murder", "culpable homicide", "death"],
    "killed": ["murder", "culpable homicide"],
    "beat": ["assault", "hurt"],
    "hit": ["assault", "hurt"], // Context dependent (MVA vs IPC)
    "injured": ["hurt", "injury"],
    "injury": ["hurt", "grievous"],
    "wound": ["hurt", "injury"],
    "wounded": ["hurt", "injury"],
    "hurt": ["injury"],
    "cheat": ["cheating", "dishonest"],
    "fraud": ["cheating", "forgery"],
    "threat": ["extortion", "criminal intimidation"],
    "fear": ["extortion", "robbery"],

    // IT Act
    "hacked": ["hacking", "unauthorised access"],
    "password": ["security", "access"],

    // MVA
    "drunk": ["drink driving", "alcohol"],
    "drank": ["drink driving"],
    "crash": ["accident"],
    "ran": ["fled"],
    "fled": ["run", "accident"],
    "away": ["fled"],
    "car": ["vehicle", "motor vehicle"],
    "truck": ["vehicle", "motor vehicle"],
    "bus": ["vehicle", "motor vehicle"],
    "bike": ["vehicle", "motorcycle"],
    "overspeeding": ["overspeed", "speeding", "rash driving"],
    "overspeed": ["speeding", "rash driving"],
    "rash": ["overspeeding", "rash driving"],
    "speeding": ["overspeeding", "rash driving"],
    "lorry": ["truck", "vehicle", "motor vehicle"],
    "auto": ["vehicle", "motor vehicle"],
    "rammed": ["hit", "crash", "accident"],
    "ram": ["hit", "crash"],
    "smashed": ["hit", "crash", "accident"],
    "collided": ["hit", "crash", "accident"],
    "collision": ["accident", "crash"],
    "ploughed": ["hit", "crash"],
    "vanished": ["fled", "run"],
    "sped": ["fled", "speeding"],
    "grabbed": ["theft", "robbery", "snatching"],
    "snatched": ["theft", "robbery", "snatching"],
    "snatching": ["theft", "robbery"],
    "burglary": ["theft", "house-breaking"],
    "burglar": ["theft", "house-breaking"],
    "phone": ["property", "theft"],
    "mobile": ["property", "theft"],
    "posted": ["publishing", "privacy"],
    "photos": ["privacy", "publishing"],
    "private": ["privacy"],
};

// IPC sections that apply to road accidents in addition to the Motor Vehicles Act
export const ACCIDENT_IPC_SECTIONS = new Set(["279", "304A", "337", "338", "427"]);

// A result that still needs clarification is deliberately capped below the
// final confidence so the UI never shows "97% sure" while asking a question.
const PRELIMINARY_CONFIDENCE_CAP = 85;

// Accident-focused UX rule: road-accident cases get a short interview of up to
// four genuinely useful questions — one at a time, only facts that are still
// unknown. Other domains keep the lighter single-question rule. Skipping
// (`readyForResult`) ends the interview and shows the best available answer.
export const MAX_CLARIFICATION_QUESTIONS = 4;

/** The reference UI shows five verified provisions by default. */
export const MAX_VISIBLE_SECTIONS = 5;

// Question order per domain, matching the reference interview:
// FIR → witnesses → evidence → insurance, then the remaining accident facts.
const QUESTION_PRIORITY: Record<string, string[]> = {
    mva: ["fir", "witnesses", "evidence", "insurance", "injured", "hit_and_run", "drunk", "licence", "overspeeding", "wrong_side", "vehicle_type"],
    ipc: ["injured", "property", "threat"],
    it_act: ["unauthorized_access", "data_theft", "financial_loss"],
};

// ── Domain-Specific Clarification Questions ──────────────────────────────────

export const CLARIFICATION_QUESTIONS: Record<string, { question: string; key: string; options?: string[] }[]> = {
    mva: [
        { question: "Have you filed a police complaint (FIR) about the accident?", key: "fir", options: ["Filed", "Not yet", "Planning to file"] },
        { question: "Were there witnesses who saw what happened? Can you provide their contact details or descriptions?", key: "witnesses", options: ["Yes, I have witnesses", "No witnesses", "Not sure"] },
        { question: "Do you have evidence like photos, videos, medical records, or CCTV footage? This strengthens your case.", key: "evidence", options: ["Yes, I have evidence", "No evidence", "Not sure"] },
        { question: "Was the other vehicle insured? Have you contacted the insurance company?", key: "insurance", options: ["Insured", "Not insured", "Not sure"] },
        { question: "Was anyone injured in the accident?", key: "injured", options: ["Yes", "No", "Not sure"] },
        { question: "Did the driver stop after the accident or flee the scene?", key: "hit_and_run", options: ["Stopped", "Fled / Hit-and-run", "Not sure"] },
        { question: "Was the driver under the influence of alcohol?", key: "drunk", options: ["Yes", "No", "Not sure"] },
        { question: "Did the other driver have a valid licence?", key: "licence", options: ["Valid licence", "No licence", "Not sure"] },
        { question: "Was the driver overspeeding or driving recklessly?", key: "overspeeding", options: ["Yes", "No", "Not sure"] },
        { question: "Was the vehicle being driven on the wrong side of the road?", key: "wrong_side", options: ["Yes", "No", "Not sure"] },
        { question: "What kind of vehicle hit you?", key: "vehicle_type", options: ["Car", "Bike / Scooter", "Truck", "Bus", "Not sure"] },
    ],
    ipc: [
        { question: "Was anyone physically injured or assaulted?", key: "injured", options: ["Yes", "No", "Not sure"] },
        { question: "Was any property stolen or damaged?", key: "property", options: ["Yes", "No", "Not sure"] },
        { question: "Were any threats or intimidation involved?", key: "threat", options: ["Yes", "No", "Not sure"] },
    ],
    it_act: [
        { question: "Was there unauthorized access to your computer or accounts?", key: "unauthorized_access", options: ["Yes", "No", "Not sure"] },
        { question: "Was any personal data stolen or leaked?", key: "data_theft", options: ["Yes", "No", "Not sure"] },
        { question: "Did you suffer financial loss due to the incident?", key: "financial_loss", options: ["Yes", "No", "Not sure"] },
    ],
};

const QUESTION_LABELS: Record<string, string> = Object.values(CLARIFICATION_QUESTIONS)
    .flat()
    .reduce<Record<string, string>>(
        (labels, item) => {
            if (!labels[item.key]) labels[item.key] = item.question;
            return labels;
        },
        { incident_type: "What kind of incident was this?" },
    );

/**
 * Format collected answers as labelled Q/A blocks.
 *
 * Answers like "yes" are ambiguous on their own. When a question was generated
 * by Google AI its key is opaque ("ai_1"), so the UI stores the question text in
 * `questionTexts`; that text is used here. Scripted questions fall back to the
 * labels above.
 */
export const formatConversationAnswers = (context?: ConversationContext): string => {
    if (!context?.collectedAnswers) return "";

    return Object.entries(context.collectedAnswers)
        .filter(([, answer]) => Boolean(answer && answer.trim()))
        .map(([key, answer]) => {
            const question =
                context.questionTexts?.[key]?.trim() ||
                QUESTION_LABELS[key] ||
                key.replace(/_/g, " ");
            return `Q: ${question}\nA: ${answer.trim()}`;
        })
        .join("\n\n");
};

/** Raw answer values only. Used for local fact extraction, not for prompts. */
export const conversationAnswerValues = (context?: ConversationContext): string =>
    Object.values(context?.collectedAnswers ?? {})
        .map((answer) => answer.trim())
        .filter(Boolean)
        .join("\n");

// ── Stemming Helper ──────────────────────────────────────────────────────────

const getStem = (word: string): string => {
    if (word.endsWith("ing") && word.length > 4) return word.slice(0, -3);
    if (word.endsWith("ed") && word.length > 3) return word.slice(0, -2);
    if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
    return word;
};

// ── Answer → Scoring Signals ─────────────────────────────────────────────────

const ANSWER_TOKEN_MAP: Record<string, string> = {
    // MVA
    injured: "injury hurt accident",
    hit_and_run: "hit run accident stop",
    wrong_side: "wrong side rash dangerous",
    overspeeding: "overspeed speeding rash",
    drunk: "drunk driving alcohol",
    fir: "fir complaint police filed",
    witnesses: "witness saw",
    evidence: "evidence photo video cctv",
    insurance: "insurance insured",
    licence: "licence license",
    vehicle_type: "vehicle car bike truck bus",
    // IPC
    property: "theft property",
    threat: "threat extortion",
    // IT Act
    unauthorized_access: "hacking unauthorised access",
    data_theft: "data theft",
    financial_loss: "cheating fraud",
};

export const computeAnswerBoost = (context?: ConversationContext): number => {
    if (!context?.collectedAnswers) return 0;
    let boost = 0;
    Object.entries(context.collectedAnswers).forEach(([key, answer]) => {
        const a = (answer || "").toLowerCase();
        // The "Skip" answer must not inflate confidence: it adds no facts.
        if (a.includes("skip")) return;

        // A negative answer resolves a fact but is not positive evidence that
        // the section applies. It must never inflate confidence like "Yes" did
        // in the old engine.
        const isNegative =
            /^(no|none|not|never|without|didn'?t|don'?t|haven'?t|wasn'?t|isn'?t)\b/.test(a) ||
            /\b(no witnesses?|no evidence|not insured|no licence|no license)\b/.test(a);

        // "Fled / Hit-and-run" is a very strong signal for MVA 132/134.
        if (key === "hit_and_run" && a.includes("fled")) boost += 20;
        else if (isNegative) boost += 1;
        else if (a.includes("not sure")) boost += 1;
        else if (
            a === "yes" ||
            /\b(filed|insured|stopped|valid|witness|witnesses|evidence|photo|video|cctv)\b/.test(a)
        ) {
            boost += 6;
        } else {
            boost += 5; // free-text answers add meaningful context
        }
    });
    return boost;
};

// ── Free-text fact extraction ────────────────────────────────────────────────
// The app is intentionally offline and rule-based, so we explicitly parse the
// details users commonly mention instead of pretending to "understand" text.

export const extractCaseFacts = (text: string): CaseFacts => {
    const t = text.toLowerCase();
    const facts: CaseFacts = {};

    const injuryPattern = /\b(injur\w*|wound\w*|hurt|bleeding|fractur\w*|hospitali[sz]ed|hospital|icu|admitted|surgery)\b/;
    const negatedInjuryPattern =
        /\b(no one|nobody|not injur\w*|unhurt|no injur\w*|wasn'?t hurt|was not hurt|not hurt|didn'?t (get )?(hurt|injur\w*)|all safe)\b/;

    // Work clause by clause so "my friend was hurt but I was not injured"
    // still records an injury (the friend's) without claiming the user was hurt.
    const clauses = t
        .split(/[.!?;]|\bbut\b|\bhowever\b|\bthough\b/)
        .map((clause) => clause.trim())
        .filter(Boolean);
    const positiveInjuryClauses = clauses.filter(
        (clause) => injuryPattern.test(clause) && !negatedInjuryPattern.test(clause),
    );

    if (positiveInjuryClauses.length > 0) {
        facts.injured = true;
    } else if (injuryPattern.test(t) || negatedInjuryPattern.test(t)) {
        facts.injured = false;
    }

    // Who was injured / how many. Companion phrases only mean "injured" when
    // the sentence also contains an injury word; "we were in the car" is not
    // an injury.
    const companionPatterns: { re: RegExp; label?: string }[] = [
        { re: /\b(me and my wife|my wife and me|my wife and i|myself and my wife)\b/, label: "your wife" },
        { re: /\b(me and my husband|my husband and me|my husband and i|myself and my husband)\b/, label: "your husband" },
        { re: /\b(me and my son|my son and me|my son and i)\b/, label: "your son" },
        { re: /\b(me and my daughter|my daughter and me|my daughter and i)\b/, label: "your daughter" },
        { re: /\b(me and my father|my father and me|my father and i)\b/, label: "your father" },
        { re: /\b(me and my mother|my mother and me|my mother and i)\b/, label: "your mother" },
        { re: /\b(both of us|we both|two of us|the two of us)\b/ },
    ];
    // A "yes" answer to the injury question is itself an injury signal, so
    // "yes me and my wife" must count as two injured people.
    const affirmativeInjury = /\byes\b/.test(t) && facts.injured !== false;
    if (facts.injured || affirmativeInjury) {
        for (const p of companionPatterns) {
            if (p.re.test(t)) {
                facts.injured = true;
                facts.injuredCount = Math.max(facts.injuredCount ?? 1, 2);
                facts.injuredSelf = true;
                if (p.label) facts.injuredWith = p.label;
                break;
            }
        }
    }

    const numberWords: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
        seven: 7, eight: 8, nine: 9, ten: 10,
    };
    const numberMatch = t.match(
        /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b[^.!?]{0,35}\b(injur\w*|hurt|wound\w*)\b/,
    );
    if (numberMatch) {
        const count = /^\d+$/.test(numberMatch[1])
            ? parseInt(numberMatch[1], 10)
            : numberWords[numberMatch[1]];
        if (count && count > 0) {
            facts.injured = true;
            facts.injuredCount = Math.max(facts.injuredCount ?? 0, count);
        }
    }

    // Distinguish "I was injured" from "my friend was injured" so the summary
    // does not claim the user was hurt when only a bystander was mentioned.
    const selfInjuryPattern =
        /\b(i|i'm|i am|me|myself)\b[^.!?]{0,25}\b(injur\w*|hurt|wound\w*)\b/;
    const positiveInjuryText = positiveInjuryClauses.join(" ");
    if (facts.injured && selfInjuryPattern.test(positiveInjuryText)) {
        facts.injuredSelf = true;
    }
    if (facts.injured && !facts.injuredSelf && !facts.injuredWith) {
        const relation = positiveInjuryText.match(
            /\bmy (wife|husband|son|daughter|father|mother|friend|brother|sister|child|children)\b/,
        );
        if (relation) facts.injuredWith = `your ${relation[1]}`;
    }

    // Brake failure. A bare mention of "brake" is not a defect: "I had to
    // brake suddenly" must not become a brake-failure case.
    const positiveBrake =
        /\b(brakes? (are|were|is|was) (fine|ok|okay|good|working)|no problem with the brakes?|applied the brakes?|used the brakes?)\b/.test(t);
    const brakeProblem =
        /\b(brakes?|braking system|brake pedal|brake fluid|brake line)\b[^.!?]{0,30}\b(fail\w*|problem\w*|issue\w*|defect\w*|jam\w*|lock\w*|burst\w*|leak\w*|weak|poor|spongy|soft|bad|not work\w*|didn'?t work|no)\b/.test(t) ||
        /\b(fail\w*|problem\w*|issue\w*|defect\w*|no|without|lost)\b[^.!?]{0,30}\b(brakes?|braking)\b/.test(t) ||
        /\b(brake (failure|problem|issue|trouble|defect)|brakes? (bad|weak|soft|spongy)|no brakes?|without brakes?)\b/.test(t);
    if (brakeProblem && !positiveBrake) {
        facts.brakeFailure = true;
    }

    // Hit-and-run / fleeing
    if (/\b(fled|flee|ran away|run away|drove away|drove off|sped off|speed off|took off|vanished|without stopping|didn'?t stop|did not stop|hit and run)\b/.test(t)) {
        facts.fled = true;
    }
    if (!facts.fled && /\b(stopped|did stop|stop(?:ped)? after the accident)\b/.test(t)) {
        facts.fled = false;
    }

    // Driving behaviour
    if (/\b(over ?speed\w*|speeding|rash driving|dangerous driving|high speed|very fast)\b/.test(t)) {
        facts.overspeeding = true;
    }
    if (/\b(wrong side|opposite (lane|side)|oncoming lane)\b/.test(t)) {
        facts.wrongSide = true;
    }
    if (/\b(drunk|drink driving|alcohol|liquor|intoxicated)\b/.test(t)) {
        facts.drunk = true;
    } else if (/\b(sober|not drunk|no alcohol|didn'?t drink)\b/.test(t)) {
        facts.drunk = false;
    }

    // Licence, insurance and complaint status (from text or chip answers)
    const noLicencePattern =
        /\b(no|without|never had|didn'?t have|doesn'?t have)\s+(?:(?:a|any|valid|driving|new)\s+){0,2}(?:driving\s+)?licen[cs]e\b(?!\s*(?:plate|number|card|copy|photo))/;
    if (noLicencePattern.test(t) || /\bunlicen[cs]ed\b/.test(t)) {
        facts.noLicence = true;
    } else if (
        /\bvalid (driving )?licen[cs]e\b/.test(t) ||
        /\blicen[cs]e\b[^.!?]{0,20}\b(valid|fine|ok|okay)\b/.test(t)
    ) {
        facts.noLicence = false;
    }
    if (
        /\b(uninsured|not insured|no insurance|without insurance|didn'?t have insurance|doesn'?t have insurance)\b/.test(t)
    ) {
        facts.uninsured = true;
    } else if (
        /\binsured\b/.test(t) ||
        /\binsurance\b[^.!?]{0,20}\b(valid|active|paid|fine|ok|okay)\b/.test(t) ||
        /\b(have|has|with)\b[^.!?]{0,24}\binsurance\b/.test(t) ||
        /^(yes[, ]+)?i have (car |vehicle |bike )?insurance\b/.test(t)
    ) {
        facts.uninsured = false;
    }
    if (/\b(no fir|not filed|haven'?t filed|have not filed|didn'?t file|not yet|planning to)\b/.test(t)) {
        facts.firFiled = false;
    } else if (
        /\b(fir|complaint|report|police)\b[^.!?]{0,30}\b(filed|lodged|registered|submitted)\b/.test(t) ||
        /\b(filed|lodged|registered|submitted)\b[^.!?]{0,30}\b(fir|complaint|report|police)\b/.test(t) ||
        /\bfiled\s*$/.test(t)
    ) {
        facts.firFiled = true;
    }

    // Witnesses and evidence are asked in the reference interview. They do not
    // change which section applies, but they are part of the case summary and
    // the uncertainty view.
    const noWitnessPattern =
        /\b(no witnesses?|no one saw|nobody saw|no one witnessed|nobody witnessed|without witnesses?|there were no witnesses?)\b/;
    if (noWitnessPattern.test(t)) {
        facts.witnesses = false;
    } else if (/\b(witness|witnesses|eye ?witness|saw (it|the accident|what happened))\b/.test(t)) {
        facts.witnesses = true;
    }

    const noEvidencePattern =
        /\b(no evidence|don'?t have (any )?evidence|do not have (any )?evidence|without evidence|no photos?|no videos?|no cctv|nothing to show)\b/;
    if (noEvidencePattern.test(t)) {
        facts.evidence = false;
    } else if (/\b(evidence|photo|photos|video|videos|cctv|medical record|recording|footage)\b/.test(t)) {
        facts.evidence = true;
    }

    // Vehicle kind (also feeds the animated scene)
    if (/\b(bus|minibus)\b/.test(t)) facts.vehicleType = "bus";
    else if (/\b(truck|lorry)\b/.test(t)) facts.vehicleType = "truck";
    else if (/\b(bike|scooter|scooty|motorcycle|motorbike|two wheeler|2 wheeler)\b/.test(t)) facts.vehicleType = "bike";
    else if (/\b(car|cab|taxi|auto)\b/.test(t)) facts.vehicleType = "car";

    // Severity
    if (/\b(died|death|dead|killed|passed away|fatal)\b/.test(t)) {
        facts.death = true;
    }
    if (/\b(fractur\w*|grievous|serious injur\w*|seriously injur\w*|icu|surgery|major injur\w*)\b/.test(t)) {
        facts.grievous = true;
    }

    // Other domains
    if (/\b(theft|stole|steal|stolen|robbed|robbery|snatched|snatching|burglary|burglar)\b/.test(t)) {
        facts.property = true;
    }
    if (/\b(threat|threaten|extort|blackmail|intimidat\w*)\b/.test(t)) facts.threat = true;
    if (/\b(hack|hacked|hacking|unauthori[sz]ed access|account compromised)\b/.test(t)) {
        facts.unauthorizedAccess = true;
    }
    if (/\b(data (leak|leaked|stolen|breach)|leaked my data|personal data)\b/.test(t)) {
        facts.dataTheft = true;
    }
    if (
        /\b(financial loss|lost money|money was stolen|bank fraud|fraud amount)\b/.test(t) ||
        /₹\s?\d/.test(t)
    ) {
        facts.financialLoss = true;
    }

    return facts;
};

export const computeFactBoost = (facts: CaseFacts): number => {
    let boost = 0;
    if (facts.injured) boost += 6;
    if ((facts.injuredCount ?? 0) > 1) boost += 4;
    if (facts.brakeFailure) boost += 6;
    if (facts.fled) boost += 8;
    if (facts.overspeeding) boost += 4;
    if (facts.wrongSide) boost += 4;
    if (facts.death) boost += 6;
    if (facts.grievous) boost += 4;
    if (facts.noLicence) boost += 3;
    if (facts.uninsured) boost += 3;
    return Math.min(30, boost);
};

export const buildCaseSummary = (facts: CaseFacts): string => {
    const parts: string[] = [];
    if (facts.injured && (facts.injuredCount ?? 0) > 1) {
        if (facts.injuredWith) {
            parts.push(
                `You and ${facts.injuredWith} were injured (${facts.injuredCount} people in total).`,
            );
        } else {
            parts.push(`${facts.injuredCount} people were injured.`);
        }
    } else if (facts.injured && facts.injuredWith) {
        parts.push(
            `${facts.injuredWith.charAt(0).toUpperCase()}${facts.injuredWith.slice(1)} was injured.`,
        );
    } else if (facts.injured && facts.injuredSelf) {
        parts.push("You were injured.");
    } else if (facts.injured) {
        parts.push("Someone was injured.");
    } else if (facts.injured === false) {
        parts.push("No one was injured.");
    }
    if (facts.death) parts.push("The incident resulted in a death.");
    if (facts.brakeFailure) parts.push("You mentioned that the vehicle's brakes failed.");
    if (facts.fled) parts.push("The driver fled the scene without stopping.");
    if (facts.overspeeding) parts.push("Rash, negligent or high-speed driving was involved.");
    if (facts.wrongSide) parts.push("The vehicle was on the wrong side of the road.");
    if (facts.drunk) parts.push("Drunk driving was involved.");
    if (facts.noLicence) parts.push("The other driver did not have a valid licence.");
    if (facts.firFiled === false) parts.push("No FIR has been filed.");
    else if (facts.firFiled === true) parts.push("An FIR has been filed.");
    if (facts.witnesses === false) parts.push("No witnesses are available.");
    else if (facts.witnesses === true) parts.push("Witnesses are available.");
    if (facts.evidence === false) {
        parts.push("No documentary evidence (photos, videos, medical records or CCTV) is available.");
    } else if (facts.evidence === true) {
        parts.push("Evidence such as photos, videos, medical records or CCTV is available.");
    }
    if (facts.uninsured === true) parts.push("The other vehicle was not insured.");
    else if (facts.uninsured === false) parts.push("The vehicle was insured.");
    return parts.join(" ");
};

export const isAnsweredByFacts = (key: string, facts: CaseFacts): boolean => {
    switch (key) {
        case "injured": return facts.injured !== undefined;
        case "hit_and_run": return facts.fled !== undefined;
        case "wrong_side": return facts.wrongSide !== undefined;
        case "overspeeding": return facts.overspeeding !== undefined;
        case "drunk": return facts.drunk !== undefined;
        case "vehicle_type": return facts.vehicleType !== undefined;
        case "licence": return facts.noLicence !== undefined;
        case "insurance": return facts.uninsured !== undefined;
        case "fir": return facts.firFiled !== undefined;
        case "witnesses": return facts.witnesses !== undefined;
        case "evidence": return facts.evidence !== undefined;
        case "property": return facts.property !== undefined;
        case "threat": return facts.threat !== undefined;
        case "unauthorized_access": return facts.unauthorizedAccess !== undefined;
        case "data_theft": return facts.dataTheft !== undefined;
        case "financial_loss": return facts.financialLoss !== undefined;
        default: return false;
    }
};

/** Questions that are still genuinely unknown for this domain. */
export const getAvailableQuestions = (
    domain: string,
    context: ConversationContext | undefined,
    facts: CaseFacts,
): { question: string; key: string; options?: string[] }[] => {
    const asked = context?.questionsAsked ?? [];
    return (CLARIFICATION_QUESTIONS[domain] ?? []).filter(
        (question) => !asked.includes(question.key) && !isAnsweredByFacts(question.key, facts),
    );
};

/**
 * Build the "Extracted terms (research aid)" chips shown above the findings.
 * These are topics, not legal conclusions — they simply show the user which
 * parts of their story the analysis picked up.
 */
export const extractResearchTerms = (
    query: string,
    domain: string | undefined,
    facts: CaseFacts,
    matches: RankedSection[] = [],
): string[] => {
    const terms = new Set<string>();
    const q = (query || "").toLowerCase();

    if (domain === "mva") {
        terms.add("MVA");
        terms.add("road accident");
    } else if (domain === "ipc") {
        terms.add("IPC");
        terms.add("criminal law");
    } else if (domain === "it_act") {
        terms.add("IT Act");
        terms.add("cyber");
    }

    if (facts.injured) terms.add("injury");
    if (facts.death) terms.add("death");
    if (facts.fled) terms.add("hit-and-run");
    if (facts.overspeeding) terms.add("speeding");
    if (facts.wrongSide) terms.add("wrong side");
    if (facts.drunk) terms.add("drunk driving");
    if (facts.noLicence) terms.add("no licence");
    if (facts.firFiled === false) terms.add("no FIR");
    if (facts.firFiled === true) terms.add("FIR filed");
    if (facts.witnesses === false) terms.add("no witnesses");
    if (facts.witnesses === true) terms.add("witnesses");
    if (facts.evidence === false) terms.add("no evidence");
    if (facts.evidence === true) terms.add("evidence");
    if (facts.uninsured === true) terms.add("no insurance");
    if (facts.uninsured === false) terms.add("insurance");

    const queryTopics: Record<string, string> = {
        car: "car",
        bike: "two-wheeler",
        scooter: "two-wheeler",
        truck: "truck",
        lorry: "truck",
        bus: "bus",
        pedestrian: "pedestrian",
        theft: "theft",
        stole: "theft",
        stolen: "theft",
        robbery: "robbery",
        fraud: "fraud",
        cheat: "cheating",
        hacking: "hacking",
        hacked: "hacking",
        online: "online",
        cyber: "cyber",
        "domestic violence": "domestic violence",
        dowry: "dowry",
        "cheque bounce": "cheque bounce",
        cheque: "cheque bounce",
        landlord: "tenancy",
        tenant: "tenancy",
        salary: "employment",
        employer: "employment",
    };
    Object.entries(queryTopics).forEach(([needle, label]) => {
        if (q.includes(needle)) terms.add(label);
    });

    // Add a couple of concrete matched-keyword signals from the top sections.
    matches.slice(0, 3).forEach((match) => {
        match.reasons.forEach((reason) => {
            const exact = reason.match(/Exact match:\s*(.+)/i);
            if (exact && exact[1].length <= 24) terms.add(exact[1].trim());
        });
    });

    return Array.from(terms).slice(0, 10);
};

export const factScoreBoost = (act: Act, facts: CaseFacts): number => {
    let boost = 0;
    const num = act.section_number;
    if (facts.brakeFailure && num === "190") boost += 25;
    if (facts.death && num === "304A") boost += 20;
    if (facts.grievous && num === "338") boost += 15;
    if (facts.injured && num === "337") boost += 10;
    if (facts.injured && num === "134") boost += 10;
    if (facts.fled && (num === "132" || num === "134")) boost += 10;
    if (facts.overspeeding && ["183", "184", "279"].includes(num)) boost += 8;
    if (facts.wrongSide && num === "184") boost += 8;
    if (facts.drunk && num === "185") boost += 15;
    if (facts.noLicence && ["3", "181"].includes(num)) boost += 12;
    if (facts.uninsured && num === "196") boost += 12;
    if (facts.property && ["378", "379", "411"].includes(num)) boost += 18;
    if (facts.threat && ["383", "384", "386", "387", "388", "389", "503", "506"].includes(num)) boost += 15;
    if (facts.unauthorizedAccess && ["66", "66C", "66D"].includes(num)) boost += 12;
    if (facts.dataTheft && ["66", "66C", "66E"].includes(num)) boost += 10;
    if (facts.financialLoss && ["417", "420", "66D"].includes(num)) boost += 12;
    return boost;
};

// ── Layer 1: Intent Classification ──────────────────────────────────────────

const hasAnyTerm = (tokens: string[], terms: Set<string>): boolean =>
    tokens.some((token) => terms.has(token) || terms.has(getStem(token)));

const detectDomain = (queryTokens: string[]): { domain: string, confidence: number } => {
    const theftIntent = hasAnyTerm(queryTokens, theftTermSet);
    const cyberIntent = hasAnyTerm(queryTokens, cyberTermSet);
    const vehicleContext = hasAnyTerm(queryTokens, vehicleTermSet);
    const roadContext = hasAnyTerm(queryTokens, roadAccidentTermSet);

    // Strong disambiguation rules. These run before generic scoring because
    // common nouns ("car", "hit") otherwise dominate the wrong domain:
    //   "my car was stolen" is theft, not an unsafe-vehicle offence.
    //   "someone hit me" is assault, not a road accident.
    if (cyberIntent && !roadContext) return { domain: "it_act", confidence: 92 };
    if (theftIntent && !roadContext) return { domain: "ipc", confidence: 90 };
    if (queryTokens.includes("hit") && !vehicleContext) return { domain: "ipc", confidence: 85 };

    const scores = { ipc: 0, it_act: 0, mva: 0 };

    queryTokens.forEach(token => {
        const stemmed = getStem(token);

        if (DOMAIN_KEYWORDS.ipc.includes(token) || DOMAIN_KEYWORDS.ipc.includes(stemmed)) scores.ipc += 1;
        if (DOMAIN_KEYWORDS.it_act.includes(token) || DOMAIN_KEYWORDS.it_act.includes(stemmed)) scores.it_act += 1;
        if (DOMAIN_KEYWORDS.mva.includes(token) || DOMAIN_KEYWORDS.mva.includes(stemmed)) scores.mva += 1;

        // Check synonyms
        if (SYNONYM_MAP[token]) {
            // Heuristic: check if synonyms match domain keywords
            SYNONYM_MAP[token].forEach(syn => {
                if (syn.includes("theft") || syn.includes("murder")) scores.ipc += 0.5;
                if (syn.includes("access") || syn.includes("cyber")) scores.it_act += 0.5;
                if (syn.includes("driving") || syn.includes("accident")) scores.mva += 0.5;
            });
        }
    });

    // Calculate generic confidence
    const total = scores.ipc + scores.it_act + scores.mva;
    if (total === 0) return { domain: "unknown", confidence: 0 };

    const bestDomain = Object.keys(scores).reduce((a, b) => scores[a as keyof typeof scores] > scores[b as keyof typeof scores] ? a : b);
    const confidence = (scores[bestDomain as keyof typeof scores] / total) * 100;

    // Rule Boosts
    if (queryTokens.includes("cyber") || queryTokens.includes("online")) return { domain: "it_act", confidence: 90 };
    if (queryTokens.includes("driving") || queryTokens.includes("traffic")) return { domain: "mva", confidence: 90 };

    return { domain: bestDomain, confidence };
};

// ── Layer 2: Section Scoring Engine ─────────────────────────────────────────

const containsPhrase = (haystack: string, phrase: string): boolean => {
    const escaped = phrase
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(haystack);
};

const scoreSection = (act: Act, queryTokens: string[], expandedTokens: Set<string>): { score: number, reasons: string[], evidence: boolean } => {
    let keywordScore = 0;
    let semanticScore = 0;
    let ruleBoost = 0;
    const reasons: string[] = [];
    let evidence = false;
    const queryStr = queryTokens.join(" ");

    // 1. Keyword Match (40%)
    if (act.keywords) {
        act.keywords.forEach((kw: string) => {
            const kwLower = kw.toLowerCase();
            // Match phrases on word boundaries so "car" does not match "care"
            // and "act" does not match "fact".
            if (containsPhrase(queryStr, kwLower)) {
                keywordScore += 100;
                evidence = true;
                reasons.push(`Exact match: ${kw}`);
            } else {
                // Token match
                const kwTokens = kwLower.split(/\s+/);
                const matchCount = kwTokens.filter(t => expandedTokens.has(t)).length;
                if (matchCount > 0) {
                    keywordScore += (matchCount / kwTokens.length) * 80;
                    evidence = true;
                    reasons.push(`Keyword match: ${kw}`);
                }
            }
        });
    }

    // 2. Semantic Similarity (Simulated) (40%)
    // We approximate semantics by checking overlap with Explanation and Official Text.
    const textTokens = `${act.simplified_explanation || ""} ${act.official_text || ""}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
    const uniqueTextMatches = new Set(
        textTokens.filter(t => expandedTokens.has(t) && !STOP_WORDS.has(t)),
    );
    semanticScore = Math.min(100, uniqueTextMatches.size * 5);
    if (semanticScore > 50 && reasons.length === 0) reasons.push("Strong content alignment");

    // 3. Rule Boost (20%)
    const actName = act.act_name?.toLowerCase() || "";

    // Rule: Theft
    if (expandedTokens.has("theft") && act.section_title?.toLowerCase().includes("theft") && actName.includes("penal")) {
        ruleBoost += 100;
        reasons.push("Rule Match: Theft -> IPC");
    }
    // Rule: Extortion
    if (expandedTokens.has("threat") && expandedTokens.has("money") && act.section_title?.toLowerCase().includes("extortion")) {
        ruleBoost += 100;
        reasons.push("Rule Match: Threat + Money -> Extortion");
    }
    // Rule: Drunk Driving
    if ((expandedTokens.has("drunk") || expandedTokens.has("alcohol")) && act.section_title?.toLowerCase().includes("drunk")) {
        ruleBoost += 100;
        reasons.push("Rule Match: Drunk -> MVA");
    }
    // Rule: Hacking (computer-related offences)
    if ((expandedTokens.has("hacked") || expandedTokens.has("hacking") || expandedTokens.has("password")) &&
        actName.includes("information") &&
        /computer related offences|identity theft|unauthori[sz]ed access|cheating by personation/.test(act.section_title?.toLowerCase() || "")) {
        ruleBoost += 100;
        reasons.push("Rule Match: Hacking -> IT Act offence");
    }

    // Rule: Hit / Accident involving a vehicle -> accident-specific provisions.
    // Applies to both Motor Vehicles Act and the accident-related IPC sections.
    if ((expandedTokens.has("hit") || expandedTokens.has("crash") || expandedTokens.has("accident")) &&
        (expandedTokens.has("truck") || expandedTokens.has("car") || expandedTokens.has("vehicle") ||
         expandedTokens.has("bike") || expandedTokens.has("bus") || expandedTokens.has("motor")) &&
        /accident|stop|duty of driver|dangerous|speed|rash|negligence|hurt|death|injur|unsafe|defect/.test(act.section_title?.toLowerCase() || "")) {
        ruleBoost += 80;
        reasons.push("Rule Match: Road accident provision");
    }

    // Final Weighted Score
    const totalScore = (Math.min(100, keywordScore) * 0.4) + (semanticScore * 0.4) + (Math.min(100, ruleBoost) * 0.2);

    return { score: totalScore, reasons, evidence: evidence || ruleBoost > 0 };
};

// ── Main Engine ─────────────────────────────────────────────────────────────

export interface RankedSection {
    sectionNumber: string;
    sectionTitle: string;
    actName: string;
    confidence: number;
    applicableLaw: string;
    explanation: string;
    punishment: string;
    whatToDo: string;
    reasons: string[];
    notes?: string;
}

export interface CaseFacts {
    injured?: boolean;
    injuredCount?: number;
    injuredWith?: string;
    /** True when the user themselves was described as injured. */
    injuredSelf?: boolean;
    brakeFailure?: boolean;
    fled?: boolean;
    overspeeding?: boolean;
    wrongSide?: boolean;
    drunk?: boolean;
    /** True when the other driver had no valid driving licence. */
    noLicence?: boolean;
    /** True when the other vehicle had no insurance. */
    uninsured?: boolean;
    /** True when a police complaint / FIR was filed. */
    firFiled?: boolean;
    /** Whether witnesses are available. */
    witnesses?: boolean;
    /** Whether photos, videos, medical records or CCTV are available. */
    evidence?: boolean;
    /** The other vehicle, when the user mentioned (or answered with) one. */
    vehicleType?: "car" | "bike" | "truck" | "bus";
    death?: boolean;
    grievous?: boolean;
    property?: boolean;
    threat?: boolean;
    unauthorizedAccess?: boolean;
    dataTheft?: boolean;
    financialLoss?: boolean;
}

export type AnalysisEngine = "rules" | "semantic" | "gemini";

export interface AnalysisResult extends LegalCaseAnalysis {
    clarificationFlow?: ClarificationFlow;
    domain?: string;
    matches?: RankedSection[];
    facts?: CaseFacts;
    caseSummary?: string;
    liabilityNotes?: string;
    /** True while a clarifying question is pending: hide confidence/punishment. */
    preliminary?: boolean;
    /** Which engine produced this answer — shown in the UI for transparency. */
    engine?: AnalysisEngine;
    /** Short, honest note about how the match was made (or why it failed). */
    matchNote?: string;
}

export const analyzeLegalCase = (
    query: string,
    context?: ConversationContext
): AnalysisResult => {
    // Merge previously collected answers into the query so scoring improves.
    // "Yes"/"Fled" style answers are mapped to meaningful legal keywords.
    let effectiveQuery = query;
    if (context?.collectedAnswers) {
        Object.entries(context.collectedAnswers).forEach(([key, answer]) => {
            const a = (answer || "").toLowerCase();
            const isNegativeAnswer =
                /\b(no|none|not|never|without|didn'?t|don'?t|haven'?t|wasn'?t|isn'?t)\b/.test(a);
            const isPositive =
                !isNegativeAnswer &&
                (a === "yes" ||
                    /\b(fled|stopped|filed|insured|witness|witnesses|evidence|valid|have)\b/.test(a));
            effectiveQuery += " " + answer;
            if (isPositive && ANSWER_TOKEN_MAP[key]) {
                effectiveQuery += " " + ANSWER_TOKEN_MAP[key];
            }
        });
    }

    const lowerQuery = effectiveQuery.toLowerCase();
    const rawTokens = lowerQuery.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").split(/\s+/);
    const validTokens = rawTokens.filter(t => !STOP_WORDS.has(t) && t.length > 2);

    // Parse the details the user actually mentioned (injuries, brake failure, etc.)
    const facts = extractCaseFacts(effectiveQuery);
    const caseSummary = buildCaseSummary(facts);
    const liabilityNotes = facts.brakeFailure
        ? "You mentioned a brake failure. If the brakes were defective because the vehicle was not maintained, the owner/operator may also be liable under Section 190 of the Motor Vehicles Act. The driver may argue that the failure was unforeseen. Ask the police to inspect the vehicle and record its mechanical condition in the accident report."
        : "";

    // Expand Tokens (synonyms + stems)
    const expandedTokens = new Set<string>(validTokens);
    validTokens.forEach(t => {
        const addSynonym = (syn: string) => {
            expandedTokens.add(syn);
            // Also add individual words of multi-word synonyms so keyword
            // tokens like "rash" / "driving" can match.
            syn.split(/\s+/).forEach(part => {
                if (part.length > 2) expandedTokens.add(part);
            });
        };
        if (SYNONYM_MAP[t]) SYNONYM_MAP[t].forEach(addSynonym);
        const stem = getStem(t);
        if (stem !== t) {
            expandedTokens.add(stem);
            if (SYNONYM_MAP[stem]) SYNONYM_MAP[stem].forEach(addSynonym);
        }
    });

    // Layer 1: Domain Classification
    const domainResult = detectDomain(validTokens);

    if (domainResult.confidence < 30) {
        // If we already asked what kind of incident this is and still cannot
        // classify it, stop asking instead of looping on the same question.
        const alreadyAskedType = context?.questionsAsked?.includes("incident_type");

        return {
            confidence_score: 0,
            section_title: "Needs Clarification",
            section_number: "",
            act_name: "",
            reasoning_summary: "I could not determine the nature of your legal issue.",
            applicable_law: "",
            simplified_explanation: "",
            possible_punishment: "",
            what_user_can_do: "",
            clarification_question_if_needed: "Could you describe the incident in more detail? For example, did this happen on a road, online, or involving property?",
            domain: "unknown",
            facts,
            caseSummary,
            liabilityNotes,
            matches: [],
            clarificationFlow: alreadyAskedType
                ? { shouldAsk: false }
                : {
                    shouldAsk: true,
                    question: "To identify the correct law, could you tell me what kind of incident this was?",
                    questionKey: "incident_type",
                    options: ["Road / traffic accident", "Online / cyber crime", "Theft, injury or threats"]
                }
        };
    }

    // Filter acts by domain. Accident queries also consider the IPC sections
    // that apply to road accidents (rash driving, death/injury by negligence, etc.).
    let filteredActs = actsData;
    if (domainResult.domain === "ipc") filteredActs = actsData.filter((a: Act) => a.act_name.includes("Penal"));
    if (domainResult.domain === "it_act") filteredActs = actsData.filter((a: Act) => a.act_name.includes("Information"));
    if (domainResult.domain === "mva") {
        filteredActs = actsData.filter(
            (a: Act) =>
                a.act_name.includes("Motor") ||
                (a.act_name.includes("Penal") && ACCIDENT_IPC_SECTIONS.has(a.section_number)),
        );
    }

    // Fallback if filtering too aggressive
    if (filteredActs.length === 0) filteredActs = actsData;

    // Layer 2: Scoring
    const scoredActs = filteredActs.map((act: Act) => {
        const { score, reasons, evidence } = scoreSection(act, validTokens, expandedTokens);
        const boost = factScoreBoost(act, facts);
        return { act, score: score + boost, reasons, evidence: evidence || boost > 0 };
    });

    scoredActs.sort((a, b) => b.score - a.score);

    // The dataset repeats a few sections; keep only the best-scoring copy.
    const seenSections = new Set<string>();
    const uniqueMatches = scoredActs.filter((m) => {
        const key = `${m.act.act_name}|${m.act.section_number}`;
        if (seenSections.has(key)) return false;
        seenSections.add(key);
        return true;
    });

    const topMatch = uniqueMatches[0];

    // Layer 3: Confidence Validation
    if (!topMatch || topMatch.score < 15) {
        return {
            confidence_score: topMatch ? Math.round(topMatch.score) : 0,
            section_title: "Insufficient Information",
            section_number: "",
            act_name: "",
            reasoning_summary: "I found some potential matches but they are too weak to be certain.",
            applicable_law: "",
            simplified_explanation: "",
            possible_punishment: "",
            what_user_can_do: "",
            clarification_question_if_needed: "Can you provide more specific details? For example, was there any weapon involved, or any specific threats made?",
            domain: domainResult.domain,
            facts,
            caseSummary,
            liabilityNotes,
            matches: []
        };
    }

    // Collect every section that is clearly relevant to the query.
    const MAX_MATCHES = 6;
    const selectedMatches = uniqueMatches
        .filter((m, idx) => idx === 0 || (m.evidence && m.score >= topMatch.score * 0.5))
        .slice(0, MAX_MATCHES);

    const buildMatches = (confidenceFor: (score: number) => number): RankedSection[] =>
        selectedMatches.map((m, idx) => ({
            sectionNumber: m.act.section_number,
            sectionTitle: m.act.section_title,
            actName: m.act.act_name,
            confidence: confidenceFor(m.score),
            applicableLaw: m.act.official_text || "Text not available.",
            explanation: m.act.simplified_explanation || "No simple explanation available.",
            punishment: m.act.punishment || "Refer to Act.",
            whatToDo: m.act.legal_procedure_guidance || "Consult a lawyer.",
            reasons: m.reasons,
            notes: idx === 0 && liabilityNotes ? liabilityNotes : undefined,
        }));

    // ── Multi-turn clarification: accident interview, up to four questions ──
    const availableQuestions = getAvailableQuestions(domainResult.domain, context, facts);
    const priority = QUESTION_PRIORITY[domainResult.domain] ?? [];
    const nextQuestion =
        priority
            .map((key) => availableQuestions.find((q) => q.key === key))
            .find((q): q is { question: string; key: string; options?: string[] } => Boolean(q)) ??
        availableQuestions[0];
    const askedCount = context?.questionsAsked?.length ?? 0;
    // Road accidents get the full interview; the other domains keep one
    // question, and only while the match is still weak.
    const maxQuestions = domainResult.domain === "mva" ? MAX_CLARIFICATION_QUESTIONS : 1;
    const canStillAsk = askedCount < maxQuestions && !context?.readyForResult;
    const shouldClarify =
        canStillAsk &&
        nextQuestion !== undefined &&
        (domainResult.domain === "mva" || topMatch.score < 70);

    if (shouldClarify && nextQuestion) {
        const next = nextQuestion;
        const preliminaryConfidence = Math.min(
            PRELIMINARY_CONFIDENCE_CAP,
            Math.round(topMatch.score),
        );
        const reasonText = topMatch.reasons.length > 0
            ? topMatch.reasons.join(", ")
            : "the closest legal-text match";
        return {
            confidence_score: preliminaryConfidence,
            section_title: topMatch.act.section_title,
            section_number: topMatch.act.section_number,
            act_name: topMatch.act.act_name,
            reasoning_summary: `Preliminary match: **${topMatch.act.section_title}** (${topMatch.act.act_name}) based on ${reasonText}.`,
            applicable_law: topMatch.act.official_text || "Text not available.",
            simplified_explanation: topMatch.act.simplified_explanation || "No simple explanation available.",
            possible_punishment: topMatch.act.punishment || "Refer to Act.",
            what_user_can_do: topMatch.act.legal_procedure_guidance || "Consult a lawyer.",
            clarification_question_if_needed: next.question,
            domain: domainResult.domain,
            facts,
            caseSummary,
            liabilityNotes,
            matches: buildMatches((score) =>
                score === topMatch.score
                    ? preliminaryConfidence
                    : Math.max(15, Math.round((score / topMatch.score) * preliminaryConfidence)),
            ),
            preliminary: true,
            clarificationFlow: {
                shouldAsk: true,
                question: next.question,
                questionKey: next.key,
                options: next.options
            }
        };
    }

    // All clarification answered (or confidence strong): final result
    const answerBoost = computeAnswerBoost(context);
    const finalConfidence = Math.min(99, Math.round(topMatch.score + answerBoost));
    const reasonText = topMatch.reasons.length > 0
        ? topMatch.reasons.join(", ")
        : "the closest legal-text match";

    const result: AnalysisResult = {
        section_number: topMatch.act.section_number,
        section_title: topMatch.act.section_title,
        act_name: topMatch.act.act_name,
        confidence_score: finalConfidence,
        reasoning_summary: `Identified as **${topMatch.act.section_title}** based on ${reasonText} from the **${topMatch.act.act_name}**.`,
        applicable_law: topMatch.act.official_text || "Text not available.",
        simplified_explanation: topMatch.act.simplified_explanation || "No simple explanation available.",
        possible_punishment: topMatch.act.punishment || "Refer to Act.",
        what_user_can_do: topMatch.act.legal_procedure_guidance || "Consult a lawyer.",
        clarification_question_if_needed: "",
        domain: domainResult.domain,
        facts,
        caseSummary,
        liabilityNotes,
        matches: buildMatches((score) =>
            score === topMatch.score
                ? finalConfidence
                : Math.max(15, Math.round((score / topMatch.score) * finalConfidence)),
        ),
        clarificationFlow: { shouldAsk: false }
    };

    return result;
};

// ── Search API (backwards-compatible) ────────────────────────────────────────

export const searchActs = (
    query: string,
    context?: ConversationContext
): SearchResult[] => {
    const analysis = analyzeLegalCase(query, context);
    if (analysis.confidence_score < 15) return [];

    const matches = analysis.matches ?? [];

    // Safety net: if no ranked list was built, fall back to the top match.
    if (matches.length === 0) {
        return [{
            id: "best-match",
            sectionName: `Section ${analysis.section_number} — ${analysis.section_title}`,
            confidence: analysis.confidence_score,
            applicableLaw: analysis.applicable_law,
            explanation: analysis.simplified_explanation,
            punishment: analysis.possible_punishment,
            whatToDo: analysis.what_user_can_do,
            whereToFile: getWhereToFile(analysis.domain),
            keywords: [],
            matchReason: analysis.reasoning_summary
        }];
    }

    return matches.map((m, i) => ({
        id: `${m.actName}-${m.sectionNumber}-${i}`,
        sectionName: `Section ${m.sectionNumber} — ${m.sectionTitle}`,
        confidence: m.confidence,
        applicableLaw: m.applicableLaw,
        explanation: m.explanation,
        punishment: m.punishment,
        whatToDo: m.whatToDo,
        whereToFile: getWhereToFile(analysis.domain),
        keywords: [],
        matchReason: m.reasons.length > 0 ? m.reasons.join(", ") : "Relevant to your description",
    }));
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export const getWhereToFile = (domain?: string): string => {
    switch (domain) {
        case "it_act":
            return "Cyber Crime Cell / Online Complaint at cybercrime.gov.in";
        case "mva":
            return "Traffic Police Station / Motor Accident Claims Tribunal";
        case "ipc":
            return "Police Station (FIR) / Magistrate Court";
        default:
            return "Police Station / Court";
    }
};
