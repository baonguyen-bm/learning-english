import React from "react";
import type { WordDiffResult } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface WordDiffProps {
  results: WordDiffResult[];
  onWordClick?: (word: string) => void;
}

const statusStyles: Record<WordDiffResult["status"], string> = {
  correct: "bg-success-light text-success border-success/20",
  close: "bg-warning-light text-warning border-warning/20",
  wrong: "bg-error-light text-error border-error/20",
  missing: "bg-page text-ink-ghost border-rule border-dashed",
};

export function WordDiff({ results, onWordClick }: WordDiffProps) {
  return (
    <div className="space-y-3 animate-slide-up">
      <p className="text-sm font-medium text-ink-faded">
        Word-by-word breakdown:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {results.map((r, i) => {
          const wordToSpeak = r.expected;
          const isClickable = !!onWordClick;
          const Component = isClickable ? "button" : "span";
          return (
            <Component
              key={i}
              type={isClickable ? "button" : undefined}
              onClick={isClickable ? () => onWordClick(wordToSpeak) : undefined}
              className={cn(
                "px-2 py-1 rounded border text-sm font-mono",
                statusStyles[r.status],
                isClickable &&
                  "cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity"
              )}
              title={
                isClickable
                  ? `Click to hear "${wordToSpeak}"`
                  : r.status === "correct"
                    ? r.expected
                    : `Expected: "${r.expected}"`
              }
            >
              {r.status === "missing" ? `_${r.expected}_` : r.word}
            </Component>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-ink-ghost">
        {[
          { bg: "bg-success-light", border: "border-success/20", label: "Correct" },
          { bg: "bg-warning-light", border: "border-warning/20", label: "Close" },
          { bg: "bg-error-light", border: "border-error/20", label: "Wrong" },
          { bg: "bg-page", border: "border-rule border-dashed", label: "Missing" },
        ].map(({ bg, border, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded ${bg} border ${border}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
