import { useMemo, useState } from "react";
import { AlertTriangle, Gauge, ShieldCheck } from "lucide-react";
import type { LegalSection } from "@/components/LegalOutputPanel";

interface AnalysisConfidenceProps {
  sections: LegalSection[];
  /** Honest note from the engine (offline fallback, timeout, etc.). */
  note?: string;
}

const averageConfidence = (sections: LegalSection[]): number => {
  if (sections.length === 0) return 0;
  return Math.round(
    sections.reduce((sum, section) => sum + section.confidence, 0) / sections.length,
  );
};

const shortSectionLabel = (section: LegalSection, index: number): string => {
  const match = section.sectionName.match(/^Section\s+([^\s—]+)/i);
  return match ? `S. ${match[1]}` : `Section ${index + 1}`;
};

export const AnalysisConfidence = ({ sections, note }: AnalysisConfidenceProps) => {
  const [tab, setTab] = useState<"confidence" | "uncertainty">("confidence");
  const visible = sections.slice(0, 5);
  const average = useMemo(() => averageConfidence(visible), [visible]);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dash = (average / 100) * circumference;

  return (
    <section className="panel-surface rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary" />
          <h3 className="font-sans text-sm font-semibold text-foreground">Analysis confidence</h3>
        </div>
        <div className="flex rounded-lg border border-border/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setTab("confidence")}
            className={`px-2.5 py-1 text-[10px] font-sans transition-colors ${
              tab === "confidence"
                ? "bg-primary/15 text-primary-glow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Confidence
          </button>
          <button
            type="button"
            onClick={() => setTab("uncertainty")}
            className={`px-2.5 py-1 text-[10px] font-sans border-l border-border/70 transition-colors ${
              tab === "uncertainty"
                ? "bg-primary/15 text-primary-glow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Uncertainty
          </button>
        </div>
      </div>

      {tab === "confidence" ? (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90" aria-hidden="true">
                <defs>
                  <linearGradient id="confidenceDonut" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                <circle cx="48" cy="48" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke="url(#confidenceDonut)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold text-foreground leading-none">{average}%</span>
                <span className="text-[9px] text-muted-foreground mt-1">average</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {visible.length === sections.length
                  ? `${visible.length} verified provision${visible.length === 1 ? "" : "s"}`
                  : `${visible.length} of ${sections.length} verified provisions`}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                Confidence by identified legal section, on a 0–100% scale.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {visible.map((section, index) => (
              <div key={section.id}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[11px] text-foreground/85 truncate">
                    {shortSectionLabel(section, index)}
                    <span className="text-muted-foreground"> · {section.actName?.replace(/,?\s*\d{4}$/, "") ?? "Act"}</span>
                  </span>
                  <span className="text-[10px] font-mono text-primary-glow">{section.confidence}%</span>
                </div>
                <div className="confidence-track">
                  <div className="confidence-fill" style={{ width: `${Math.max(0, Math.min(100, section.confidence))}%` }} />
                </div>
              </div>
            ))}
          </div>

          {note && (
            <p className="text-[10px] leading-relaxed text-muted-foreground border-t border-border/60 pt-3">
              {note}
            </p>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">What could change this result</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                {note ||
                  "The analysis is based only on the facts you provided. Missing facts about injury, FIR, witnesses, evidence or insurance can change which sections apply."}
              </p>
            </div>
          </div>
          <ul className="space-y-2 text-[11px] text-muted-foreground">
            <li>• This is an educational match, not a judicial decision.</li>
            <li>• A lawyer should verify the final section and the court forum.</li>
            <li>• The confidence score reflects text similarity, not the strength of your case.</li>
          </ul>
        </div>
      )}
    </section>
  );
};

export default AnalysisConfidence;
