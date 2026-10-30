import { useState, type ReactNode } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { LegalResponseCard } from "./LegalResponseCard";
import { FollowUpChips } from "./FollowUpChips";
import { AnalysisConfidence } from "./analysis/AnalysisConfidence";
import { ExtractedTerms } from "./analysis/ExtractedTerms";
import { LegalAidCard } from "./analysis/LegalAidCard";
import { CaseSummaryCard } from "./analysis/CaseSummaryCard";
import { UncertaintyNote } from "./analysis/UncertaintyNote";
import { SaveCaseBanner } from "./analysis/SaveCaseBanner";

export type AnalysisStage = "interview" | "summary" | "results";

export interface LegalSection {
  id: string;
  sectionName: string;
  actName?: string;
  confidence: number;
  applicableLaw: string;
  explanation: string;
  punishment: string;
  whatToDo: string;
  whereToFile: string;
  keywords?: string[];
  matchReason?: string;
  notes?: string;
  /** True while a clarifying question is still pending (hide confidence/severity). */
  preliminary?: boolean;
}

interface LegalOutputPanelProps {
  sections: LegalSection[];
  stage?: AnalysisStage;
  terms?: string[];
  caseSummary?: string;
  analysisNote?: string;
  onConfirm?: () => void;
  onEdit?: () => void;
  followUpQuestions?: { id: string; label: string }[];
  onFollowUp?: (question: string) => void;
  isLoading?: boolean;
  outputPanelTitle?: string;
  emptyTitle?: string;
  emptyDesc?: string;
  followUpLabel?: string;
  disclaimerShort?: string;
  /** Optional animated scene rendered above the findings. */
  scene?: ReactNode;
}

const VERIFIED_SECTION_LIMIT = 5;

export const LegalOutputPanel = ({
  sections,
  stage = "interview",
  terms = [],
  caseSummary = "",
  analysisNote,
  onConfirm,
  onEdit,
  followUpQuestions,
  onFollowUp,
  isLoading,
  outputPanelTitle = "Legal Findings",
  emptyTitle = "Legal analysis appears here",
  emptyDesc = "After you describe your issue, applicable sections of law will be identified and displayed as structured cards.",
  followUpLabel = "Clarification needed — please select:",
  disclaimerShort = "⚖ Margavidi provides legal educational guidance and does not deliver judicial decisions or replace professional legal advice.",
  scene,
}: LegalOutputPanelProps) => {
  const [showAll, setShowAll] = useState(false);
  const verified = sections.filter((section) => !section.preliminary);
  const visibleSections = showAll ? verified : verified.slice(0, VERIFIED_SECTION_LIMIT);
  const hiddenCount = Math.max(0, verified.length - VERIFIED_SECTION_LIMIT);
  const isResults = stage === "results";
  const isSummary = stage === "summary";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto scrollbar-custom p-4 space-y-3.5">
        {terms.length > 0 && <ExtractedTerms terms={terms} />}

        {isResults && <SaveCaseBanner />}

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2">
            <div className="cyan-rule h-4" />
            <h2 className="font-sans text-[13px] font-semibold tracking-wide text-foreground">{outputPanelTitle}</h2>
          </div>
          {isResults && verified.length > 0 && (
            <span className="font-mono text-[9px] tracking-[0.12em] text-primary-glow/80 uppercase">
              {verified.length} verified
            </span>
          )}
        </div>

        {isResults && (
          <>
            <AnalysisConfidence sections={verified} />
            <LegalAidCard />
            <CaseSummaryCard summary={caseSummary} />
            <UncertaintyNote note={analysisNote} />
          </>
        )}

        {isSummary && (
          <>
            <div className="rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-3 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-medium text-foreground">Summary ready for review</p>
                <p className="text-[10.5px] text-muted-foreground leading-relaxed mt-0.5">
                  Check the facts below. Confirm to generate the legal findings, or edit the details first.
                </p>
              </div>
            </div>
            <CaseSummaryCard summary={caseSummary} review onConfirm={onConfirm} onEdit={onEdit} />
          </>
        )}

        {!isResults && !isSummary && !isLoading && sections.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-12 animate-fade-in h-full">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <p className="font-sans text-foreground/70 text-sm">{emptyTitle}</p>
            <p className="font-sans text-muted-foreground text-[11px] max-w-xs leading-relaxed">{emptyDesc}</p>
          </div>
        )}

        {!isResults && !isSummary && sections.length > 0 && (
          <div className="rounded-xl border border-border/70 bg-card/40 px-4 py-3 flex items-start gap-2.5">
            <Loader2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5 animate-spin" />
            <div>
              <p className="text-[12px] font-medium text-foreground">Analysis in progress</p>
              <p className="text-[10.5px] text-muted-foreground leading-relaxed mt-0.5">
                The confidence score and verified provisions unlock after you confirm the summary.
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3 animate-fade-in">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-2" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="h-3.5 bg-muted rounded w-2/3 animate-pulse" />
                <div className="h-2.5 bg-muted rounded w-1/3 animate-pulse" />
                <div className="h-2.5 bg-muted rounded w-full animate-pulse" />
                <div className="h-2.5 bg-muted rounded w-4/5 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {isResults &&
          visibleSections.map((section, idx) => (
            <LegalResponseCard key={section.id} section={section} index={idx} />
          ))}

        {isResults && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="w-full rounded-lg border border-border/70 bg-card/30 py-2.5 text-[10.5px] font-sans text-muted-foreground hover:text-primary-glow hover:border-primary/30 transition-colors"
          >
            {showAll ? "Show only the top 5 provisions" : `Show all ${verified.length} provisions`}
          </button>
        )}

        {isResults && scene && <div className="animate-fade-in">{scene}</div>}

        {!isLoading && followUpQuestions && followUpQuestions.length > 0 && onFollowUp && (
          <div className="pt-1">
            <FollowUpChips questions={followUpQuestions} onSelect={onFollowUp} label={followUpLabel} />
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border/30 flex-shrink-0">
        <p className="font-sans text-[9.5px] text-muted-foreground/80 leading-relaxed text-center">{disclaimerShort}</p>
      </div>
    </div>
  );
};

export default LegalOutputPanel;
