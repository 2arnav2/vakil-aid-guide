interface WaveformBarProps {
  delay: number;
}

const WaveformBar = ({ delay }: WaveformBarProps) => (
  <div
    className="animate-waveform rounded-full"
    style={{
      width: "3px",
      height: "24px",
      background: `hsl(var(--primary))`,
      animationDelay: `${delay}s`,
      animationDuration: `${0.6 + Math.random() * 0.4}s`,
    }}
  />
);

const ScalesOfJustice = ({ isActive }: { isActive: boolean }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-500 ${isActive ? "animate-scales-sway" : "animate-float"}`}
    style={{ filter: isActive ? "drop-shadow(0 0 20px hsl(var(--primary) / 0.8))" : "drop-shadow(0 0 8px hsl(var(--primary) / 0.4))" }}
  >
    <rect x="58" y="20" width="4" height="80" rx="2" fill="hsl(var(--primary))" opacity="0.9" />
    <circle cx="60" cy="18" r="5" fill="hsl(var(--gold))" opacity="0.95" />
    <rect x="20" y="36" width="80" height="3" rx="1.5" fill="hsl(var(--primary))" opacity="0.9" />
    <line x1="28" y1="39" x2="24" y2="66" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.7" />
    <line x1="92" y1="39" x2="96" y2="66" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.7" />
    <path d="M14 68 Q24 76 34 68" stroke="hsl(var(--primary))" strokeWidth="2" fill="hsl(var(--primary) / 0.15)" />
    <line x1="14" y1="68" x2="34" y2="68" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
    <path d="M86 68 Q96 76 106 68" stroke="hsl(var(--primary))" strokeWidth="2" fill="hsl(var(--primary) / 0.15)" />
    <line x1="86" y1="68" x2="106" y2="68" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
    <rect x="44" y="98" width="32" height="4" rx="2" fill="hsl(var(--gold))" opacity="0.8" />
    <rect x="50" y="96" width="20" height="4" rx="1" fill="hsl(var(--primary))" opacity="0.6" />
    <circle cx="60" cy="60" r="52" stroke="hsl(var(--primary))" strokeWidth="0.5" opacity="0.15" strokeDasharray="4,4" />
    <circle cx="60" cy="60" r="45" stroke="hsl(var(--gold))" strokeWidth="0.3" opacity="0.1" />
  </svg>
);

interface LawyerAnimationProps {
  isActive: boolean;
  listeningLabel?: string;
  inactiveLabel?: string;
}

export const LawyerAnimation = ({ isActive, listeningLabel = "Listening...", inactiveLabel = "Voice Inactive" }: LawyerAnimationProps) => {
  return (
    <div
      className={`flex flex-col items-center gap-3 transition-all duration-500 ${
        isActive ? "opacity-100 scale-100" : "opacity-30 scale-95"
      }`}
    >
      <div className="relative w-20 h-20 flex items-center justify-center">
        {isActive && (
          <>
            <div className="absolute inset-0 rounded-full border border-primary/30" style={{ animation: "mic-ring 1.5s ease-out infinite" }} />
            <div className="absolute inset-0 rounded-full border border-primary/20" style={{ animation: "mic-ring 1.5s ease-out infinite", animationDelay: "0.5s" }} />
          </>
        )}
        <div className="w-16 h-16">
          <ScalesOfJustice isActive={isActive} />
        </div>
      </div>

      {isActive && (
        <div className="flex items-end gap-1 h-6">
          {Array.from({ length: 12 }, (_, i) => (
            <WaveformBar key={i} delay={i * 0.07} />
          ))}
        </div>
      )}

      <span
        className={`text-xs font-sans font-medium transition-colors duration-300 ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {isActive ? listeningLabel : inactiveLabel}
      </span>
    </div>
  );
};

export default LawyerAnimation;
