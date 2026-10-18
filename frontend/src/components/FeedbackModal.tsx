import { useState } from "react";

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-bold text-lg text-slate-800">How was this plan?</h2>
        <p className="text-sm text-slate-500 mb-4">
          Your rating helps Lao Gan Ma learn your preferences.
        </p>

        <div className="flex gap-1 justify-center mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="text-4xl transition-transform hover:scale-110"
              aria-label={`${n} stars`}
            >
              <span className={(hover || rating) >= n ? "text-amber-400" : "text-slate-300"}>
                ★
              </span>
            </button>
          ))}
        </div>

        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="Any remarks? (optional)"
          className="w-full rounded-lg border border-slate-300 p-3 text-sm"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Skip
          </button>
          <button
            onClick={submit}
            disabled={rating === 0 || submitting}
            className="text-sm px-4 py-2 rounded-lg bg-chili-600 hover:bg-chili-700 disabled:opacity-50 text-white"
          >
            {submitting ? "Sending…" : "Submit feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
