import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft, ChevronRight } from "lucide-react";
import { ChatPanel, type Message } from "@/components/ChatPanel";
import {
  LegalOutputPanel,
  type AnalysisStage,
  type LegalSection,
} from "@/components/LegalOutputPanel";
import { CaseSceneAnimation } from "@/components/CaseSceneAnimation";
import { VoiceInput } from "@/components/VoiceInput";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AiSettings } from "@/components/AiSettings";
import { analyzeCaseSmart } from "@/lib/analyze";
import {
  extractResearchTerms,
  getWhereToFile,
  MAX_CLARIFICATION_QUESTIONS,
  type ConversationContext,
} from "@/lib/search";

/** Answer recorded when the user chooses not to answer a clarifying question. */
const SKIP_ANSWER_LABEL = "Skip — show best answer";
const VISIBLE_RESULT_COUNT = 5;

const freshContext = (): ConversationContext => ({
  collectedAnswers: {},
  questionsAsked: [],
  questionTexts: {},
  readyForResult: false,
});

interface AnalysisMeta {
  terms: string[];
  caseSummary: string;
  note: string;
}

interface PendingFinal {
  sections: LegalSection[];
  summary: string;
}

const emptyMeta = (): AnalysisMeta => ({ terms: [], caseSummary: "", note: "" });

// ── Component ──────────────────────────────────────────────────────────────────
export const CaseAnalysis = () => {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<AnalysisStage>("interview");
  const [legalSections, setLegalSections] = useState<LegalSection[]>([]);
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta>(emptyMeta);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [followUpQuestions, setFollowUpQuestions] = useState<{ id: string; label: string }[]>([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  /** The case text shown in the animated scene (updated for a new case). */
  const [caseDescription, setCaseDescription] = useState("");
  const [conversationContext, setConversationContext] = useState<ConversationContext>(freshContext);
  const [pendingClarification, setPendingClarification] = useState<{
    question: string;
    questionKey: string;
    options?: string[];
  } | null>(null);
  const [pendingFinal, setPendingFinal] = useState<PendingFinal | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);
  // The animated scene is opt-in: nothing shows until "Show scene" is pressed.
  const [showScene, setShowScene] = useState(false);
  const originalQueryRef = useRef<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const analysisIdRef = useRef(0);
  const pendingTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Cancel delayed callbacks when the user leaves the page so no state update
  // or timer survives the component (AUD-15).
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Runs the analysis for a query with the given conversation context.
   * Either asks the next clarifying question or prepares the summary review.
   */
  const runAnalysis = async (text: string, ctx: ConversationContext) => {
    const analysisId = ++analysisIdRef.current;
    try {
      setAnalysisStatus("Preparing analysis…");
      const analysis = await analyzeCaseSmart(text, ctx, {
        onProgress: (message) => {
          if (analysisId === analysisIdRef.current) setAnalysisStatus(message);
        },
      });

      // A newer case or a "start over" action superseded this request.
      if (analysisId !== analysisIdRef.current) return;

      const flow = analysis.clarificationFlow;
      const isPreliminary = Boolean(flow?.shouldAsk);
      const matches = analysis.matches ?? [];

      const sections: LegalSection[] = matches.map((m, i) => ({
        id: `${m.actName}-${m.sectionNumber}-${i}`,
        sectionName: `Section ${m.sectionNumber} — ${m.sectionTitle}`,
        actName: m.actName,
        confidence: m.confidence,
        applicableLaw: m.applicableLaw,
        explanation: m.explanation,
        punishment: m.punishment,
        whatToDo: m.whatToDo,
        whereToFile: getWhereToFile(analysis.domain),
        matchReason: m.reasons.join(", ") || analysis.reasoning_summary,
        notes: m.notes,
        preliminary: isPreliminary,
      }));

      const termQuery = [text, ...Object.values(ctx.collectedAnswers)].filter(Boolean).join(" ");
      setAnalysisMeta({
        terms: extractResearchTerms(termQuery, analysis.domain, analysis.facts ?? {}, matches),
        caseSummary: analysis.caseSummary ?? "",
        note: analysis.matchNote ?? "",
      });

      if (analysis.confidence_score >= 15 && matches.length > 0) {
        setLegalSections(sections);
      } else {
        setLegalSections([]);
      }

      if (flow?.shouldAsk && flow.question && flow.questionKey) {
        setStage("interview");
        setPendingFinal(null);
        setEditingSummary(false);
        setPendingClarification({
          question: flow.question,
          questionKey: flow.questionKey,
          options: flow.options,
        });

        const maxForDomain = analysis.domain === "mva" ? MAX_CLARIFICATION_QUESTIONS : 1;
        const answeredSoFar = ctx.questionsAsked.length;
        const progressText =
          answeredSoFar === 0
            ? maxForDomain > 1
              ? "A few quick questions will confirm the best section"
              : "One quick question to confirm it"
            : `Question ${Math.min(answeredSoFar + 1, maxForDomain)} of up to ${maxForDomain}`;

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content: `${progressText} — the confidence score and detailed findings will be shown once the interview is complete.\n\n**${flow.question}**`,
            timestamp: new Date(),
          },
        ]);

        if (flow.options && flow.options.length > 0) {
          const scriptedOptions = flow.options;
          // The incident-type question is essential, so it cannot be skipped.
          const includeSkip = flow.questionKey !== "incident_type";
          setTimeout(() => {
            if (!isMountedRef.current || analysisId !== analysisIdRef.current) return;
            setFollowUpQuestions([
              ...scriptedOptions.map((opt, i) => ({
                id: `${flow.questionKey}-${i}`,
                label: opt,
              })),
              ...(includeSkip
                ? [{ id: `${flow.questionKey}-skip`, label: SKIP_ANSWER_LABEL }]
                : []),
            ]);
            setShowFollowUp(true);
          }, 400);
        }
      } else if (analysis.confidence_score >= 15 && matches.length > 0) {
        // The reference flow asks the user to confirm a structured summary
        // before it reveals the final confidence scores and section cards.
        setPendingClarification(null);
        setFollowUpQuestions([]);
        setShowFollowUp(false);
        setLegalSections(sections);
        const summary =
          analysis.caseSummary?.trim() ||
          "I have enough information to proceed. Please review the facts below before I generate the legal findings.";
        setPendingFinal({ sections, summary });
        setStage("summary");
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content: `${summary}\n\nPerfect! I've gathered the necessary information. Here's a structured summary of your case. Please review it carefully—if anything needs adjustment, let me know before we finalize the legal analysis.`,
            timestamp: new Date(),
          },
        ]);
      } else {
        setPendingClarification(null);
        setPendingFinal(null);
        setStage("interview");
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content:
              "I analyzed your scenario but couldn't find a direct legal match in my database. Could you provide more specific details? Mentioning actions like 'hit', 'stole', 'cheated', or 'injured' helps me match the right laws.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      if (analysisId !== analysisIdRef.current) return;
      console.error("Search error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: "I encountered an error while analyzing your case. Please try again with a different description.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      if (analysisId === analysisIdRef.current) {
        setAnalysisStatus("");
        setIsLoading(false);
      }
    }
  };

  const clearPendingTimer = () => {
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  };

  const scheduleAnalysis = (text: string, ctx: ConversationContext, delay: number) => {
    clearPendingTimer();
    pendingTimerRef.current = window.setTimeout(() => {
      pendingTimerRef.current = null;
      void runAnalysis(text, ctx);
    }, delay);
  };

  /** Start with a clean case and immediately analyse the supplied text. */
  const beginNewCase = (text: string, userMsg: Message) => {
    clearPendingTimer();
    analysisIdRef.current += 1;
    const nextContext = freshContext();

    setMessages([userMsg]);
    setInputValue("");
    setCaseDescription(text);
    setShowScene(false);
    setIsLoading(true);
    setStage("interview");
    setLegalSections([]);
    setAnalysisMeta(emptyMeta());
    setPendingFinal(null);
    setEditingSummary(false);
    setFollowUpQuestions([]);
    setShowFollowUp(false);
    setPendingClarification(null);
    setConversationContext(nextContext);
    setAnalysisStatus("");
    originalQueryRef.current = text;

    scheduleAnalysis(text, nextContext, 900);
  };

  const startNewCase = () => {
    clearPendingTimer();
    analysisIdRef.current += 1;
    setMessages([]);
    setInputValue("");
    setCaseDescription("");
    setShowScene(false);
    setIsLoading(false);
    setStage("interview");
    setLegalSections([]);
    setAnalysisMeta(emptyMeta());
    setPendingFinal(null);
    setEditingSummary(false);
    setFollowUpQuestions([]);
    setShowFollowUp(false);
    setPendingClarification(null);
    setConversationContext(freshContext());
    setAnalysisStatus("");
    originalQueryRef.current = "";
    inputRef.current?.focus();
  };

  const confirmAnalysis = () => {
    if (!pendingFinal) return;
    const count = Math.min(VISIBLE_RESULT_COUNT, pendingFinal.sections.length);
    setLegalSections(pendingFinal.sections);
    setStage("results");
    setEditingSummary(false);
    setPendingFinal(null);
    setShowFollowUp(true);
    setFollowUpQuestions([
      { id: "fq1", label: "What is the punishment?" },
      { id: "fq2", label: "Where do I file this?" },
      { id: "fq3", label: "Can I settle this?" },
    ]);
    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: `✓ Analysis complete! I found ${count} verified legal provision${count === 1 ? "" : "s"} that apply to your case. Review them on the right side for detailed guidance.`,
        timestamp: new Date(),
      },
    ]);
  };

  const startEditingSummary = () => {
    setEditingSummary(true);
    setStage("summary");
    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: "Sure — tell me what needs to change. I'll update the summary before finalizing the legal analysis.",
        timestamp: new Date(),
      },
    ]);
    inputRef.current?.focus();
  };

  const applySummaryEdit = (text: string) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    const combined = `${originalQueryRef.current}. ${text}`;
    const lower = text.toLowerCase();

    // A correction can contradict an earlier chip answer (e.g. "actually there
    // were witnesses"). Drop the old answer for any topic the correction
    // mentions so the new text is parsed cleanly.
    const keyPatterns: Record<string, RegExp> = {
      fir: /\b(fir|complaint|police)\b/,
      witnesses: /\bwitness/,
      evidence: /\b(evidence|photo|video|cctv|recording|footage|medical record)/,
      insurance: /\binsur/,
      injured: /\b(injur|hurt|wound|hospital|fractur)/,
      hit_and_run: /\b(fled|flee|hit[- ]and[- ]run|stopped)\b/,
      drunk: /\b(drunk|alcohol|drink)/,
      licence: /\b(licen[cs]e|driving)\b/,
      overspeeding: /\b(speed|rash|fast)\b/,
      wrong_side: /\b(wrong side|opposite|oncoming)\b/,
      vehicle_type: /\b(car|bike|scooter|truck|bus|auto)\b/,
    };
    const editedKeys = Object.entries(keyPatterns)
      .filter(([, pattern]) => pattern.test(lower))
      .map(([key]) => key);

    const nextAnswers = { ...conversationContext.collectedAnswers };
    const nextQuestionTexts = { ...(conversationContext.questionTexts ?? {}) };
    editedKeys.forEach((key) => {
      delete nextAnswers[key];
      delete nextQuestionTexts[key];
    });
    const nextContext: ConversationContext = {
      ...conversationContext,
      collectedAnswers: nextAnswers,
      questionsAsked: conversationContext.questionsAsked.filter(
        (key) => !editedKeys.includes(key),
      ),
      questionTexts: nextQuestionTexts,
    };

    clearPendingTimer();
    analysisIdRef.current += 1;
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setCaseDescription(combined);
    setShowScene(false);
    setIsLoading(true);
    setStage("interview");
    setPendingFinal(null);
    setEditingSummary(false);
    setFollowUpQuestions([]);
    setShowFollowUp(false);
    setPendingClarification(null);
    setLegalSections([]);
    setAnalysisMeta(emptyMeta());
    setConversationContext(nextContext);
    originalQueryRef.current = combined;
    scheduleAnalysis(combined, nextContext, 800);
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // Summary review: a typed message is treated as a correction.
    if (editingSummary || stage === "summary") {
      applySummaryEdit(text);
      return;
    }

    // If we are waiting for an answer to a clarifying question, treat this
    // input as the answer instead of starting a brand-new case.
    if (pendingClarification) {
      const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: text, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setShowFollowUp(false);

      const { questionKey, question } = pendingClarification;
      // Typing "skip" ends the interview and shows the best answer right away.
      const isSkip = /^\s*skip\b/i.test(text);
      const updatedContext: ConversationContext = {
        ...conversationContext,
        collectedAnswers: {
          ...conversationContext.collectedAnswers,
          [questionKey]: text,
        },
        questionsAsked: [...conversationContext.questionsAsked, questionKey],
        questionTexts: {
          ...(conversationContext.questionTexts ?? {}),
          [questionKey]: question,
        },
        readyForResult: isSkip || conversationContext.readyForResult,
      };
      setConversationContext(updatedContext);
      setPendingClarification(null);
      setIsLoading(true);

      scheduleAnalysis(originalQueryRef.current, updatedContext, 800);
      return;
    }

    // If we already have a result and the user asks a question about it,
    // answer from the current analysis instead of starting a new case.
    if (
      stage === "results" &&
      legalSections.length > 0 &&
      /punishment|sentence|where.*file|which court|settle|compromise/i.test(text)
    ) {
      setInputValue("");
      handleFollowUp(text);
      return;
    }

    // Input validation: minimum 3 characters for meaningful search
    if (text.length < 3) {
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: "Please provide more details about your legal situation (at least 3 characters) so I can find applicable laws.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setInputValue("");
      return;
    }

    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: text, timestamp: new Date() };
    beginNewCase(text, userMsg);
  };

  const handleVoiceTranscript = (text: string) => {
    setInputValue(text);
    inputRef.current?.focus();
  };

  const handleFollowUp = (question: string) => {
    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: question, timestamp: new Date() };

    // ── Answering a clarifying question: record it and re-run analysis ──
    if (pendingClarification) {
      setMessages((prev) => [...prev, userMsg]);
      setShowFollowUp(false);
      const { questionKey, question: questionText } = pendingClarification;
      // The "Skip — show best answer" chip ends the interview immediately.
      const isSkip = /skip/i.test(question);
      const updatedContext: ConversationContext = {
        ...conversationContext,
        collectedAnswers: {
          ...conversationContext.collectedAnswers,
          [questionKey]: question,
        },
        questionsAsked: [...conversationContext.questionsAsked, questionKey],
        questionTexts: {
          ...(conversationContext.questionTexts ?? {}),
          [questionKey]: questionText,
        },
        readyForResult: isSkip || conversationContext.readyForResult,
      };
      setConversationContext(updatedContext);
      setPendingClarification(null);
      setIsLoading(true);

      scheduleAnalysis(originalQueryRef.current, updatedContext, 800);
      return;
    }

    if (stage === "summary") {
      applySummaryEdit(question);
      return;
    }

    // ── Regular follow-up questions about the existing result ──
    const q = question.toLowerCase();
    const top = legalSections[0];
    setMessages((prev) => [...prev, userMsg]);
    setShowFollowUp(false);

    if (q.includes("punishment")) {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: top
            ? `For **${top.sectionName}**, the possible punishment is:\n\n${top.punishment}`
            : "Please describe your case first, then I can tell you the applicable punishment.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }, 600);
      return;
    }

    if (q.includes("file") || q.includes("court") || q.includes("complaint")) {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: top
            ? `You can file this at: **${top.whereToFile}**.\n\n${top.whatToDo}`
            : "Please describe your case first, then I can tell you where to file it.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }, 600);
      return;
    }

    if (q.includes("settle") || q.includes("compromise")) {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content:
            "Whether this can be settled depends on the type of case:\n\n" +
            "- **Criminal offences** (IPC / IT Act) generally cannot be privately settled, though compounding is allowed for some minor offences with court permission.\n" +
            "- **Motor accident compensation claims** can be settled before the Motor Accident Claims Tribunal.\n\n" +
            "For your specific situation, consult a lawyer before agreeing to any settlement.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }, 600);
      return;
    }

    // A genuinely new query: start a fresh conversation with its own context.
    beginNewCase(question, userMsg);
  };

  // The animated scene is opt-in: nothing shows while typing or automatically.
  // It reflects the submitted case plus the answers given during the interview
  // (skip answers are excluded so they never distort the scene).
  const answerSceneText = Object.entries(conversationContext.collectedAnswers)
    .filter(([, value]) => !/skip/i.test(value))
    .map(([, value]) => value)
    .join(" ");
  const sceneText = [caseDescription, answerSceneText].filter(Boolean).join(". ");
  const sceneNode =
    caseDescription.trim().length >= 3 ? (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowScene((value) => !value)}
          aria-expanded={showScene}
          className="text-[10px] font-sans px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary-glow hover:bg-primary/20 transition-colors"
        >
          {showScene ? "Hide scene" : "🎬 Show scene"}
        </button>
        {showScene && <CaseSceneAnimation text={sceneText} />}
      </div>
    ) : undefined;

  const placeholder =
    stage === "results"
      ? "Ask a follow-up question..."
      : editingSummary
        ? "Add or correct a detail..."
        : t.inputPlaceholder;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between gap-3 px-3 md:px-5 py-2.5 border-b border-border/50 bg-background/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate("/")}
            aria-label="Back to home"
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-brand font-bold text-lg leading-none">Margavidi</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="font-sans text-xs text-muted-foreground truncate">{t.caseTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="stage-pill hidden sm:inline-flex">STAGE: {stage.toUpperCase()}</span>
          <AiSettings />
          <LanguageSwitcher />
        </div>
      </header>

      {/* ── Main split ── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* ── Left: Legal Interview ── */}
        <div className="flex flex-col w-full lg:w-[45%] min-h-0 border-r border-border/40">
          <div className="px-4 py-2.5 border-b border-border/30 flex items-center gap-2 flex-shrink-0">
            <div className="cyan-rule h-4" />
            <h2 className="font-sans text-[13px] font-semibold text-foreground">{t.chatPanelTitle}</h2>
            <span className="ml-auto font-mono text-[9px] tracking-[0.14em] text-primary-glow/70 uppercase">
              live
            </span>
          </div>

          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            emptyTitle={t.chatEmptyTitle}
            emptyDesc={t.chatEmptyDesc}
          />

          <div className="flex-shrink-0 bg-background/85 backdrop-blur-md pt-2 pb-4 px-4">
            <div className="max-w-3xl mx-auto flex flex-col gap-2">
              <div className="relative flex items-end gap-2 bg-card/70 border border-border/70 rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary/40 transition-all shadow-sm">
                <VoiceInput
                  onTranscript={handleVoiceTranscript}
                  disabled={isLoading}
                  speechLang={lang.speechLang}
                  compact
                />

                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={placeholder}
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-none outline-none focus:ring-0 px-1.5 py-2.5 font-sans text-[12.5px] text-foreground placeholder:text-muted-foreground/70 min-h-[42px]"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  aria-label="Send message"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 mb-0.5 ${
                    !inputValue.trim()
                      ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      : "bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.35)] hover:bg-primary-glow"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              {pendingClarification && (
                <button
                  type="button"
                  onClick={startNewCase}
                  className="self-center font-sans text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Start a new case instead
                </button>
              )}
              {isLoading && analysisStatus && (
                <p className="text-center text-[10px] text-primary/80 font-sans">{analysisStatus}</p>
              )}
              <p className="text-center text-[9.5px] text-muted-foreground/60 font-sans">
                Margavidi works on AI and can make mistakes. Consider checking important information.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Legal Findings ── */}
        <div className="flex flex-col flex-1 min-h-0 bg-background/35 lg:w-[55%]">
          <LegalOutputPanel
            sections={legalSections}
            stage={stage}
            terms={analysisMeta.terms}
            caseSummary={analysisMeta.caseSummary}
            analysisNote={analysisMeta.note}
            onConfirm={confirmAnalysis}
            onEdit={startEditingSummary}
            followUpQuestions={showFollowUp ? followUpQuestions : []}
            onFollowUp={handleFollowUp}
            isLoading={isLoading}
            outputPanelTitle={t.outputPanelTitle}
            emptyTitle={t.outputEmptyTitle}
            emptyDesc={t.outputEmptyDesc}
            followUpLabel={pendingClarification ? t.followUpLabel : t.followUpResultLabel}
            disclaimerShort={t.disclaimerShort}
            scene={sceneNode}
          />
        </div>
      </div>
    </div>
  );
};

export default CaseAnalysis;
