import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Cpu, BookOpen } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const AnimatedScales = () => (
  <svg
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full animate-float"
    style={{ filter: "drop-shadow(0 0 30px hsl(var(--primary) / 0.4))" }}
  >
    <circle cx="100" cy="100" r="90" stroke="hsl(var(--primary) / 0.08)" strokeWidth="1" />
    <circle cx="100" cy="100" r="75" stroke="hsl(var(--gold) / 0.06)" strokeWidth="0.5" strokeDasharray="4 4" />
    <rect x="97" y="40" width="6" height="130" rx="3" fill="hsl(var(--primary))" opacity="0.85" />
    <circle cx="100" cy="36" r="9" fill="hsl(var(--gold))" opacity="0.95" />
    <circle cx="100" cy="36" r="5" fill="hsl(var(--gold) / 0.6)" opacity="0.6" />
    <rect x="35" y="62" width="130" height="5" rx="2.5" fill="hsl(var(--primary))" opacity="0.85" />
    <line x1="48" y1="67" x2="42" y2="105" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="3,2" opacity="0.6" />
    <line x1="152" y1="67" x2="158" y2="105" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="3,2" opacity="0.6" />
    <path d="M24 110 Q43 125 62 110" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="hsl(var(--primary) / 0.12)" />
    <line x1="24" y1="110" x2="62" y2="110" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.4" />
    <path d="M138 110 Q157 125 176 110" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="hsl(var(--primary) / 0.12)" />
    <line x1="138" y1="110" x2="176" y2="110" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.4" />
    <rect x="76" y="165" width="48" height="7" rx="3.5" fill="hsl(var(--gold))" opacity="0.8" />
    <rect x="82" y="158" width="36" height="10" rx="2" fill="hsl(var(--primary))" opacity="0.5" />
    {[30, 90, 150, 210, 270, 330].map((angle, i) => {
      const rad = (angle * Math.PI) / 180;
      return (
        <circle key={i} cx={100 + 88 * Math.cos(rad)} cy={100 + 88 * Math.sin(rad)} r="1.5" fill="hsl(var(--gold))" opacity="0.4" />
      );
    })}
  </svg>
);

const DomainCard = ({
  icon, title, description, delay, onClick, exploreTxt,
}: {
  icon: string; title: string; description: string; delay: number; onClick: () => void; exploreTxt: string;
}) => (
  <div
    onClick={onClick}
    className="glass-card rounded-2xl p-6 card-lift cursor-pointer group animate-fade-in border border-border/50 hover:border-primary/30 transition-colors"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="font-display font-semibold text-foreground text-lg mb-2 group-hover:text-gold transition-colors">{title}</h3>
    <p className="font-sans text-muted-foreground text-sm leading-relaxed">{description}</p>
    <div className="mt-4 flex items-center gap-1 text-primary text-xs font-sans font-medium opacity-0 group-hover:opacity-100 transition-opacity">
      {exploreTxt} <ArrowRight className="w-3 h-3" />
    </div>
  </div>
);

const FeaturePill = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full border border-border/40">
    <span className="text-primary">{icon}</span>
    <span className="font-sans text-xs text-foreground/80">{text}</span>
  </div>
);

export const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const domains = [
    { icon: "⚖", title: t.domainMVATitle, description: t.domainMVADesc },
    { icon: "🌐", title: t.domainITTitle,  description: t.domainITDesc },
    { icon: "📜", title: t.domainIPCTitle, description: t.domainIPCDesc },
  ];

  const steps = [
    { step: "01", title: t.step1Title, desc: t.step1Desc },
    { step: "02", title: t.step2Title, desc: t.step2Desc },
    { step: "03", title: t.step3Title, desc: t.step3Desc },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-gold font-display font-bold text-xl">Margavidi</span>
          <span className="font-sans text-[10px] text-muted-foreground border border-border/50 rounded px-1.5 py-0.5 ml-1">
            {t.navBeta}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 font-sans text-sm text-muted-foreground">
          <a href="#domains" className="hover:text-foreground transition-colors">{t.navDomains}</a>
          <a href="#about" className="hover:text-foreground transition-colors">{t.navAbout}</a>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button
            onClick={() => navigate("/analyze")}
            className="font-sans text-xs font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg btn-glow hover:bg-primary-glow transition-colors"
          >
            {t.navStartAnalysis}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Legal background" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
          <div className="absolute inset-0 grid-texture opacity-60" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center pt-24">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 glass-card rounded-full border border-gold/20 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              <span className="font-sans text-xs text-gold font-medium">{t.heroTag}</span>
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-none animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <span className="text-foreground">Margavidi</span>
            </h1>

            <p className="font-display text-xl md:text-2xl text-gold/90 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              {t.heroSubtitle}
            </p>

            <p className="font-sans text-muted-foreground text-base leading-relaxed max-w-md animate-slide-up" style={{ animationDelay: "0.3s" }}>
              {t.heroDesc}
            </p>

            <div className="flex flex-wrap gap-3 animate-slide-up" style={{ animationDelay: "0.4s" }}>
              <FeaturePill icon={<Shield className="w-3 h-3" />} text={t.pillMVA} />
              <FeaturePill icon={<Cpu className="w-3 h-3" />} text={t.pillIT} />
              <FeaturePill icon={<BookOpen className="w-3 h-3" />} text={t.pillIPC} />
            </div>

            <div className="flex items-center gap-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
              <button
                onClick={() => navigate("/analyze")}
                className="group flex items-center gap-2 font-sans font-semibold text-sm bg-gradient-primary text-primary-foreground px-8 py-3.5 rounded-xl btn-glow transition-all"
              >
                {t.heroCta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center animate-scale-in" style={{ animationDelay: "0.3s" }}>
            <div className="w-72 h-72 lg:w-80 lg:h-80">
              <AnimatedScales />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ── Domain Cards ── */}
      <section id="domains" className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <p className="font-sans text-xs text-primary font-semibold tracking-widest uppercase animate-fade-in">{t.domainsLabel}</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {t.domainsTitle}
          </h2>
          <p className="font-sans text-muted-foreground text-sm max-w-lg mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {t.domainsSubtitle}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {domains.map((d, i) => (
            <DomainCard key={d.title} {...d} delay={i * 0.12} onClick={() => navigate("/analyze")} exploreTxt={t.domainExplore} />
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="about" className="py-20 px-6 border-t border-border/30">
        <div className="max-w-4xl mx-auto text-center space-y-3 mb-12">
          <p className="font-sans text-xs text-gold font-semibold tracking-widest uppercase">{t.howLabel}</p>
          <h2 className="font-display text-3xl font-bold text-foreground">{t.howTitle}</h2>
        </div>
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {steps.map((item, i) => (
            <div key={item.step} className="text-center space-y-3 animate-fade-in" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <span className="font-display font-bold text-primary text-sm">{item.step}</span>
              </div>
              <h3 className="font-display font-semibold text-foreground">{item.title}</h3>
              <p className="font-sans text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-gold">Margavidi</span>
            <span className="font-sans text-xs text-muted-foreground">© 2025</span>
          </div>
          <p className="font-sans text-xs text-muted-foreground text-center max-w-md">{t.disclaimer}</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
