import { useState, useRef, useEffect } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { LANGUAGES, type LangCode, useLanguage } from "@/contexts/LanguageContext";

export const LanguageSwitcher = () => {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 glass-card border border-border/50 hover:border-primary/40 px-3 py-1.5 rounded-lg transition-all group"
        title="Switch language"
      >
        <Languages className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="font-sans text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
          {lang.label}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 glass-card border border-border/60 rounded-xl overflow-hidden shadow-card z-50 animate-scale-in">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors
                ${l.code === lang.code
                  ? "bg-primary/15 text-primary"
                  : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                }
              `}
            >
              <span className="font-sans text-sm">{l.label}</span>
              <span className="font-sans text-[10px] text-muted-foreground">{l.labelEn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
