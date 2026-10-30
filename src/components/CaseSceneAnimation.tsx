import { useMemo } from "react";
import { buildSceneScript, type SceneCue, type SceneScript, type SceneVehicle } from "@/lib/scene";

interface CaseSceneAnimationProps {
  /** The submitted case text (plus any answers collected during the interview). */
  text: string;
  className?: string;
}

const TONES: Record<SceneCue["tone"], string> = {
  danger: "border-red-500/40 bg-red-500/10 text-red-200",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
};

const SKY = (
  <defs>
    <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#0d1220" />
      <stop offset="100%" stopColor="#1a2233" />
    </linearGradient>
    <linearGradient id="scene-sky-night" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#05070f" />
      <stop offset="100%" stopColor="#0e1420" />
    </linearGradient>
    <linearGradient id="scene-screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#12233d" />
      <stop offset="100%" stopColor="#0d1a2e" />
    </linearGradient>
  </defs>
);

/** Static position wrapper + animated inner group, so CSS animations never
 *  overwrite the SVG `transform` attribute that positions the artwork. */
const Animated = ({
  x,
  y,
  className,
  children,
  scaleX = 1,
}: {
  x: number;
  y: number;
  className?: string;
  children: React.ReactNode;
  scaleX?: number;
}) => (
  <g transform={`translate(${x} ${y})`}>
    <g className={className}>
      <g transform={scaleX === -1 ? "scale(-1,1)" : undefined}>{children}</g>
    </g>
  </g>
);

// ── Friendly flat characters ─────────────────────────────────────────────────

type PersonPose = "stand" | "walk" | "run" | "lie" | "sit" | "ride";

const SKIN = "#f0c49a";
const HAIR = "#262b36";
const EYES = "#1f232c";
const PANTS = "#39455c";

const Head = ({
  skin = SKIN,
  hair = HAIR,
  longHair = false,
}: {
  skin?: string;
  hair?: string;
  longHair?: boolean;
}) => (
  <g transform="translate(0 -33)">
    {longHair && <rect x={-8.5} y={-1} width={17} height={15} rx={7} fill={hair} />}
    <circle cx={0} cy={-0.8} r={7.9} fill={hair} />
    <circle cx={0} cy={0.9} r={7.1} fill={skin} />
    <circle cx={-2.5} cy={0.7} r={1.15} fill={EYES} />
    <circle cx={2.5} cy={0.7} r={1.15} fill={EYES} />
  </g>
);

/** A jointed limb (arm or leg). The CSS swing classes rotate it around the
 *  top-center (the shoulder / hip), which is why the rect starts at y = 0. */
const Limb = ({
  x,
  y,
  h,
  fill,
  className,
  hand,
  rotate = 0,
}: {
  x: number;
  y: number;
  h: number;
  fill: string;
  className?: string;
  hand?: string;
  rotate?: number;
}) => (
  <g transform={`translate(${x} ${y})${rotate ? ` rotate(${rotate})` : ""}`}>
    <rect x={-2.3} y={0} width={4.6} height={h} rx={2.3} fill={fill} className={className} />
    {hand && <circle cx={0} cy={h} r={2.1} fill={hand} />}
  </g>
);

const Person = ({
  x,
  y,
  pose = "stand",
  color = "#c9d4ea",
  skin = SKIN,
  hair = HAIR,
  className,
  flip = false,
  longHair = false,
}: {
  x: number;
  y: number;
  pose?: PersonPose;
  color?: string;
  skin?: string;
  hair?: string;
  className?: string;
  flip?: boolean;
  longHair?: boolean;
}) => {
  const walk = pose === "walk";
  const run = pose === "run";
  const bodyClass = className ?? (walk ? "scene-walk-bob" : run ? "scene-run-bob" : undefined);
  const armA = walk ? "scene-swing-alt" : run ? "scene-swing-run-alt" : undefined;
  const armB = walk ? "scene-swing" : run ? "scene-swing-run" : undefined;
  const legA = walk ? "scene-swing" : run ? "scene-swing-run" : undefined;
  const legB = walk ? "scene-swing-alt" : run ? "scene-swing-run-alt" : undefined;

  const body =
    pose === "lie" ? (
      <>
        <circle cx={-15} cy={-13} r={7.9} fill={hair} />
        <circle cx={-15} cy={-11.6} r={7.1} fill={skin} />
        <circle cx={-17.4} cy={-11.8} r={1.15} fill={EYES} />
        <circle cx={-12.6} cy={-11.8} r={1.15} fill={EYES} />
        <rect x={-8} y={-14} width={21} height={13} rx={6.5} fill={color} />
        <rect x={12} y={-11.5} width={17} height={5} rx={2.5} fill={PANTS} />
        <rect x={12} y={-5.5} width={17} height={5} rx={2.5} fill={PANTS} />
        <rect x={-7} y={-19} width={4.6} height={10} rx={2.3} fill={color} />
        <circle cx={-7} cy={-21} r={2.1} fill={skin} />
      </>
    ) : pose === "sit" ? (
      <>
        <Head skin={skin} hair={hair} longHair={longHair} />
        <rect x={-7.5} y={-24} width={15} height={24} rx={7} fill={color} />
        <Limb x={0} y={-21} h={9} fill={color} hand={skin} rotate={-24} />
        <g transform="translate(2 0)">
          <rect x={0} y={-2.5} width={16} height={5} rx={2.5} fill={PANTS} />
          <rect x={13.5} y={-2.5} width={5} height={11} rx={2.5} fill={PANTS} />
        </g>
        <g transform="translate(-2 -7)">
          <rect x={0} y={-2.5} width={15} height={5} rx={2.5} fill={PANTS} />
          <rect x={12.5} y={-2.5} width={5} height={11} rx={2.5} fill={PANTS} />
        </g>
      </>
    ) : pose === "ride" ? (
      <>
        <g transform="translate(0 -11) rotate(14) translate(0 11)">
          <circle cx={0} cy={-33} r={8.2} fill="#e2564a" />
          <path
            d="M-3 -35 a7 7 0 0 1 6 -1"
            stroke="#ffffff"
            strokeOpacity="0.5"
            strokeWidth="1.6"
            fill="none"
          />
          <rect x={-7.5} y={-26} width={15} height={17} rx={7} fill={color} />
          <Limb x={-7.5} y={-23} h={11} fill={color} hand={skin} rotate={-38} />
          <Limb x={7.5} y={-23} h={11} fill={color} hand={skin} rotate={-42} />
        </g>
        <g transform="translate(0 -9)">
          <rect x={0} y={-2.5} width={14} height={5} rx={2.5} fill={PANTS} />
          <rect x={11} y={-2.5} width={5} height={10} rx={2.5} fill={PANTS} />
        </g>
      </>
    ) : (
      <>
        <Head skin={skin} hair={hair} longHair={longHair} />
        <rect x={-8.5} y={-26} width={17} height={18} rx={7.5} fill={color} />
        <Limb x={-8.2} y={-23.5} h={13} fill={color} className={armA} hand={skin} rotate={pose === "stand" ? 8 : 0} />
        <Limb x={8.2} y={-23.5} h={13} fill={color} className={armB} hand={skin} rotate={pose === "stand" ? -8 : 0} />
        <Limb x={-4.3} y={-9.5} h={9.5} fill={PANTS} className={legA} />
        <Limb x={4.3} y={-9.5} h={9.5} fill={PANTS} className={legB} />
      </>
    );

  return (
    <g data-person={pose}>
      <Animated x={x} y={y} className={bodyClass} scaleX={flip ? -1 : 1}>
        {body}
      </Animated>
    </g>
  );
};

// ── Vehicles ────────────────────────────────────────────────────────────────

/** A wheel with a spinning spoke cross, so motion is actually visible. */
const Wheel = ({ cx, cy, r = 8, fast = false }: { cx: number; cy: number; r?: number; fast?: boolean }) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill="#0b0f18" />
    <g transform={`translate(${cx} ${cy})`}>
      <g className={fast ? "scene-wheel-fast" : "scene-wheel"}>
        <line x1={-r * 0.72} y1={0} x2={r * 0.72} y2={0} stroke="#8b98b3" strokeWidth="1.5" />
        <line x1={0} y1={-r * 0.72} x2={0} y2={r * 0.72} stroke="#8b98b3" strokeWidth="1.5" />
      </g>
    </g>
    <circle cx={cx} cy={cy} r={r * 0.42} fill="#5d6b83" />
  </>
);

const Vehicle = ({
  kind,
  x,
  y,
  color,
  className,
  flip = false,
  tilt = 0,
  fast = false,
  lights = false,
  wobble = false,
}: {
  kind: SceneVehicle;
  x: number;
  y: number;
  color: string;
  className?: string;
  /** Face the other way (scaleX -1) — used for oncoming vehicles. */
  flip?: boolean;
  /** Degress of roll — a fallen bike leans, a wreck tilts. */
  tilt?: number;
  /** Faster wheel spin when speeding was mentioned. */
  fast?: boolean;
  /** Night headlight beam. */
  lights?: boolean;
  /** The drunk driver's vehicle wobbles. */
  wobble?: boolean;
}) => {
  const frontX = kind === "truck" ? 100 : kind === "bike" ? 52 : 86;
  const art = (
    <>
      {lights && (
        <path
          d={`M${frontX} -12 L${frontX + 56} -32 L${frontX + 56} 10 Z`}
          fill="#ffe9a8"
          opacity="0.16"
        />
      )}
      {kind === "truck" ? (
        <>
          <rect x="0" y="-32" width="70" height="32" rx="4" fill={color} opacity="0.85" />
          <rect x="70" y="-24" width="30" height="24" rx="5" fill={color} />
          <rect x="78" y="-20" width="14" height="10" rx="2" fill="#9fd0ff" opacity="0.85" />
          <Wheel cx={18} cy={2} fast={fast} />
          <Wheel cx={62} cy={2} fast={fast} />
          <Wheel cx={88} cy={2} fast={fast} />
        </>
      ) : kind === "bike" ? (
        <>
          <Wheel cx={0} cy={0} r={10} fast={fast} />
          <Wheel cx={42} cy={0} r={10} fast={fast} />
          <path d="M0 0 L20 -12 L42 0" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <line x1="20" y1="-12" x2="24" y2="-26" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M10 -8 L32 -8" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M0 0 L14 -16 L66 -16 L84 0 Z" fill={color} />
          <rect x="0" y="-2" width="86" height="14" rx="6" fill={color} />
          <path d="M22 -14 L30 -24 L58 -24 L68 -14 Z" fill="#9fd0ff" opacity="0.8" />
          <Wheel cx={20} cy={10} fast={fast} />
          <Wheel cx={66} cy={10} fast={fast} />
          <circle cx="84" cy="-6" r="3" fill="#ffe6a3" />
        </>
      )}
    </>
  );

  return (
    <g data-vehicle={kind}>
      <Animated x={x} y={y} className={className} scaleX={flip ? -1 : 1}>
        <g className={wobble ? "scene-wobble" : undefined}>
          {tilt !== 0 ? <g transform={`rotate(${tilt})`}>{art}</g> : art}
        </g>
      </Animated>
    </g>
  );
};

// ── Scene furniture ─────────────────────────────────────────────────────────

const Ground = ({ wet = false }: { wet?: boolean }) => (
  <>
    <rect x="0" y="140" width="480" height="60" fill={wet ? "#101622" : "#151b28"} />
    <line x1="0" y1="140" x2="480" y2="140" stroke="#2a3346" strokeWidth="2" />
    <line
      x1="0"
      y1="172"
      x2="480"
      y2="172"
      stroke="#5c6b8a"
      strokeWidth="3"
      strokeDasharray="18 14"
      className="scene-dash"
    />
  </>
);

const CityBackdrop = ({ night }: { night: boolean }) => {
  const buildings = [
    { x: 296, w: 44, h: 62 },
    { x: 344, w: 36, h: 92 },
    { x: 384, w: 50, h: 58 },
    { x: 438, w: 34, h: 78 },
  ];
  return (
    <g data-backdrop="city">
      {buildings.map((b) => (
        <g key={b.x}>
          <rect x={b.x} y={140 - b.h} width={b.w} height={b.h} fill={night ? "#141d30" : "#1d2740"} />
          {[0, 1, 2].map((r) =>
            [0, 1].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={b.x + 7 + c * 17}
                y={140 - b.h + 8 + r * 17}
                width={8}
                height={9}
                rx={1.5}
                fill={night ? "#ffd166" : "#2a3852"}
                opacity={night ? 0.55 : 1}
              />
            )),
          )}
        </g>
      ))}
    </g>
  );
};

const Tree = ({ x }: { x: number }) => (
  <g>
    <rect x={x - 2} y={102} width={4} height={38} rx={2} fill="#3b2f22" />
    <circle cx={x} cy={92} r={20} fill="#1f4a34" />
    <circle cx={x - 12} cy={102} r={12} fill="#256044" />
    <circle cx={x + 12} cy={102} r={12} fill="#256044" />
  </g>
);

const HighwayBackdrop = ({ night }: { night: boolean }) => (
  <g data-backdrop="highway" opacity={night ? 0.8 : 1}>
    <Tree x={316} />
    <Tree x={384} />
    <Tree x={452} />
    {/* kilometre post */}
    <rect x={24} y={112} width={26} height={28} rx={3} fill={night ? "#2a3346" : "#c9d4ea"} />
    <rect x={29} y={119} width={16} height={3} rx={1.5} fill="#1b2436" />
    <rect x={29} y={127} width={11} height={3} rx={1.5} fill="#1b2436" />
  </g>
);

const TrafficSignal = () => (
  <g data-signal>
    <rect x="440" y="62" width="5" height="78" rx="2.5" fill="#1b2436" />
    <rect x="430" y="26" width="24" height="48" rx="6" fill="#0f1726" stroke="#2a3346" strokeWidth="2" />
    <circle cx="442" cy="38" r="5" fill="#ff5a5a" className="scene-pulse" />
    <circle cx="442" cy="50" r="5" fill="#3a2d12" />
    <circle cx="442" cy="62" r="5" fill="#16301f" />
  </g>
);

const StreetLamp = () => (
  <g data-lamp>
    <rect x="22" y="50" width="4" height="90" rx="2" fill="#1b2436" />
    <path d="M24 52 h20" stroke="#1b2436" strokeWidth="4" strokeLinecap="round" />
    <circle cx="46" cy="56" r="5" fill="#ffe6a3" className="scene-pulse" />
    <path d="M46 58 L6 140 L86 140 Z" fill="#ffe6a3" opacity="0.06" />
  </g>
);

const Rain = () => (
  <g data-rain stroke="#9fd0ff" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round">
    {Array.from({ length: 12 }, (_, i) => (
      <line
        key={i}
        x1={20 + i * 40}
        y1={-8}
        x2={12 + i * 40}
        y2={6}
        className="scene-rain"
        style={{ animationDelay: `${(i % 4) * 0.3}s` }}
      />
    ))}
  </g>
);

const SpeedLines = ({ x, y }: { x: number; y: number }) => (
  <g data-speedlines stroke="#9fd0ff" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round">
    <line x1={x} y1={y - 7} x2={x - 20} y2={y - 7} className="scene-speedline" />
    <line x1={x + 6} y1={y} x2={x - 30} y2={y} className="scene-speedline" style={{ animationDelay: "0.2s" }} />
    <line x1={x} y1={y + 7} x2={x - 18} y2={y + 7} className="scene-speedline" style={{ animationDelay: "0.4s" }} />
  </g>
);

const ImpactStar = ({ x, y, size = 1 }: { x: number; y: number; size?: number }) => (
  <Animated x={x} y={y} className="scene-impact">
    <g transform={`scale(${size})`}>
      <path d="M0 -16 L5 -5 L17 -8 L8 2 L14 14 L2 8 L-7 16 L-5 4 L-16 0 L-4 -3 Z" fill="#ffd166" />
      <circle cx="0" cy="0" r="20" fill="#ff5a5a" opacity="0.25" />
    </g>
  </Animated>
);

const WarningSign = ({ x, y }: { x: number; y: number }) => (
  <Animated x={x} y={y} className="scene-bob">
    <path d="M0 -16 L16 14 L-16 14 Z" fill="#3a1d10" stroke="#f0b73f" strokeWidth="2" />
    <rect x="-1.5" y="-7" width="3" height="10" rx="1.5" fill="#f0b73f" />
    <circle cx="0" cy="8" r="2" fill="#f0b73f" />
  </Animated>
);

const MedicalCross = ({ x, y }: { x: number; y: number }) => (
  <Animated x={x} y={y} className="scene-bob">
    <rect x="-9" y="-9" width="18" height="18" rx="4" fill="#3a1420" stroke="#ff5a5a" />
    <rect x="-2" y="-6" width="4" height="12" rx="2" fill="#ff5a5a" />
    <rect x="-6" y="-2" width="12" height="4" rx="2" fill="#ff5a5a" />
  </Animated>
);

// ── Scenes ──────────────────────────────────────────────────────────────────

const TrafficScene = ({ script }: { script: SceneScript }) => {
  const env = script.environment;
  const layout = script.trafficLayout ?? "collision";
  const fast = script.speed === "fast";
  const secondColor = script.vehicle === "truck" ? "#f0b73f" : "#e8865a";
  // Where the front of the primary vehicle sits, and therefore where the
  // oncoming vehicle and the impact star belong (composition, not constants).
  const v1Front = script.vehicle === "truck" ? 200 : script.vehicle === "bike" ? 154 : 186;
  const carTwoX = v1Front + 86;
  const impactX = v1Front + 3;
  const ownerX = script.vehicle === "bike" ? 182 : script.vehicle === "truck" ? 268 : 236;

  return (
    <>
      {env.highway ? <HighwayBackdrop night={env.night} /> : <CityBackdrop night={env.night} />}
      {env.night && !env.signal && <StreetLamp />}
      {env.signal && <TrafficSignal />}
      <Ground wet={env.rain} />
      {env.rain && <Rain />}

      {script.showPedestrian && (
        <g data-zebra fill="#dfe6f4" opacity="0.7">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={40 + i * 18} y={136} width={10} height={11} rx={1.5} />
          ))}
        </g>
      )}
      {script.showBrakeSmoke && (
        <g fill="#9aa6bd" opacity="0.5">
          <circle cx="150" cy="132" r="9" className="scene-pulse" />
          <circle cx="166" cy="126" r="6" className="scene-pulse" style={{ animationDelay: "0.4s" }} />
        </g>
      )}

      {layout !== "parked" && (
        <rect x="60" y="154" width="72" height="3" rx="1.5" fill="#3b4252" className="scene-skid" />
      )}
      {fast && layout !== "parked" && <SpeedLines x={92} y={134} />}

      {layout === "collision" ? (
        <>
          <Vehicle
            kind={script.vehicle}
            x={100}
            y={140}
            color="#4a7dff"
            className="scene-enter-left"
            fast={fast}
            lights={env.night}
            wobble={script.wobble}
          />
          <Vehicle
            kind="car"
            x={carTwoX}
            y={140}
            color={secondColor}
            className="scene-shake"
            flip
            fast={fast}
            lights={env.night}
          />
          {script.showImpact && <ImpactStar x={impactX} y={126} />}
          {script.showFlee && (
            <>
              <Vehicle kind="car" x={330} y={128} color="#8b93a7" className="scene-flee" fast={fast} />
              <Person x={296} y={132} pose="run" color="#e8865a" className="scene-flee" />
            </>
          )}
        </>
      ) : layout === "pedestrian" ? (
        script.showFlee ? (
          <>
            <Vehicle kind="car" x={250} y={140} color="#8b93a7" className="scene-flee" fast={fast} lights={env.night} />
            <Person x={214} y={132} pose="run" color="#e8865a" className="scene-flee" />
            <ImpactStar x={170} y={126} />
          </>
        ) : (
          <>
            <Vehicle
              kind={script.vehicle}
              x={140}
              y={140}
              color="#4a7dff"
              className="scene-enter-left"
              fast={fast}
              lights={env.night}
              wobble={script.wobble}
            />
            <ImpactStar x={118} y={126} />
          </>
        )
      ) : layout === "solo" ? (
        <Vehicle
          kind={script.vehicle}
          x={130}
          y={140}
          color="#4a7dff"
          tilt={script.vehicle === "bike" ? -14 : -7}
          fast={fast}
          lights={env.night}
          wobble={script.wobble}
        />
      ) : (
        <Vehicle kind={script.vehicle} x={190} y={140} color="#4a7dff" lights={env.night} />
      )}

      {layout === "pedestrian" && !script.showInjury && (
        <Person x={76} y={138} pose="walk" color="#7fe0b0" />
      )}
      {layout === "solo" && !script.showInjury && (
        <Person x={ownerX} y={142} pose="stand" color="#7fe0b0" className="scene-bob" />
      )}
      {script.showInjury && (
        <>
          <circle cx={54} cy={142} r={22} fill="#ff5a5a" opacity="0.13" className="scene-pulse" />
          <Person x={54} y={150} pose="lie" color="#ffb4b4" />
          <MedicalCross x={94} y={116} />
        </>
      )}
      {script.showDeath && (
        <Animated x={240} y={62} className="scene-bob">
          <circle cx="0" cy="0" r="15" fill="#1b1016" stroke="#ff5a5a" strokeWidth="2" />
          <path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="#ff5a5a" strokeWidth="3" strokeLinecap="round" />
        </Animated>
      )}
    </>
  );
};

const TheftScene = ({ script }: { script: SceneScript }) => (
  <>
    <Ground />
    <rect x="0" y="128" width="480" height="14" fill="#1d2534" />
    <Person x={128} y={142} pose="stand" color="#9fc4ff" className="scene-bob" />
    <g className="scene-lift">
      <rect x="158" y="96" width="18" height="12" rx="3" fill="#f0b73f" />
      <rect x="176" y="99" width="6" height="5" rx="2" fill="#f0b73f" />
    </g>
    <circle cx="196" cy="122" r="16" fill="none" stroke="#ff5a5a" strokeWidth="2" className="scene-pulse" />
    <Person x={286} y={142} pose="run" color="#ff9d9d" flip className="scene-run-right" />
    <Animated x={262} y={116} className="scene-run-right">
      <rect x="0" y="0" width="20" height="15" rx="3" fill="#5d6b83" />
      <path d="M4 0 Q10 -10 16 0" fill="none" stroke="#5d6b83" strokeWidth="3" />
    </Animated>
    {script.facts.threat && <WarningSign x={340} y={78} />}
    {script.showInjury && <MedicalCross x={70} y={74} />}
  </>
);

const CyberScene = ({ script }: { script: SceneScript }) => (
  <>
    <rect x="0" y="150" width="480" height="50" fill="#10151f" />
    <Animated x={168} y={52} className="scene-bob">
      <rect x="0" y="0" width="144" height="92" rx="8" fill="#0f1726" stroke="#2a3a56" strokeWidth="2" />
      <rect x="6" y="6" width="132" height="80" rx="4" fill="url(#scene-screen)" />
      <rect x="10" y="70" width="124" height="3" fill="#4a7dff" opacity="0.7" className="scene-scan" />
      <ellipse cx="72" cy="112" rx="58" ry="6" fill="#1b2536" />
      <path d="M52 36 v-8 a20 20 0 0 1 40 0 v8" fill="none" stroke="#f0b73f" strokeWidth="5" strokeLinecap="round" />
      <rect x="44" y="36" width="56" height="38" rx="7" fill="#3a2d12" stroke="#f0b73f" strokeWidth="3" />
      <circle cx="72" cy="50" r="5" fill="#f0b73f" />
      <rect x="69" y="54" width="6" height="11" rx="3" fill="#f0b73f" />
    </Animated>
    <circle cx="240" cy="98" r="54" fill="none" stroke="#ff5a5a" strokeWidth="2" className="scene-pulse" />
    <circle
      cx="240"
      cy="98"
      r="54"
      fill="none"
      stroke="#ff5a5a"
      strokeWidth="1.5"
      className="scene-pulse"
      style={{ animationDelay: "0.8s" }}
    />
    {/* person sitting at a desk, using the computer */}
    <rect x="286" y="148" width="132" height="7" rx="3" fill="#26314a" />
    <rect x="294" y="155" width="6" height="26" rx="2" fill="#26314a" />
    <rect x="404" y="155" width="6" height="26" rx="2" fill="#26314a" />
    <rect x="304" y="142" width="36" height="6" rx="2" fill="#0f1726" stroke="#2a3a56" />
    <Person x={368} y={142} pose="sit" color="#9fc4ff" flip />
    <g className="scene-float-up">
      <rect x="342" y="120" width="8" height="8" rx="2" fill="#4ade80" />
      <rect x="362" y="132" width="6" height="6" rx="2" fill="#4ade80" style={{ animationDelay: "0.3s" }} />
      <rect x="326" y="136" width="5" height="5" rx="2" fill="#4ade80" style={{ animationDelay: "0.7s" }} />
    </g>
    {script.facts.financialLoss && (
      <g className="scene-float-up">
        <circle cx="118" cy="132" r="11" fill="#f0b73f" />
        <text x="118" y="137" textAnchor="middle" fontSize="13" fontWeight="700" fill="#3a2d12">
          ₹
        </text>
      </g>
    )}
    {script.facts.dataTheft && (
      <Animated x={92} y={96} className="scene-bob">
        <rect x="-14" y="-18" width="28" height="36" rx="5" fill="#1c2740" stroke="#4a7dff" />
        <rect x="-8" y="-10" width="16" height="3" rx="1.5" fill="#7fa6ff" />
        <rect x="-8" y="-3" width="16" height="3" rx="1.5" fill="#7fa6ff" />
        <rect x="-8" y="4" width="10" height="3" rx="1.5" fill="#7fa6ff" />
      </Animated>
    )}
  </>
);

const AssaultScene = ({ script }: { script: SceneScript }) => (
  <>
    <Ground />
    <Person x={150} y={142} pose="stand" color="#9fc4ff" className="scene-shake" />
    <Person x={300} y={142} pose="run" color="#ff9d9d" flip className="scene-bob" />
    <ImpactStar x={226} y={116} />
    {script.facts.threat && <WarningSign x={226} y={58} />}
    {script.showInjury && <MedicalCross x={150} y={96} />}
  </>
);

const GenericScene = () => (
  <>
    <Animated x={240} y={104} className="animate-scales-sway">
      <rect x="-2.5" y="-58" width="5" height="104" rx="2.5" fill="#4a7dff" opacity="0.9" />
      <circle cx="0" cy="-62" r="7" fill="#f0b73f" />
      <rect x="-66" y="-40" width="132" height="4" rx="2" fill="#4a7dff" />
      <line x1="-52" y1="-36" x2="-52" y2="-16" stroke="#7fa6ff" strokeWidth="2" />
      <line x1="52" y1="-36" x2="52" y2="-16" stroke="#7fa6ff" strokeWidth="2" />
      <path d="M-70 -16 h36 a18 18 0 0 1 -36 0 Z" fill="#7fa6ff" opacity="0.85" />
      <path d="M34 -16 h36 a18 18 0 0 1 -36 0 Z" fill="#7fa6ff" opacity="0.85" />
      <rect x="-24" y="46" width="48" height="5" rx="2.5" fill="#4a7dff" />
    </Animated>
    <Animated x={330} y={72} className="scene-bob">
      <circle cx="0" cy="0" r="17" fill="#1b2536" stroke="#f0b73f" strokeWidth="2" />
      <text x="0" y="7" textAnchor="middle" fontSize="20" fontWeight="700" fill="#f0b73f">
        ?
      </text>
    </Animated>
  </>
);

export const CaseSceneAnimation = ({ text, className = "" }: CaseSceneAnimationProps) => {
  const trimmed = text.trim();
  const script = useMemo(() => buildSceneScript(trimmed), [trimmed]);

  if (trimmed.length < 3) return null;

  return (
    <section
      className={`glass-card rounded-2xl border border-border/40 bg-card/40 overflow-hidden ${className}`}
      aria-label="Animated scene based on your description"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 font-sans">
            What the app sees
          </p>
          <h3 className="font-display text-sm font-semibold text-foreground truncate">
            {script.kindLabel}
          </h3>
        </div>
      </header>

      <div className="mx-3 rounded-xl border border-border/30 overflow-hidden bg-[#0d1220]">
        <svg
          viewBox="0 0 480 200"
          className="w-full h-auto"
          role="img"
          aria-label={`Animated ${script.summary}`}
          data-layout={script.kind === "traffic" ? script.trafficLayout : undefined}
          data-night={script.environment.night ? "true" : undefined}
          data-rain={script.environment.rain ? "true" : undefined}
          data-signal={script.environment.signal ? "true" : undefined}
          data-speed={script.speed}
          data-wobble={script.wobble ? "true" : undefined}
        >
          {SKY}
          <rect
            x="0"
            y="0"
            width="480"
            height="200"
            fill={`url(#${script.environment.night ? "scene-sky-night" : "scene-sky"})`}
          />
          {script.kind === "traffic" && <TrafficScene script={script} />}
          {script.kind === "theft" && <TheftScene script={script} />}
          {script.kind === "cyber" && <CyberScene script={script} />}
          {script.kind === "assault" && <AssaultScene script={script} />}
          {script.kind === "generic" && <GenericScene />}
        </svg>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 py-3">
        {script.cues.slice(0, 5).map((cue) => (
          <span
            key={cue.id}
            className={`text-[10px] font-sans px-2 py-0.5 rounded-full border ${TONES[cue.tone]}`}
          >
            {cue.label}
          </span>
        ))}
        {script.cues.length === 0 && (
          <span className={`text-[10px] font-sans px-2 py-0.5 rounded-full border ${TONES.info}`}>
            Waiting for details…
          </span>
        )}
      </div>
    </section>
  );
};
