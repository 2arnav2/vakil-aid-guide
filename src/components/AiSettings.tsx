import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GEMINI_MODELS,
  checkGemini,
  clearGeminiSettings,
  getGeminiKey,
  getGeminiModel,
  hasGeminiKey,
  saveGeminiSettings,
} from "@/lib/gemini";

type Status = { type: "success" | "error" | "info"; message: string } | null;

export const AiSettings = () => {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(getGeminiModel());
  const [status, setStatus] = useState<Status>(null);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(hasGeminiKey());

  useEffect(() => {
    if (!open) return;
    setApiKey(getGeminiKey());
    setModel(getGeminiModel());
    setStatus(null);
  }, [open]);

  const handleSave = () => {
    const hasTypedKey = Boolean(apiKey.trim());
    saveGeminiSettings({ apiKey, model });
    const nowConfigured = hasGeminiKey();
    setModel(getGeminiModel());
    setConfigured(nowConfigured);
    setStatus({
      type: nowConfigured ? "success" : "info",
      message: !nowConfigured
        ? "Key removed. The app will use local rules and semantic search."
        : hasTypedKey
          ? "Saved in this browser. Google AI will be used only when local matching is weak."
          : "Saved browser key removed. The app is using the key from .env.",
    });
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setStatus({ type: "error", message: "Enter a Google AI Studio API key first." });
      return;
    }

    setTesting(true);
    setStatus({ type: "info", message: "Testing the connection…" });

    try {
      const result = await checkGemini({ apiKey, model });
      if (!result.available) {
        setStatus({ type: "error", message: result.error || "Could not connect to Google AI." });
        return;
      }

      let modelToSave = model;
      let modelNote = "";
      if (result.modelAvailable === false) {
        const fallback =
          result.models.find((name) => /flash/i.test(name)) ?? result.models[0];
        if (fallback) {
          modelToSave = fallback;
          setModel(fallback);
          modelNote = ` The key works, but "${model}" was not listed, so I switched to "${fallback}".`;
        } else {
          modelNote = ` The key works, but "${model}" was not listed.`;
        }
      }

      // Testing a working key should also save it. Otherwise a user can see
      // "Connected" and assume the app is using Google AI, when it is not.
      saveGeminiSettings({ apiKey, model: modelToSave });
      const saved = hasGeminiKey();
      setConfigured(saved);
      setStatus({
        type: saved ? "success" : "error",
        message: saved
          ? `Connected and saved.${modelNote}`
          : "Connected, but this browser blocked local storage. Use .env.local or allow storage.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not connect to Google AI.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    clearGeminiSettings();
    setApiKey(getGeminiKey());
    setModel(getGeminiModel());
    const stillConfigured = hasGeminiKey();
    setConfigured(stillConfigured);
    setStatus({
      type: "info",
      message: stillConfigured
        ? "Saved browser key removed. The app is still using the key from .env."
        : "Key removed from this browser.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Google AI settings"
          title="Google AI settings"
          className="relative w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          {configured && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Google AI settings</DialogTitle>
          <DialogDescription>
            Optional. Add your own Google AI Studio key so Gemini can understand cases that
            keyword and semantic search cannot match. Without a key, everything stays local.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="gemini-key" className="text-sm font-medium text-foreground">
              Google AI Studio API key
            </label>
            <Input
              id="gemini-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="AIza…"
            />
            <p className="text-xs text-muted-foreground">
              Get a key from{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Google AI Studio
              </a>
              .
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="gemini-model" className="text-sm font-medium text-foreground">
              Model
            </label>
            <Input
              id="gemini-model"
              list="gemini-model-options"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              spellCheck={false}
            />
            <datalist id="gemini-model-options">
              {GEMINI_MODELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              The model name can be typed manually if Google releases a newer one.
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
            <strong>Privacy and cost:</strong> the key is stored only in this browser. For a
            public website, use a backend proxy instead of exposing a key in the page. Google
            may charge for API usage, and the text of a weak-match case is sent to Google when
            this key is configured.
          </div>

          {status && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                status.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : status.type === "error"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-border/60 bg-muted/30 text-muted-foreground"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              ) : status.type === "error" ? (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              ) : null}
              <span>{status.message}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} size="sm">
              Save
            </Button>
            <Button onClick={handleTest} size="sm" variant="outline" disabled={testing}>
              {testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {testing ? "Testing…" : "Test & save"}
            </Button>
            <Button onClick={handleClear} size="sm" variant="ghost">
              Clear key
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
