import { ExternalLink, Landmark, Mail, Phone, Scale, UserRound } from "lucide-react";

const NALSA_HELPLINE = "15100";
const NALSA_OFFICE = "+91 11 2338 2778";
const NALSA_EMAIL = "nalsa-dla@nic.in";
const NALSA_URL = "https://nalsa.gov.in/";

const DetailRow = ({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 text-primary">{icon}</span>
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      {href ? (
        <a
          href={href}
          className="text-[12px] text-foreground hover:text-primary-glow underline-offset-2 hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <p className="text-[12px] text-foreground break-all">{value}</p>
      )}
    </div>
  </div>
);

export const LegalAidCard = () => {
  return (
    <section className="panel-surface rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/70">
        <Landmark className="w-4 h-4 text-primary" />
        <h3 className="font-sans text-sm font-semibold text-foreground">India-wide legal aid</h3>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
            <Scale className="w-4 h-4 text-primary" />
          </span>
          <div>
            <p className="text-[12px] font-medium text-foreground">NALSA — National Legal Services Authority</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Free legal aid and advocate support for eligible citizens across India.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow icon={<Phone className="w-3.5 h-3.5" />} label="NALSA helpline" value={NALSA_HELPLINE} href="tel:15100" />
          <DetailRow icon={<Phone className="w-3.5 h-3.5" />} label="NALSA office" value={NALSA_OFFICE} href="tel:+911123382778" />
          <DetailRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={NALSA_EMAIL} href={`mailto:${NALSA_EMAIL}`} />
          <DetailRow
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            label="Directory"
            value="NALSA contact details"
            href={NALSA_URL}
          />
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <UserRound className="w-4 h-4 text-gold flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-foreground truncate">Adv. A. Sharma · sample advocate</p>
                <p className="text-[10px] text-muted-foreground">Legal aid panel · Delhi</p>
              </div>
            </div>
            <a
              href="tel:+919876543210"
              className="text-[10px] text-primary-glow border border-primary/30 rounded-md px-2 py-1 hover:bg-primary/10 transition-colors whitespace-nowrap"
            >
              +91 98765 43210
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
          <a href={NALSA_URL} className="text-primary-glow hover:underline inline-flex items-center gap-1">
            Search NALSA directory <ExternalLink className="w-3 h-3" />
          </a>
          <a href={NALSA_URL} className="text-primary-glow hover:underline inline-flex items-center gap-1">
            Legal aid and advocate FAQ
          </a>
          <a href="tel:15100" className="text-muted-foreground hover:text-foreground">
            Call 15100
          </a>
        </div>
      </div>
    </section>
  );
};

export default LegalAidCard;
