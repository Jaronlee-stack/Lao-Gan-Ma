import { useState } from "react";
import { AcceptResult } from "../api";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="text-xs bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function AcceptModal({
  result,
  onClose,
}: {
  result: AcceptResult;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"prompt" | "skills">("prompt");

  function downloadSkills() {
    const blob = new Blob([result.skills_markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skills.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const active = tab === "prompt" ? result.one_shot_prompt : result.skills_markdown;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-lg text-slate-800">🎉 Plan accepted</h2>
            <p className="text-sm text-slate-500">
              Copy the one-shot prompt into any coding agent, or download the skills.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">
            ✕
          </button>
        </div>

        {result.learned.note && (
          <div className="mx-5 mt-4 rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-800">
            🧠 {result.learned.note}
          </div>
        )}

        <div className="flex gap-2 px-5 pt-4">
          <button
            onClick={() => setTab("prompt")}
            className={`text-sm px-3 py-1.5 rounded-lg ${
              tab === "prompt" ? "bg-chili-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            One-shot prompt
          </button>
          <button
            onClick={() => setTab("skills")}
            className={`text-sm px-3 py-1.5 rounded-lg ${
              tab === "skills" ? "bg-chili-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            skills.md
          </button>
        </div>

        <div className="p-5 overflow-auto flex-1">
          <pre className="whitespace-pre-wrap text-xs bg-slate-900 text-slate-100 rounded-lg p-4 font-mono">
            {active}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-200">
          <CopyButton text={active} label={tab === "prompt" ? "Copy prompt" : "Copy skills.md"} />
          {tab === "skills" && (
            <button
              onClick={downloadSkills}
              className="text-xs bg-chili-600 hover:bg-chili-700 text-white px-3 py-1.5 rounded"
            >
              Download skills.md
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
