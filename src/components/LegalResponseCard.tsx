import { useState } from "react";
import { ChevronDown, Shield, BookOpen, Gavel, MapPin, Wrench } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LegalSection {
  id: string;
  sectionName: string;
  actName?: string;
  confidence: number;
  applicableLaw: string;
  explanation: string;
  punishment: string;
  whatToDo: string;
  whereToFile: string;
  notes?: string;
  /** True while a clarifying question is still pending. */
  preliminary?: boolean;
}

interface LegalResponseCardProps {
  section: LegalSection;
  index: number;
}

const ConfidenceBadge = ({ value }: { value: number }) => {
  const { t } = useLanguage();
  const cls =
    value >= 75
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
      : value >= 50
        ? "border-primary/35 bg-primary/10 text-primary-glow"
        : "border-amber-500/35 bg-amber-500/10 text-amber-300";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-1 rounded-md border ${cls}`}
      aria-label={`${t.confidenceLabel}: ${value}%`}
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {value}% {t.confidenceLabel}
    </span>
  );
};

interface CollapsibleBlockProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleBlock = ({ icon, label, children, defaultOpen = false }: CollapsibleBlockProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-foreground/90 font-sans font-medium text-[11.5px]">
          <span className="text-primary">{icon}</span>
          {label}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-3 py-2.5 text-[11.5px] text-muted-foreground font-sans leading-relaxed animate-fade-in border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
};

export const LegalResponseCard = ({ section, index }: LegalResponseCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();

  return (
    <div
      className={`rounded-xl overflow-hidden animate-fade-in border bg-card/55 backdrop-blur-sm transition-colors ${
        section.preliminary
          ? "border-amber-500/25"
          : "border-border/70 hover:border-primary/30"
      }`}
      style={{ animationDelay: `${index * 0.12}s` }}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block flex-shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
            <h3 className="font-sans font-semibold text-foreground text-[13px] leading-snug">
              {section.sectionName}
            </h3>
          </div>
          {section.actName && (
            <p className="font-sans text-[10.5px] text-muted-foreground mb-2">{section.actName}</p>
          )}
          {section.preliminary ? (
            <span className="inline-block text-[10px] font-sans px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200">
              Likely section — answer the question to confirm
            </span>
          ) : (
            <ConfidenceBadge value={section.confidence} />
          )}
        </div>
        {!section.preliminary && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="text-[10px] text-primary hover:text-primary-glow font-sans flex items-center gap-1 transition-colors mt-0.5 whitespace-nowrap"
          >
            {expanded ? t.collapse : t.viewDetails}
            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Quick law preview */}
      <div className="px-4 pb-3.5">
        <p className="text-[11px] font-sans text-muted-foreground leading-relaxed line-clamp-2">
          {section.applicableLaw}
        </p>
      </div>

      {section.notes && (
        <div className="mx-4 mb-3.5 rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-2.5">
          <p className="font-sans text-[11px] text-foreground/80 leading-relaxed">{section.notes}</p>
        </div>
      )}

      {/* Expanded Details (hidden until the section is confirmed) */}
      {expanded && !section.preliminary && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-border/50 pt-3.5 animate-slide-up">
          <CollapsibleBlock icon={<Shield className="w-3.5 h-3.5" />} label="📌 Applicable Law" defaultOpen>
            {section.applicableLaw}
          </CollapsibleBlock>
          <CollapsibleBlock icon={<BookOpen className="w-3.5 h-3.5" />} label="📖 Explanation in Simple Terms" defaultOpen>
            {section.explanation}
          </CollapsibleBlock>
          <CollapsibleBlock icon={<Gavel className="w-3.5 h-3.5" />} label="⚖ Possible Punishment">
            {section.punishment}
          </CollapsibleBlock>
          <CollapsibleBlock icon={<Wrench className="w-3.5 h-3.5" />} label="🛠 What You Can Do">
            {section.whatToDo}
          </CollapsibleBlock>
          <CollapsibleBlock icon={<MapPin className="w-3.5 h-3.5" />} label="🏛 Where to File Complaint">
            {section.whereToFile}
          </CollapsibleBlock>
        </div>
      )}
    </div>
  );
};

export default LegalResponseCard;
