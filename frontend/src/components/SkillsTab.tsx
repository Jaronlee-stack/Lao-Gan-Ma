/**
 * The skills catalogue. Built to the sheet's list pattern: underline tabs for
 * trust state on a full-width rule, a toolbar with search on the left and the
 * count on the right, then rows on a 1px rule with no card around them. The
 * identity column takes the width; the trust mark sits at the row's end.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Skill, TrustLevel } from "../api";
import { TrustBadge } from "./TrustBadge";
import { Button } from "./Button";

const PAGE_SIZE = 50;

const TRUST_TABS: { id: "all" | TrustLevel; label: string }[] = [
  { id: "all", label: "All" },
  { id: "verified", label: "Verified" },
  { id: "unverified", label: "Unverified" },
  { id: "blocked", label: "Blocked" },
];

export function SkillsTab({ skills: localSkills }: { skills: Skill[] }) {
  const [source, setSource] = useState<{ live_status: string; url: string } | null>(null);
  const [domains, setDomains] = useState<string[]>([]);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [resultSource, setResultSource] = useState("");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [domain, setDomain] = useState("");
  const [trust, setTrust] = useState<"all" | TrustLevel>("all");

  useEffect(() => {
    api.skillsSource().then(setSource).catch(() => {});
    api
      .skillDomains()
      .then((d) => setDomains(d.domains))
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    load(0);
  }, [load]);

  const visible = useMemo(
    () => (trust === "all" ? skills : skills.filter((s) => s.trust_level === trust)),
    [skills, trust]
  );

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const live = source?.live_status === "ok" || resultSource === "skilldb.dev";

  return (
    <section>
      <p className="text-body text-muted">
        Discovered from{" "}
        <a
          href={source?.url || "https://skilldb.dev"}
          target="_blank"
          rel="noreferrer"
          className="text-ink underline decoration-control underline-offset-2 hover:decoration-accent"
        >
          SkillDB
        </a>
        . Every one is verified before it can shape a plan.
      </p>

      {/* trust tabs on a full-width rule, 2px indicator */}
      <div role="tablist" aria-label="Trust level" className="mt-4 flex gap-5 border-b border-edge">
        {TRUST_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={trust === t.id}
            onClick={() => setTrust(t.id)}
            data-ring
            className={`-mb-px border-b-2 py-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              trust === t.id
                ? "border-accent font-medium text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* toolbar: search left, count right */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label htmlFor="skill-search" className="sr-only">
          Search skills
        </label>
        <input
          id="skill-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills"
          className="h-control w-full max-w-xs rounded-control border border-control bg-surface px-2.5 text-body text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <label htmlFor="skill-domain" className="sr-only">
          Domain
        </label>
        <select
          id="skill-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="h-control max-w-[14rem] rounded-control border border-control bg-surface px-2.5 text-body text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <p className="num ml-auto text-small text-muted">
          {total.toLocaleString()} skills{live ? ", live" : ", local"}
        </p>
      </div>

      {/* rows */}
      {loading ? (
        <p className="py-10 text-center text-body text-muted">Loading skills</p>
      ) : visible.length === 0 ? (
        <div className="mt-4 rounded-card border border-edge px-4 py-10 text-center">
          <p className="text-body text-muted">No skills match these filters.</p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {visible.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-1 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-body font-medium text-ink">{s.name}</span>
                  <span className="text-small text-muted">{s.category}</span>
                </div>
                <p className="mt-0.5 text-small text-muted">{s.summary}</p>
                {s.technologies.length > 0 && (
                  <p className="mt-1 text-small text-faint">{s.technologies.join(", ")}</p>
                )}
                {s.verification && s.verification.findings.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {s.verification.findings.map((f, i) => (
                      <li
                        key={i}
                        className={`text-small ${
                          f.severity === "critical" ? "text-negative" : "text-warning"
                        }`}
                      >
                        {f.code}: {f.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <TrustBadge level={s.trust_level} />
            </li>
          ))}
        </ul>
      )}

      {/* pagination */}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || loading}
          >
            Previous
          </Button>
          <p className="num text-small text-muted">
            Page {page} of {totalPages.toLocaleString()}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => load(offset + PAGE_SIZE)}
            disabled={!hasMore || loading}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
