/**
 * The verification scan — one of this product's two signature elements.
 *
 * Reveals the real trust-boundary trace one skill at a time, each with its four
 * checks. Every verdict carries its own mark as well as its own colour, so
 * blocked reads apart from withheld at a glance and not by hue alone. Status is
 * data, which is where this screen's colour budget is spent.
 */
import { useEffect, useState } from "react";
import { ScanStep, SecurityScanResult } from "../api";
import { Shield, Check, X, Alert } from "./icons";

const STEP_MS = 380;

const sourceId = "font-mono text-small text-faint"; // taste-skill-ignore: the sheet deals Plex Mono for IDs and keys

export function SecurityScan({
  scan,
  onDone,
}: {
  scan: SecurityScanResult;
  onDone?: () => void;
}) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    if (scan.steps.length === 0) {
      onDone?.();
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= scan.steps.length) {
        clearInterval(timer);
        onDone?.();
      }
    }, STEP_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan]);

  const done = revealed >= scan.steps.length;
  const shown = scan.steps.slice(0, revealed);
  const pct = Math.round((revealed / Math.max(1, scan.steps.length)) * 100);

  return (
    <section className="rounded-card border border-edge bg-surface">
      <header className="flex items-center gap-2.5 border-b border-rule px-4 py-3">
        <Shield className="text-base text-positive" />
        <div className="min-w-0 flex-1">
          <h3 className="text-body font-medium text-ink">Verifying skills before use</h3>
          <p className="text-small text-muted">
            {done ? scan.summary : `Screening ${revealed} of ${scan.steps.length}`}
          </p>
        </div>
        {!done && <span className="num text-small text-muted">{pct}%</span>}
      </header>

      <div className="relative overflow-hidden">
        {!done && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-10 animate-beam bg-positive opacity-[0.07]"
            aria-hidden="true"
          />
        )}
        <ul className="max-h-80 divide-y divide-rule overflow-y-auto">
          {shown.map((step) => (
            <ScanRow key={step.skill_id} step={step} />
          ))}
        </ul>
      </div>

      {done && (
        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-rule px-4 py-3">
          <Tally mark={<Check />} label="cleared" value={scan.loaded} ink="text-positive" />
          <Tally mark={<Alert />} label="withheld" value={scan.withheld} ink="text-warning" />
          <Tally mark={<X />} label="blocked" value={scan.blocked} ink="text-negative" />
          <span className="text-small text-muted">Only cleared skills can shape the plan.</span>
        </footer>
      )}
    </section>
  );
}

function Tally({
  mark,
  label,
  value,
  ink,
}: {
  mark: React.ReactNode;
  label: string;
  value: number;
  ink: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-small">
      <span className={ink}>{mark}</span>
      <b className={`num font-medium ${value > 0 ? "text-ink" : "text-faint"}`}>{value}</b>
      <span className="text-muted">{label}</span>
    </span>
  );
}

/** Each verdict has its own mark, its own pill and its own ink. */
const verdicts = {
  loaded: { Icon: Check, ink: "text-positive", pill: "bg-pill-pos-bg text-pill-pos-ink", word: "Cleared" },
  withheld: { Icon: Alert, ink: "text-warning", pill: "bg-pill-warn-bg text-pill-warn-ink", word: "Withheld" },
  blocked: { Icon: X, ink: "text-negative", pill: "bg-pill-neg-bg text-pill-neg-ink", word: "Blocked" },
} as const;

function ScanRow({ step }: { step: ScanStep }) {
  const v = verdicts[step.verdict] ?? verdicts.withheld;
  const { Icon } = v;

  return (
    <li className="animate-row-in px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 shrink-0 text-base ${v.ink}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-body text-ink">{step.skill_name}</span>
            <span className={sourceId}>{step.source}</span>
            <span className={`rounded px-1.5 py-0.5 text-small font-medium ${v.pill}`}>{v.word}</span>
          </div>

          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {step.checks.map((c) => (
              <li
                key={c.code}
                title={c.detail}
                className={`flex items-center gap-1 text-small ${
                  c.passed ? "text-muted" : "text-negative"
                }`}
              >
                <span className={c.passed ? "text-positive" : "text-negative"}>
                  {c.passed ? <Check /> : <X />}
                </span>
                {c.name}
              </li>
            ))}
          </ul>

          {step.verdict !== "loaded" && (
            <p className="mt-1.5 text-small text-muted">{step.reason}</p>
          )}
        </div>
      </div>
    </li>
  );
}
