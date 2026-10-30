import { AlertTriangle } from "lucide-react";

interface UncertaintyNoteProps {
  note?: string;
}

export const UncertaintyNote = ({ note }: UncertaintyNoteProps) => {
  return (
    <section className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-amber-300/90">Uncertainty</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
            {note ||
              "The AI explanation was not available within the legal-response time limit. The sections below are based on the offline rule match and the facts you provided."}
          </p>
        </div>
      </div>
    </section>
  );
};

export default UncertaintyNote;
