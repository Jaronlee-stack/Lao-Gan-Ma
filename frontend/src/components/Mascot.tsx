/**
 * Mala — the product's mark and face.
 *
 * A chili character in flat vector: oversized eyes, soft body, no gradients and
 * no shadows. On an app screen the mascot is the one element only this product
 * has, and its mood reports the agent's real state (idle, planning, verifying,
 * done), so the motion is feedback rather than decoration.
 */
export type MascotMood = "idle" | "thinking" | "scanning" | "happy" | "concerned";

const SKIN = "#f0b48f";
const SKIN_DARK = "#d8906a";
const BODY = "#c0392b";
const BODY_DARK = "#9c2318";
const LEAF = "#3f9450";
const INK = "#2b1a12";

export function Mascot({
  mood = "idle",
  className = "",
}: {
  mood?: MascotMood;
  className?: string;
}) {
  const motion =
    mood === "thinking"
      ? "animate-mala-think"
      : mood === "happy"
      ? "animate-mala-cheer"
      : mood === "scanning"
      ? "animate-mala-scan"
      : "animate-mala-breathe";

  return (
    <svg
      viewBox="0 0 160 170"
      className={`${className} overflow-visible ${motion}`}
      role="img"
      aria-label={label(mood)}
    >
      {/* arms */}
      {mood === "happy" ? (
        <>
          <path d="M32 94 Q12 72 18 56" stroke={BODY_DARK} strokeWidth="11" strokeLinecap="round" fill="none" />
          <path d="M128 94 Q148 72 142 56" stroke={BODY_DARK} strokeWidth="11" strokeLinecap="round" fill="none" />
        </>
      ) : mood === "thinking" ? (
        <>
          <path d="M32 98 Q18 90 20 80" stroke={BODY_DARK} strokeWidth="11" strokeLinecap="round" fill="none" />
          <path d="M128 96 Q120 84 104 82" stroke={BODY_DARK} strokeWidth="11" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M32 96 Q18 88 20 78" stroke={BODY_DARK} strokeWidth="11" strokeLinecap="round" fill="none" />
          <path d="M128 96 Q142 88 140 78" stroke={BODY_DARK} strokeWidth="11" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* body */}
      <path
        d="M80 30 C112 30 132 56 132 94 C132 134 110 158 80 158 C50 158 28 134 28 94 C28 56 48 30 80 30 Z"
        fill={BODY}
      />

      {/* stem + leaf */}
      <path d="M74 32 Q78 13 92 8" stroke={LEAF} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M80 19 Q98 5 116 13 Q100 29 80 19 Z" fill={LEAF} />

      {/* eyes */}
      {mood === "scanning" ? (
        <>
          <ellipse cx="62" cy="86" rx="16" ry="11" fill="#ffffff" />
          <ellipse cx="100" cy="86" rx="16" ry="11" fill="#ffffff" />
          <circle cx="67" cy="87" r="6.5" fill={INK} />
          <circle cx="105" cy="87" r="6.5" fill={INK} />
          <path d="M50 70 Q62 65 74 69" stroke={BODY_DARK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M88 69 Q100 65 112 70" stroke={BODY_DARK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      ) : mood === "happy" ? (
        <>
          <path d="M50 86 Q62 73 74 86" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M88 86 Q100 73 112 86" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
        </>
      ) : mood === "concerned" ? (
        <>
          <ellipse cx="62" cy="88" rx="15" ry="16" fill="#ffffff" />
          <ellipse cx="100" cy="88" rx="15" ry="16" fill="#ffffff" />
          <circle cx="62" cy="91" r="7" fill={INK} />
          <circle cx="100" cy="91" r="7" fill={INK} />
          <path d="M48 69 Q60 75 72 69" stroke={BODY_DARK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M90 69 Q102 75 114 69" stroke={BODY_DARK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <g className="animate-mala-blink" style={{ transformOrigin: "80px 88px" }}>
          <ellipse cx="62" cy="88" rx="16" ry="18" fill="#ffffff" />
          <ellipse cx="100" cy="88" rx="16" ry="18" fill="#ffffff" />
          <circle cx={mood === "thinking" ? 64 : 62} cy={mood === "thinking" ? 84 : 90} r="7.5" fill={INK} />
          <circle cx={mood === "thinking" ? 102 : 100} cy={mood === "thinking" ? 84 : 90} r="7.5" fill={INK} />
        </g>
      )}

      {/* cheeks, flat */}
      <ellipse cx="46" cy="106" rx="9" ry="5.5" fill={SKIN} opacity="0.55" />
      <ellipse cx="116" cy="106" rx="9" ry="5.5" fill={SKIN} opacity="0.55" />

      {/* mouth */}
      {mood === "happy" ? (
        <path d="M67 110 Q81 128 95 110 Z" fill={SKIN_DARK} />
      ) : mood === "thinking" ? (
        <ellipse cx="81" cy="114" rx="5.5" ry="4" fill={SKIN_DARK} />
      ) : mood === "concerned" ? (
        <path d="M70 118 Q81 110 92 118" stroke={SKIN_DARK} strokeWidth="4" strokeLinecap="round" fill="none" />
      ) : mood === "scanning" ? (
        <path d="M71 113 L91 113" stroke={SKIN_DARK} strokeWidth="4" strokeLinecap="round" />
      ) : (
        <path d="M70 110 Q81 121 92 110" stroke={SKIN_DARK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

function label(mood: MascotMood): string {
  switch (mood) {
    case "thinking":
      return "Mala is planning";
    case "scanning":
      return "Mala is verifying skills";
    case "happy":
      return "Mala is done";
    case "concerned":
      return "Mala hit a problem";
    default:
      return "Mala, the Lao Gan Ma mascot";
  }
}
