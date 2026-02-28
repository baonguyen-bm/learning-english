"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import type { WordPronunciationResult } from "@/types/pronunciation";
import { findVietnameseErrors, VIETNAMESE_PHONEME_ERRORS } from "@/lib/vietnameseHeuristics";

interface WordHighlightProps {
  words: WordPronunciationResult[];
  targetSentence: string;
}

export function WordHighlight({ words, targetSentence }: WordHighlightProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { speak } = useTTS();
  const targetWords = targetSentence
    .trim()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 p-4 rounded-lg bg-page border border-rule">
        {words.map((w, i) => {
          const colorClass =
            w.errorType === "omission"
              ? "text-ink-ghost line-through"
              : w.accuracyScore >= 80
                ? "text-success"
                : w.accuracyScore >= 50
                  ? "text-warning"
                  : "text-error";

          const isSelected = selectedIndex === i;
          const hasError = w.errorType !== "none" || w.accuracyScore < 80;

          return (
            <button
              key={i}
              onClick={() => hasError && setSelectedIndex(isSelected ? null : i)}
              className={cn(
                "px-1.5 py-0.5 rounded font-display text-lg transition-all",
                colorClass,
                hasError && "cursor-pointer hover:bg-ink/5 underline decoration-dotted",
                isSelected && "bg-ink/10 ring-1 ring-current",
                !hasError && "cursor-default"
              )}
            >
              {targetWords[i] || w.word}
            </button>
          );
        })}
      </div>

      {selectedIndex !== null && words[selectedIndex] && (
        <WordTipCard
          word={words[selectedIndex]}
          targetWord={targetWords[selectedIndex] || words[selectedIndex].word}
          onPlayAudio={() => speak(targetWords[selectedIndex] || words[selectedIndex].word, 0.7)}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
}

function WordTipCard({
  word,
  targetWord,
  onPlayAudio,
  onClose,
}: {
  word: WordPronunciationResult;
  targetWord: string;
  onPlayAudio: () => void;
  onClose: () => void;
}) {
  const tips = word.phonemes
    ? getPhonemeBasedTips(word)
    : findVietnameseErrors(word.word, targetWord);

  const fallbackTip = tips.length === 0
    ? VIETNAMESE_PHONEME_ERRORS.find(
        (e) =>
          e.errorPattern === "final_consonant_drop" ||
          e.errorPattern === "word_stress"
      )
    : null;

  return (
    <div className="p-4 rounded-lg bg-surface border border-rule space-y-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-ink">
            &ldquo;{targetWord}&rdquo;
          </span>
          <button
            onClick={onPlayAudio}
            className="p-1.5 rounded-md hover:bg-page transition-colors"
          >
            <Volume2 size={16} className="text-primary" />
          </button>
          {word.accuracyScore < 100 && (
            <span className="text-xs font-medium text-ink-faded">
              {word.accuracyScore}/100
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-ink-faded hover:text-ink"
        >
          Đóng
        </button>
      </div>

      {word.errorType === "omission" && (
        <p className="text-sm text-error">
          Bạn đã bỏ qua từ này. Hãy thử nói lại và phát âm rõ từ
          &ldquo;{targetWord}&rdquo;.
        </p>
      )}

      {tips.map((tip, i) => (
        <div key={i} className="text-sm text-ink-faded space-y-1">
          <p className="font-medium text-ink">
            {tip.ipaTarget} → {tip.ipaActual}
          </p>
          <p>{tip.tipVi}</p>
        </div>
      ))}

      {fallbackTip && (
        <div className="text-sm text-ink-faded">
          <p>{fallbackTip.tipVi}</p>
        </div>
      )}

      {word.phonemes && word.phonemes.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {word.phonemes.map((p, i) => (
            <span
              key={i}
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-mono",
                p.accuracyScore >= 80
                  ? "bg-success/10 text-success"
                  : p.accuracyScore >= 50
                    ? "bg-warning/10 text-warning"
                    : "bg-error/10 text-error"
              )}
            >
              {p.phoneme}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getPhonemeBasedTips(word: WordPronunciationResult) {
  if (!word.phonemes) return [];
  const badPhonemes = word.phonemes.filter((p) => p.accuracyScore < 60);
  const tips = [];

  for (const p of badPhonemes) {
    const phoneme = p.phoneme.toLowerCase();
    const matching = VIETNAMESE_PHONEME_ERRORS.find((entry) => {
      const target = entry.ipaTarget.toLowerCase();
      return target.includes(phoneme) || phoneme.includes(target.replace(/\//g, ""));
    });
    if (matching) tips.push(matching);
  }

  return tips;
}
