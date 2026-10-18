import { useMemo, useState } from "react";
import { Skill, TrustLevel } from "../api";
import { TrustBadge } from "./TrustBadge";

export function SkillsTab({ skills }: { skills: Skill[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [trust, setTrust] = useState<"all" | TrustLevel>("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(skills.map((s) => s.category))).sort()],
    [skills]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (trust !== "all" && s.trust_level !== trust) return false;
      if (!q) return true;
      const hay = [s.name, s.summary, s.category, ...s.technologies].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [skills, query, category, trust]);

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-slate-800">SkillDB</h2>
        <span className="text-xs text-slate-400">
          {filtered.length} / {skills.length} skills
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Browse every skill. Only <b>verified</b> skills can influence a plan.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, tech, summary…"
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
        <select
          value={trust}
          onChange={(e) => setTrust(e.target.value as "all" | TrustLevel)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All trust levels</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((s) => (
          <div key={s.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{s.name}</span>
              <TrustBadge level={s.trust_level} />
            </div>
            <span className="inline-block mt-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {s.category}
            </span>
            <p className="text-xs text-slate-500 mt-2">{s.summary}</p>
            {s.technologies.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {s.technologies.map((t) => (
                  <span key={t} className="text-xs bg-chili-50 text-chili-700 px-2 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {s.verification && s.verification.findings.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {s.verification.findings.map((f, i) => (
                  <li
                    key={i}
                    className={`text-xs ${
                      f.severity === "critical" ? "text-red-600" : "text-amber-600"
                    }`}
                  >
                    [{f.severity}] {f.code}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 col-span-full text-center py-8">
            No skills match your filters.
          </p>
        )}
      </div>
    </section>
  );
}
