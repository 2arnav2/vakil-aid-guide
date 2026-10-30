import { ClipboardList, Check, Pencil } from "lucide-react";

interface CaseSummaryCardProps {
  summary: string;
  /** Show confirm/edit actions while the user reviews the collected facts. */
  review?: boolean;
  onConfirm?: () => void;
  onEdit?: () => void;
}

export const CaseSummaryCard = ({ summary, review, onConfirm, onEdit }: CaseSummaryCardProps) => {
  return (
    <section className="panel-surface rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/70">
        <ClipboardList className="w-4 h-4 text-primary" />
        <h3 className="font-sans text-sm font-semibold text-foreground">Summary</h3>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-[12px] leading-relaxed text-foreground/85">
          {summary || "No structured facts were collected yet. Add a few details so the analysis can identify the right provisions."}
        </p>
        {review && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground hover:bg-primary-glow transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Confirm analysis
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] text-foreground/85 hover:border-primary/40 hover:text-primary-glow transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit details
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default CaseSummaryCard;
