# Margavidi Audit Tracker

Audit date: 2026-10-23
Working directory: `C:\Users\aarav\Downloads\vakil-aid-guide-main\vakil-aid-guide-main\vakil-aid-guide-main`

## Scope

Client-side React 18 + Vite 5 + TypeScript app. No backend, no database, no git
repository. Legal content is bundled in `src/assets/acts.json`; semantic vectors
are bundled in `src/assets/section-embeddings.json`. Optional Google AI (Gemini)
calls are made directly from the browser with a user-supplied key.

## Baseline evidence (before repairs)

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | PASS (0 errors) |
| Unit tests | `npm test` | PASS (4 files, 55 tests) |
| Lint | `npm run lint` | PASS (0 errors, 9 fast-refresh warnings) |
| Production build | `npx vite build --outDir .audit-dist` | PASS with CSS `@import` warning, 2 chunks > 500 kB |
| Dependency audit | `npm audit --omit=dev` | 23 vulnerabilities: 1 critical, 20 high, 2 moderate |
| Git state | `git status` | Not a git repository; no diff history available |
| Secret scan | scan of `dist/assets/*.js` for `AIza…` / env key values | No embedded key found |

## Findings register

Status values: **OPEN**, **FIXED**, **PARTIAL** (reduced but not removed), **DEFERRED** (documented risk / needs legal review).

| ID | Severity | Area | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| AUD-01 | Critical | Legal classification | A stolen vehicle is classified as a Motor Vehicles Act case. `"my car was stolen"` returns MVA s.190 "Using vehicle in unsafe condition" instead of IPC theft. | Reproduced with `analyzeLegalCase`; domain `mva`, top s.190 | FIXED — domain overrides + `THEFT_INTENT_TERMS` route to IPC; regression test |
| AUD-02 | High | Legal classification | `"someone hit me"` is classified as MVA because the token `hit` is a vehicle keyword. It recommends accident sections for an assault. | Reproduced: domain `mva`, top IPC s.338 | FIXED — bare `hit` without a vehicle is routed to IPC |
| AUD-03 | High | Fact extraction | Injury words are not detected. `/\b(injur|wound)\b/` does not match "injured"/"injury"/"wounded", so `"I was injured"` produces no injury fact and the app keeps asking. | Reproduced: `extractCaseFacts("I was injured")` returns `{}` | FIXED — inflection regex + clause handling |
| AUD-04 | High | Fact extraction | Passenger counts are treated as injuries. `"there were two people in the car"` sets `injured=true`, `injuredCount=2`. | Reproduced: summary says "You and another person were injured" | FIXED — passenger counts are no longer injuries |
| AUD-05 | High | Case summary | Brake-failure summary always says "the truck's brakes failed", even for a car or bike. | Reproduced with `"a car hit me and the brakes failed"` | FIXED — wording is vehicle-generic |
| AUD-06 | High | Legal scoring | `"my email was hacked and money stolen"` ranks IT Act s.66B (receiving stolen computer resource) above hacking/cheating sections because the hacking rule matches "stolen computer" in the title. | Reproduced: top s.66B | FIXED — cyber override + shared intent terms; regression test |
| AUD-07 | Medium | Legal scoring | `"my wallet was stolen"` returns "Insufficient Information" because "stolen" is not mapped to theft and theft sections get no property-fact boost. | Reproduced: confidence 11, no matches | FIXED — `"stolen"` synonym + property-fact boost |
| AUD-08 | Medium | Data integrity | 10 duplicate `act_name + section_number` rows in `acts.json`; 10 extra rows in the embeddings file. Several duplicates are skeletal copies that can win a match. | Script audit: 104 rows, 94 unique keys; 104 embeddings, 0 id mismatches | FIXED — dedupe script; 94 rows, aligned vectors; integrity tests |
| AUD-09 | Medium | External API robustness | Gemini JSON is cast without validation. A non-string `case_summary`/`liability_notes` can throw; a non-array `matches` can throw; an object `reason` can reach React. | Code inspection `parseGeminiJson` / `buildGeminiResult` | FIXED — coercion helpers + malformed-output tests |
| AUD-10 | Medium | Confidence | Fact boosts are applied twice (section score then final confidence). A preliminary result can show 97% while still asking a question, and the top card can show a lower percentage than the overall result. | Reproduced: `"a car hit me and the brakes failed"` overall 97, top card 91 | FIXED — boost counted once; preliminary cap 85 |
| AUD-11 | Medium | Styling | Google Fonts `@import` appears after `@tailwind` directives. CSS requires imports first; the browser drops it and the build warns. | Build warning `@import must precede all other statements` | FIXED — import moved above `@tailwind`; warning gone |
| AUD-12 | Low | i18n / UX | Translation keys `viewDetails`, `collapse`, `confidenceLabel` are defined but unused; legal cards are hardcoded English. Result follow-up chips use the "Clarification needed" label. | Code inspection `LegalResponseCard`, `CaseAnalysis` | FIXED — keys wired; `followUpResultLabel` added in 6 languages |
| AUD-13 | High | Dev-server security | `vite.config.ts` sets `host: "::"`, exposing a local app that may hold a browser/env Gemini key to the LAN. | `vite.config.ts` line 9 | FIXED — binds to `localhost` (override via `VITE_DEV_HOST`) |
| AUD-14 | High | Dependency security | `npm audit`: critical `protobufjs` (via `@xenova/transformers` → `onnxruntime-web`), high `react-router-dom` / `@remix-run/router`, high `postcss`, plus build-tool chains. | `npm audit --omit=dev` JSON | PARTIAL — 23 → 14 production advisories; remainder need majors (risk register) |
| AUD-15 | Low | Lifecycle | Analysis timer is not cleared on component unmount; delayed follow-up messages are not guarded against a new case. | Code inspection `CaseAnalysis.tsx` | FIXED — mount guard clears timers and skips late callbacks |
| AUD-16 | High | Legal content | The database uses the Indian Penal Code, 1860, which was replaced by the Bharatiya Nyaya Sanhita, 2023. No BNS mapping/notice is present. | `acts.json` act names; legal review | DEFERRED |
| AUD-17 | Medium | Legal content | 24 rows have no `simplified_explanation`, 42 no `official_text`, 25 no `legal_procedure_guidance`; the UI falls back to "not available" text. | Data audit script | DEFERRED |
| AUD-18 | Low | Accessibility | Icon-only buttons lack accessible names; card expand button lacks `aria-expanded`; speech button relies on `title`. | Code inspection | FIXED — `aria-label`s and `aria-expanded` added |
| AUD-19 | Medium | Performance | Main JS bundle is 729 kB (219 kB gzip) because acts + 94×384 embeddings are imported eagerly; semantic model chunk is separate. | Build output | DEFERRED |
| AUD-20 | Info | Security posture | Gemini key is stored in `localStorage` by design; documented in README/UI. No CSP is set. Any XSS would expose the key. | README, `gemini.ts` | DEFERRED |

## Repair log

2026-10-23 — fixes applied and verified in one final pass (details in
`## Verification evidence` below).

1. **Classification and facts** (`src/lib/search.ts`)
   - Exported `THEFT_INTENT_TERMS`, `CYBER_INTENT_TERMS`, `VEHICLE_TERMS`,
     `ACCIDENT_TERMS`; added an injury-blind road-context set so "stolen car +
     injured owner" stays in IPC.
   - Word-boundary keyword matching, clause-aware injury/negation handling,
     passenger-count false positive removed, bare "brake" verb no longer
     treated as a failure.
   - Domain overrides: cyber/theft without a road incident, and a bare "hit"
     without a vehicle, are routed to the correct Act.
   - Confidence double-count removed (`PRELIMINARY_CONFIDENCE_CAP = 85`),
     reason fallback text added, truck-specific facts wording made
     vehicle-generic.
2. **Semantic fallback** (`src/lib/analyze.ts`): `detectDomainHint` mirrors the
   same disambiguation before embedding-based matching.
3. **AI output hardening** (`src/lib/gemini.ts`): `parseGeminiJson` now rejects
   arrays/scalars; new `asText`/`asStringArray`/`asObject`/`coerceAnalysis`
   helpers coerce and cap every field so malformed model output cannot throw
   or render objects.
4. **Data integrity** (`scripts/dedupe-acts.mjs`): 104 → 94 rows; the first
   record wins for statutory fields and later duplicates only fill blanks and
   union keywords. Embeddings filtered 104 → 94 and re-indexed to match
   `acts.json` order.
5. **UI / i18n** (`LanguageContext.tsx`, `LegalResponseCard.tsx`,
   `LegalOutputPanel.tsx`, `CaseAnalysis.tsx`): added `followUpResultLabel` in
   all six languages; wired the previously unused `viewDetails`, `collapse`
   and `confidenceLabel` keys; added `aria-label`/`aria-expanded`; timers and
   delayed callbacks now stop on unmount.
6. **Styling** (`src/index.css`): Google Fonts `@import` moved above the
   Tailwind directives; ~20 keyframes/utilities for the scene animation added
   with a `prefers-reduced-motion` guard.
7. **Dev-server hardening** (`vite.config.ts`): `host` is now
   `process.env.VITE_DEV_HOST || "localhost"` instead of `"::"`.
8. **Dependencies**: `react-router-dom@6.30.6`, `postcss@8.5.31`,
   `tailwindcss@3.4.19`, `vite@5.4.21`, `vitest@3.2.7` plus a non-major
   `npm audit fix`. Production advisories fell from 23 to 14.
9. **New feature — animated case scene**: `src/lib/scene.ts` maps the typed
   query to a scene script (traffic / theft / cyber / assault / generic,
   vehicle type, cues); `src/components/CaseSceneAnimation.tsx` renders it as
   an animated SVG with friendly flat characters. It is opt-in: the "🎬 Show
   scene" button reveals it, and it reflects the submitted case plus the
   non-skip answers.

## New feature: opt-in case scene

What it does: when the user presses "🎬 Show scene", the Legal Analysis panel
shows an animated illustration of the incident the app understood. The traffic
scene is **composed from the description**, not from a fixed template:

- Layout: two-vehicle collision (vehicles face each other), pedestrian hit at a
  zebra crossing (single vehicle), a solo fall/skid (one tipped vehicle), or a
  parked vehicle when nothing indicates a crash.
- Environment: city street or highway backdrop, night (dark sky, street lamp,
  headlight beams), rain (animated streaks, wet road), traffic signal.
- Motion: overspeeding → faster wheel spin + rush lines; drunk driving → the
  offending vehicle wobbles; hit-and-run → the other car flees with a running
  driver; brake failure → smoke; injury → a lying victim with pulse ring and
  first-aid cross.

Theft (snatcher), cyber (seated person at a hacked laptop with pulsing rings)
and assault scenes follow the same fact-driven approach for their own props.
Cue chips state the extracted facts ("Brake failure", "Driver fled the scene",
"Financial loss or stolen money", …). Nothing is shown while typing. All
animation is pure SVG + CSS; no new dependency was added.
`prefers-reduced-motion` disables motion.

## Post-audit UX pass: accident interview, opt-in scene, later confidence

What changed (accident-focused):

- **Short varied interview (up to four questions).** Road-accident cases now get
  up to four genuinely useful questions, asked one at a time and never repeated
  (`MAX_CLARIFICATION_QUESTIONS = 4`, `QUESTION_PRIORITY`). The order follows
  impact on the matched section: injury → hit-and-run → drunk driving → licence
  → insurance → speeding → wrong side → vehicle kind → FIR; a question is only
  asked while its fact is still unknown. Other domains keep the single
  question, and only while the match is still weak (< 70).
- **No confidence/severity before confirmation.** While a question is pending,
  results are marked `preliminary`: the card shows the likely section with an
  amber "Likely section — answer the question to confirm" chip, while the
  confidence badge and the expandable punishment details stay hidden until the
  interview ends.
- **Skip option.** A "Skip — show best answer" chip ends the whole interview
  immediately and shows the best available match (the UI sets
  `readyForResult`). Skipped answers add no confidence boost
  (`computeAnswerBoost` ignores any answer containing "skip"). The
  incident-type question cannot be skipped because routing depends on it.
- **Scene is opt-in and composed, not canned.** The scene no longer previews
  while the user types; it appears only when "🎬 Show scene" is pressed, and it
  reflects the submitted case plus the non-skip answers — so answering "Truck"
  changes the vehicle in the scene. The traffic picture assembles itself from
  the description: layout (collision / pedestrian / solo / parked), environment
  (city vs highway, night, rain, signal), speed (overspeeding = faster spin +
  rush lines) and drunk wobble.
- **People, not boxes.** The scene draws friendly flat characters: standing and
  walking pedestrians (with zebra stripes when crossing is mentioned), a running
  hit-and-run driver, a lying victim with a pulse ring and first-aid cross, a
  seated person at the desk in the cyber scene, and a rider on a bike. Wheels
  spin and limbs swing; `prefers-reduced-motion` still disables all motion.

## Modified files

- `src/lib/search.ts` — classification, facts, confidence and disambiguation repairs; up-to-four-question accident interview, question priority and `preliminary` flag.
- `src/lib/analyze.ts` — semantic domain-hint disambiguation.
- `src/lib/gemini.ts` — strict validation/coercion of model output.
- `src/lib/scene.ts` — **new** query → scene-script mapper (layout, environment, speed, wobble).
- `src/components/CaseSceneAnimation.tsx` — **new** animated scene component; composes the traffic picture from the script (collision/pedestrian/solo/parked, city/highway, night/rain/signal).
- `src/components/LegalOutputPanel.tsx` — optional `scene` slot, empty-state height fix; `preliminary` field on `LegalSection`.
- `src/components/LegalResponseCard.tsx` — i18n labels and accessibility; hides confidence and punishment while preliminary.
- `src/pages/CaseAnalysis.tsx` — scene integration (opt-in "Show scene" toggle, skip ends the interview), unmount cleanup, aria labels; preliminary cards, skip chip, reworded question prompt.
- `src/contexts/LanguageContext.tsx` — `followUpResultLabel` in all six languages.
- `src/index.css` — font-import order fix, scene keyframes/utilities, reduced-motion guard.
- `vite.config.ts` — dev-server host defaults to localhost.
- `package.json` / `package-lock.json` — patch-level dependency updates.
- `src/assets/acts.json` — deduplicated 104 → 94 rows.
- `src/assets/section-embeddings.json` — filtered/aligned 104 → 94 vectors.
- `scripts/dedupe-acts.mjs` — **new** reproducible dedupe script.
- `src/test/search.test.ts` — updated one malformed brake case; up-to-four-question interview, preliminary flag and skip/no-boost tests.
- `src/test/regression.test.ts` — **new** classification/facts/scene/data/AI-robustness regressions; accident-interview (≤ 4 questions, all distinct) regressions.
- `src/test/scene-animation.test.tsx` — **new** DOM tests for the animated scene.
- `src/test/legal-card-preliminary.test.tsx` — **new** DOM tests: confidence/punishment stay hidden while a question is pending.

## Verification evidence

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | PASS (0 errors) |
| Unit tests | `npm test` | PASS (7 files, 109 tests) |
| Lint | `npm run lint` | PASS (0 errors, 9 pre-existing fast-refresh warnings) |
| Production build | `npm run build` → `dist/` | PASS; CSS `@import` warning gone; 2 chunks > 500 kB |
| Production advisories | `npm audit --omit=dev` | 14 vulnerabilities: 1 critical, 9 high, 4 moderate (was 23) |
| All advisories | `npm audit` | 21 (was 23) |
| Dev server smoke | `npm run dev` + `GET http://localhost:8080/` | HTTP 200, root div served |
| Secret scan | scan of `dist/**` for keys/tokens | 0 matches |
| Data alignment | `node scripts/dedupe-acts.mjs`, integrity tests | 94 unique keys; 94 vectors, index-by-index aligned |

Behavioural checks (also asserted by tests): `"my car was stolen"` → IPC (§378/379);
`"someone hit me"` → IPC; `"my email was hacked and money was stolen"` → IT Act §66
(up to four accident questions, then final); `"my wallet was stolen in the market"` → IPC
with no question; `"the truck hit us and the driver fled, my wife was injured"` → MVA with fled/injury
cues; `"two people were sitting in the car"` → no injury; malformed Gemini payloads
(e.g. `case_summary: 42`, mixed-type `matches`) are coerced or dropped, never thrown.

## Unresolved issues / risk register

- **AUD-14 (partial):** the remaining critical/high advisories come from
  transitive packages that need major upgrades: `@xenova/transformers`
  (`protobufjs`, `onnx-proto`, `onnxruntime-web`, `sharp`), Tailwind 3 build
  tools (`braces`/`chokidar`/`micromatch`), and `react-router` advisories that
  require React Router 7. Do not force-upgrade without a compatibility pass.
- **AUD-16:** BNS 2023 mapping requires qualified legal review; statutory
  content was not rewritten.
- **AUD-17:** 24 rows still lack an explanation, 42 lack official text, 25 lack
  procedure guidance; fill from an authoritative source.
- **AUD-19:** the embedding index is still imported eagerly (main chunk
  ~722 kB / 219 kB gzip); lazy-load it when the semantic path first runs.
- **AUD-20:** a public deployment should proxy AI calls through a backend and
  set a strict CSP; the browser key in `localStorage` remains exposed to XSS.
- No git repository exists, so changes cannot be diffed/reverted through git;
  backups of `package.json` / `package-lock.json` are in
  `%LOCALAPPDATA%\Temp\opencode\`.

