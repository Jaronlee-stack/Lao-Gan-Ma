import { useEffect, useMemo, useState, useCallback } from "react";
import { api, Skill, TrustLevel } from "../api";
import { TrustBadge } from "./TrustBadge";

const PAGE_SIZE = 50;

export function SkillsTab({ skills: localSkills }: { skills: Skill[] }) {
  const [source, setSource] = useState<{ live_status: string; url: string } | null>(null);
  const [domains, setDomains] = useState<string[]>([]);

  // Browse state (server-driven when live).
  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [resultSource, setResultSource] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Filters.
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [domain, setDomain] = useState("");
  const [trust, setTrust] = useState<"all" | TrustLevel>("all");

  useEffect(() => {
    api.skillsSource().then(setSource).catch(() => {});
    api.skillDomains().then((d) => setDomains(d.domains)).catch(() => {});
  }, []);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      try {
        const page = await api.browseSkills({
          offset: nextOffset,
          limit: PAGE_SIZE,
          search: debounced,
          domain,
        });
        setSkills(page.skills);
        setTotal(page.total);
        setOffset(page.offset);
        setHasMore(page.has_more);
        setResultSource(page.source);
      } catch {
        // Fall back to whatever local skills were passed in.
        setSkills(localSkills);
        setTotal(localSkills.length);
        setHasMore(false);
        setResultSource("local");
      } finally {
        setLoading(false);
      }
    },
    [debounced, domain, localSkills]
  );

  // Reload from page 0 whenever a filter changes.
  useEffect(() => {
    load(0);
  }, [load]);

  // Trust filter is applied client-side on the current page.
  const visible = useMemo(
    () => (trust === "all" ? skills : skills.filter((s) => s.trust_level === trust)),
    [skills, trust]
  );

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-slate-800">SkillDB catalogue</h2>
        <span className="text-xs text-slate-400">
          {total.toLocaleString()} skills{resultSource === "skilldb.dev" ? " (live)" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="text-slate-500">
          Source:{" "}
          <a
            href={source?.url || "https://skilldb.dev"}
            target="_blank"
            rel="noreferrer"
            className="text-chili-600 underline"
          >
            SkillDB (skilldb.dev)
          </a>
        </span>
        {source && (
          <span
            className={`px-2 py-0.5 rounded-full border ${
              source.live_status === "ok"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : source.live_status === "offline"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {source.live_status === "ok"
              ? "● live"
              : source.live_status === "offline"
              ? "● offline (local fallback)"
              : source.live_status === "disabled"
              ? "● local only"
              : "● checking…"}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all skills…"
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm max-w-[220px]"
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
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
      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">Loading skills…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((s) => (
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
          {visible.length === 0 && (
            <p className="text-sm text-slate-400 col-span-full text-center py-8">
              No skills match your filters.
            </p>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || loading}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages.toLocaleString()}
          </span>
          <button
            onClick={() => load(offset + PAGE_SIZE)}
            disabled={!hasMore || loading}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
