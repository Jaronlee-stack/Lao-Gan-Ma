/**
 * The pull-down screen — this product's second signature element.
 *
 * Mala pulls a cord and a projector screen unrolls with the finished one-shot
 * prompt and skills.md on it. A sheet opening is sanctioned motion on an app
 * screen; this is the one authored moment and it reports a real state change
 * (the plan is now final). Flat surfaces throughout; the only shadow is on the
 * dialog itself, which genuinely floats.
 */
import { useEffect, useRef, useState } from "react";
import { AcceptResult } from "../api";
import { Button } from "./Button";
import { Check, X } from "./icons";

const screenFace = "overflow-hidden rounded-b-sheet border border-edge bg-surface shadow-xl"; // taste-skill-ignore: a dialog genuinely floats

export function PullDownScreen({
  result,
  onClose,
}: {
  result: AcceptResult;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"prompt" | "skills">("prompt");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const active = tab === "prompt" ? result.one_shot_prompt : result.skills_markdown;

  async function copy() {
    await navigator.clipboard.writeText(active);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function download() {
    const blob = new Blob([result.skills_markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skills.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-3"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="screen-title"
        className="w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* roller housing */}
        <div className="relative mx-auto h-2.5 rounded-full bg-ink/80" aria-hidden="true">
          <span className="absolute -top-1 left-4 h-4 w-1 rounded bg-ink/60" />
          <span className="absolute -top-1 right-4 h-4 w-1 rounded bg-ink/60" />
        </div>

        {/* the screen unrolling */}
        <div className="origin-top animate-screen-roll">
          <div className={screenFace}>
            <header className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
              <div className="flex items-start gap-2.5">
                <Check className="mt-0.5 shrink-0 text-base text-positive" />
                <div>
                  <h2 id="screen-title" className="text-section font-medium text-ink">
                    Your prompt is ready
                  </h2>
                  <p className="text-small text-muted">
                    Paste it into any coding agent, or take the skills file.
                  </p>
                </div>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                data-ring
                aria-label="Close"
                className="shrink-0 rounded-control p-1 text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X />
              </button>
            </header>

            {result.learned?.note && (
              <p className="border-b border-rule px-5 py-2.5 text-small text-muted">
                {result.learned.note}
              </p>
            )}

            {/* underline tabs, per the sheet */}
            <div role="tablist" aria-label="Output" className="flex gap-5 border-b border-edge px-5">
              {(
                [
                  ["prompt", "One-shot prompt"],
                  ["skills", "skills.md"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  data-ring
                  className={`-mb-px border-b-2 py-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    tab === id
                      ? "border-accent font-medium text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="px-5 py-4">
              <pre className="max-h-[46vh] overflow-auto whitespace-pre-wrap rounded-card bg-raised p-4 font-mono text-small text-ink">
                {active}
              </pre>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-rule px-5 py-3">
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? (
                  <>
                    <Check /> Copied
                  </>
                ) : tab === "prompt" ? (
                  "Copy prompt"
                ) : (
                  "Copy skills.md"
                )}
              </Button>
              {tab === "skills" && (
                <Button variant="primary" size="sm" onClick={download}>
                  Download skills.md
                </Button>
              )}
            </footer>
          </div>

          {/* weighted bar and the cord Mala pulled */}
          <div className="mx-auto h-2 w-[99%] rounded-b bg-ink/70" aria-hidden="true" />
          <div className="flex justify-end pr-10" aria-hidden="true">
            <span className="h-6 w-px bg-control" />
          </div>
        </div>
      </div>
    </div>
  );
}
