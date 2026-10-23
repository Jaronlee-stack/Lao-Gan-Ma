import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Star } from "./icons";

const dialogCard = "w-full max-w-md rounded-card border border-edge bg-surface p-5 shadow-xl"; // taste-skill-ignore: a dialog genuinely floats

export function FeedbackModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (rating: number, remarks: string) => Promise<void>;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(rating, remarks);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const shown = hover || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className={dialogCard}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="feedback-title" className="text-section font-medium text-ink">
          How was this plan?
        </h2>
        <p className="mt-1 text-body text-muted">
          Your rating tunes what Mala suggests next time.
        </p>

        <div className="my-4 flex gap-1" role="radiogroup" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} of 5`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              data-ring
              className={`rounded p-1 text-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                shown >= n ? "text-accent" : "text-control hover:text-muted"
              }`}
            >
              <Star filled={shown >= n} />
            </button>
          ))}
        </div>

        <label htmlFor="remarks" className="sr-only">
          Remarks
        </label>
        <textarea
          id="remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="Anything to add? Optional."
          className="w-full resize-y rounded-control border border-control bg-surface px-3 py-2 text-body text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="subtle" size="sm" onClick={onClose}>
            Skip
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            loading={submitting}
            disabled={rating === 0}
          >
            Send feedback
          </Button>
        </div>
      </div>
    </div>
  );
}
