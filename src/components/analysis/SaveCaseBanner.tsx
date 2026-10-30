import { useState } from "react";
import { Database, LogIn, X } from "lucide-react";
import { toast } from "sonner";

export const SaveCaseBanner = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const handleSignIn = () => {
    toast("Supabase is not connected yet", {
      description: "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable case saving.",
    });
  };

  return (
    <section className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-3.5 py-2.5">
      <Database className="w-4 h-4 text-primary flex-shrink-0" />
      <p className="flex-1 text-[10.5px] leading-relaxed text-muted-foreground">
        Analysis is ready. <span className="text-foreground">Sign in to Supabase</span> to save this case to the database.
      </p>
      <button
        type="button"
        onClick={handleSignIn}
        className="inline-flex items-center gap-1 rounded-md border border-primary/35 px-2.5 py-1.5 text-[10px] font-medium text-primary-glow hover:bg-primary/10 transition-colors whitespace-nowrap"
      >
        <LogIn className="w-3 h-3" />
        Sign in
      </button>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss save banner"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </section>
  );
};

export default SaveCaseBanner;
