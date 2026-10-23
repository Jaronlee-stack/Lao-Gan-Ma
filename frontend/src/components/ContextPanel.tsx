/**
 * Global personalisation context.
 *
 * Whatever is set here applies to every plan in every session: it goes to the
 * planner with the idea and is written into the one-shot prompt. Distinct from
 * the agent's inferred preferences, which it learns by watching; this is the
 * user's own stated truth, so it is shown first and takes priority.
 */
import { useEffect, useState } from "react";
import { UserContext } from "../api";
import { Button } from "./Button";
import { X, Shield } from "./icons";

const panelSheet = "h-full w-full max-w-md overflow-y-auto border-l border-edge bg-surface shadow-xl"; // taste-skill-ignore: a slide-over genuinely floats

export function ContextPanel({
  open,
  value,
  saving,
  learnedNote,
  onSave,
  onClear,
  onClose,
}: {
  open: boolean;
  value: UserContext;
  saving?: boolean;
  learnedNote?: string;
  onSave: (ctx: UserContext) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<UserContext>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function set<K extends keyof UserContext>(key: K, v: UserContext[K]) {
    setDraft((d) => ({ ...d, [key]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="ctx-title"
        className={panelSheet}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-rule bg-surface px-5 py-4">
          <div>
            <h2 id="ctx-title" className="text-section font-medium text-ink">
              Your context
            </h2>
            <p className="text-small text-muted">Applied to every plan, in every session.</p>
          </div>
          <button
            onClick={onClose}
            data-ring
            aria-label="Close"
            className="rounded-control p-1 text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X />
          </button>
        </header>

        <div className="flex flex-col gap-5 px-5 py-5">
          <Field label="What should I call you?" id="ctx-name">
            <input
              id="ctx-name"
              value={draft.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </Field>

          <Field label="What do you do?" id="ctx-role">
            <input
              id="ctx-role"
              value={draft.role}
              onChange={(e) => set("role", e.target.value)}
              placeholder="Solo founder, backend engineer, student"
              className={inputCls}
            />
          </Field>

          <Field label="Experience level" id="ctx-exp">
            <select
              id="ctx-exp"
              value={draft.experience_level}
              onChange={(e) => set("experience_level", e.target.value)}
              className={inputCls}
            >
              <option value="">No default</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>

          <TagField
            label="Tech you prefer"
            hint="Plans will favour these."
            tags={draft.preferred_stack}
            onChange={(t) => set("preferred_stack", t)}
            placeholder="React, FastAPI, Postgres"
          />

          <TagField
            label="Tech to avoid"
            hint="Plans will steer away from these."
            tags={draft.avoid}
            onChange={(t) => set("avoid", t)}
            placeholder="PHP, jQuery"
          />

          <TagField
            label="Standing constraints"
            hint="Budget, platform, team size, deadlines."
            tags={draft.constraints}
            onChange={(t) => set("constraints", t)}
            placeholder="Solo dev, free tier only"
          />

          <Field label="What are you optimising for?" id="ctx-goals">
            <input
              id="ctx-goals"
              value={draft.goals}
              onChange={(e) => set("goals", e.target.value)}
              placeholder="Ship fast, learn deeply, production grade"
              className={inputCls}
            />
          </Field>

          <Field label="Anything else I should always know?" id="ctx-notes">
            <textarea
              id="ctx-notes"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Building for a hackathon demo, so prefer simple over scalable."
              className={`${inputCls} resize-y`}
            />
          </Field>

          <div className="rounded-card border border-edge px-4 py-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={draft.security_mode}
                onChange={(e) => set("security_mode", e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span>
                <span className="flex items-center gap-1.5 text-body font-medium text-ink">
                  <Shield className="text-positive" /> Security mode
                </span>
                <span className="mt-0.5 block text-small text-muted">
                  Before planning, show every skill being verified: trusted source,
                  signature, prompt-injection and dangerous-command screens. Untrusted
                  guidance is blocked in front of you.
                </span>
              </span>
            </label>
          </div>

          {learnedNote && (
            <div className="rounded-card bg-raised px-4 py-3.5">
              <p className="text-body font-medium text-ink">What I've picked up on my own</p>
              <p className="mt-1 text-small text-muted">{learnedNote}</p>
              <p className="mt-2 text-small text-faint">
                Inferred from plans you kept and rated. Anything you set above takes priority.
              </p>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-rule bg-surface px-5 py-4">
          <Button variant="subtle" size="sm" onClick={onClear}>
            Clear all
          </Button>
          <span className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={() => onSave(draft)}>
              Save context
            </Button>
          </span>
        </footer>
      </aside>
    </div>
  );
}

const inputCls =
  "w-full rounded-control border border-control bg-surface px-3 py-2 text-body text-ink " +
  "placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

function TagField({
  label,
  hint,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const id = `tag-${label.replace(/\s+/g, "-").toLowerCase()}`;

  function commit() {
    const parts = draft
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p && !tags.includes(p));
    if (parts.length) onChange([...tags, ...parts]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-medium text-ink">
        {label}
      </label>
      <p className="-mt-1 text-small text-muted">{hint}</p>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pt-0.5">
          {tags.map((t) => (
            <li key={t}>
              <button
                onClick={() => onChange(tags.filter((x) => x !== t))}
                data-ring
                aria-label={`Remove ${t}`}
                className="flex items-center gap-1 rounded bg-pill-neutral-bg px-2 py-1 text-small text-pill-neutral-ink transition-colors hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t}
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}
