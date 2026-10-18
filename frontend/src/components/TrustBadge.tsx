import { TrustLevel } from "../api";

const trustStyles: Record<TrustLevel, string> = {
  verified: "bg-emerald-100 text-emerald-700 border-emerald-200",
  unverified: "bg-amber-100 text-amber-700 border-amber-200",
  blocked: "bg-red-100 text-red-700 border-red-200",
};

export function TrustBadge({ level }: { level: TrustLevel }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${trustStyles[level]}`}>
      {level}
    </span>
  );
}
