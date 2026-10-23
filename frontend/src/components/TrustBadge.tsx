import { TrustLevel } from "../api";
import { Check, Alert, X } from "./icons";

/** Each trust level carries its own mark as well as its own ink, so the three
 *  read apart without relying on hue alone. */
const styles: Record<TrustLevel, { pill: string; Icon: typeof Check; word: string }> = {
  verified: { pill: "bg-pill-pos-bg text-pill-pos-ink", Icon: Check, word: "verified" },
  unverified: { pill: "bg-pill-warn-bg text-pill-warn-ink", Icon: Alert, word: "unverified" },
  blocked: { pill: "bg-pill-neg-bg text-pill-neg-ink", Icon: X, word: "blocked" },
};

export function TrustBadge({ level }: { level: TrustLevel }) {
  const s = styles[level] ?? styles.unverified;
  const { Icon } = s;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-small font-medium ${s.pill}`}
    >
      <Icon /> {s.word}
    </span>
  );
}
