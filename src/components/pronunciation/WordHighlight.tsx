"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import type { WordPronunciationResult, PhonemeResult } from "@/types/pronunciation";
import { findVietnameseErrors } from "@/lib/vietnameseHeuristics";
import { PHONEME_GUIDE } from "@/lib/phonemeGuide";

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
  const hasPhonemes = word.phonemes && word.phonemes.length > 0;
  const badPhonemes = hasPhonemes
    ? word.phonemes!.filter((p) => p.accuracyScore < 70)
    : [];
  const heuristicTips = !hasPhonemes
    ? findVietnameseErrors(word.word, targetWord)
    : [];

  return (
    <div className="p-4 rounded-lg bg-surface border border-rule space-y-3 animate-slide-up">
      {/* Header */}
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

      {/* Phoneme map — show all phonemes with bad ones highlighted */}
      {hasPhonemes && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-faded uppercase tracking-wider">
            Phân tích từng âm
          </p>
          <div className="flex flex-wrap gap-1">
            {word.phonemes!.map((p, i) => (
              <PhonemeChip key={i} phoneme={p} />
            ))}
          </div>
        </div>
      )}

      {/* Specific phoneme errors with Vietnamese guidance */}
      {badPhonemes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-error uppercase tracking-wider">
            Âm cần cải thiện
          </p>
          {badPhonemes.map((p, i) => {
            const guide = PHONEME_GUIDE[p.phoneme.toLowerCase()];
            if (!guide) return null;
            return (
              <div
                key={i}
                className="p-3 rounded-lg bg-error/5 border border-error/10 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-error">
                    {p.phoneme}
                  </span>
                  <span className="text-xs text-ink-faded">
                    /{guide.ipa}/ — {p.accuracyScore}/100
                  </span>
                </div>
                <p className="text-sm text-ink-faded">{guide.descVi}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Good phonemes summary */}
      {hasPhonemes && badPhonemes.length === 0 && word.accuracyScore < 80 && (
        <p className="text-sm text-ink-faded">
          Từng âm riêng lẻ khá ổn, hãy chú ý nối âm tự nhiên và nhịp điệu khi nói cả từ.
        </p>
      )}

      {/* Heuristic fallback (no Azure phonemes) */}
      {heuristicTips.map((tip, i) => (
        <div key={i} className="text-sm text-ink-faded space-y-1">
          <p className="font-medium text-ink">
            {tip.ipaTarget} → {tip.ipaActual}
          </p>
          <p>{tip.tipVi}</p>
        </div>
      ))}
    </div>
  );
}

function PhonemeChip({ phoneme }: { phoneme: PhonemeResult }) {
  const guide = PHONEME_GUIDE[phoneme.phoneme.toLowerCase()];
  const isBad = phoneme.accuracyScore < 70;

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-mono inline-flex items-center gap-1",
        phoneme.accuracyScore >= 80
          ? "bg-success/10 text-success"
          : phoneme.accuracyScore >= 50
            ? "bg-warning/10 text-warning"
            : "bg-error/10 text-error"
      )}
      title={guide ? `/${guide.ipa}/ — ${guide.descVi}` : phoneme.phoneme}
    >
      {phoneme.phoneme}
      {isBad && <span className="text-[9px] opacity-70">{phoneme.accuracyScore}</span>}
    </span>
  );
}
