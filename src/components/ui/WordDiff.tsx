import React from "react";
import type { WordDiffResult } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface WordDiffProps {
  results: WordDiffResult[];
}

const statusStyles: Record<WordDiffResult["status"], string> = {
  correct: "bg-success-light text-success border-success/20",
  close: "bg-warning-light text-warning border-warning/20",
  wrong: "bg-error-light text-error border-error/20",
  missing: "bg-page text-ink-ghost border-rule border-dashed",
};

export function WordDiff({ results }: WordDiffProps) {
  return (
    <div className="space-y-3 animate-slide-up">
      <p className="text-sm font-medium text-ink-faded">
        Word-by-word breakdown:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {results.map((r, i) => (
          <span
            key={i}
            className={cn(
              "px-2 py-1 rounded border text-sm font-mono",
              statusStyles[r.status]
            )}
            title={
              r.status === "correct"
                ? r.expected
                : `Expected: "${r.expected}"`
            }
          >
            {r.status === "missing" ? `_${r.expected}_` : r.word}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-ink-ghost">
        {(
          [
            ["success-light", "success", "Correct"],
            ["warning-light", "warning", "Close"],
            ["error-light", "error", "Wrong"],
            ["page", "rule border-dashed", "Missing"],
          ] as const
        ).map(([bg, border, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className={`w-2.5 h-2.5 rounded bg-${bg} border border-${border}`}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
