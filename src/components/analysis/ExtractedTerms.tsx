import { ScanSearch } from "lucide-react";

interface ExtractedTermsProps {
  terms: string[];
}

export const ExtractedTerms = ({ terms }: ExtractedTermsProps) => {
  if (terms.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <ScanSearch className="w-3.5 h-3.5 text-primary" />
        <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted-foreground">
          Extracted terms (research aid)
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {terms.map((term) => (
          <span
            key={term}
            className="rounded-md border border-primary/25 bg-primary/5 px-2 py-1 text-[10px] font-sans text-primary-glow/90"
          >
            {term}
          </span>
        ))}
      </div>
    </section>
  );
};

export default ExtractedTerms;
