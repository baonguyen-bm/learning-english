"use client";

import React, { useState } from "react";
import { usePronunciation } from "@/hooks/usePronunciation";
import { useTTS } from "@/hooks/useTTS";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { PHONEME_GUIDE, getBadPhonemes } from "@/lib/phonemeGuide";
import type { PhonemeResult } from "@/types/pronunciation";
import {
  Mic,
  Square,
  ArrowRight,
  RotateCcw,
  Volume2,
  SkipForward,
  AlertCircle,
} from "lucide-react";

interface WordDrillProps {
  word: string;
  phonetic?: string;
  previousPhonemes?: PhonemeResult[];
  onComplete: (score: number, phonemes?: PhonemeResult[]) => void;
  onSkip: () => void;
}

export function WordDrill({
  word,
  phonetic,
  previousPhonemes,
  onComplete,
  onSkip,
}: WordDrillProps) {
  const { assess, stop, reset, status, result, error } = usePronunciation();
  const { speak, cancel, isSpeaking } = useTTS();
  const [attempts, setAttempts] = useState(0);

  const isListening = status === "listening";
  const isLoading = status === "loading";
  const isProcessing = status === "processing";

  const handleListen = () => {
    if (isSpeaking) cancel();
    else speak(word, 0.7);
  };

  const handleToggle = () => {
    if (isListening) {
      stop();
    } else {
      assess(word);
    }
  };

  const handleRetry = () => {
    reset();
    setAttempts((a) => a + 1);
    assess(word);
  };

  const score = result?.pronunciationScore ?? 0;
  const wordResult = result?.words?.[0];
  const phonemes = wordResult?.phonemes;
  const badPhonemes = getBadPhonemes(phonemes);

  const previousBad = getBadPhonemes(previousPhonemes);

  return (
    <Card className="space-y-5 animate-scale-in">
      <div className="text-center space-y-2">
        <p className="font-display font-bold text-3xl md:text-4xl text-ink">
          {word}
        </p>
        {phonetic && (
          <p className="text-sm text-primary font-mono">{phonetic}</p>
        )}
      </div>

      <div className="flex justify-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleListen}
          disabled={isListening}
        >
          <Volume2
            size={16}
            className={isSpeaking ? "animate-pulse" : ""}
          />
          {isSpeaking ? "Đang phát..." : "Nghe mẫu"}
        </Button>
      </div>

      {!result && attempts === 0 && previousBad.length > 0 && (
        <div className="p-3 rounded-lg bg-warning/5 border border-warning/10 space-y-2">
          <p className="text-xs font-medium text-warning uppercase tracking-wider">
            Âm cần chú ý
          </p>
          {previousBad.map((p, i) => {
            const guide = PHONEME_GUIDE[p.phoneme.toLowerCase()];
            if (!guide) return null;
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono text-sm font-bold text-warning">
                  {p.phoneme}
                </span>
                <span className="text-xs text-ink-faded">
                  /{guide.ipa}/ — {guide.descVi}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={isProcessing || isLoading || !!result}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center text-white",
            "transition-all duration-150 ease-out",
            "disabled:opacity-50 disabled:pointer-events-none",
            isListening
              ? "bg-error animate-pulse scale-110 shadow-lg shadow-error/30"
              : "bg-primary hover:bg-primary-hover shadow-md active:scale-95"
          )}
        >
          {isListening ? <Square size={28} /> : <Mic size={28} />}
        </button>
        <p className="text-sm text-ink-faded">
          {isLoading
            ? "Đang tải..."
            : isListening
              ? "Đang nghe…"
              : isProcessing
                ? "Đang phân tích..."
                : result
                  ? ""
                  : "Nhấn để nói"}
        </p>
      </div>

      {error && (
        <p className="text-sm text-error text-center animate-fade-in">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-baseline justify-center gap-1 animate-score-pop">
            <span
              className={cn(
                "font-display text-5xl tabular-nums",
                score >= 75
                  ? "text-success"
                  : score >= 50
                    ? "text-warning"
                    : "text-error"
              )}
            >
              {score}
            </span>
            <span className="text-ink-ghost text-lg">/ 100</span>
          </div>

          {phonemes && phonemes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-faded uppercase tracking-wider text-center">
                Phân tích từng âm
              </p>
              <div className="flex flex-wrap justify-center gap-1">
                {phonemes.map((p, i) => {
                  const guide = PHONEME_GUIDE[p.phoneme.toLowerCase()];
                  const isBad = p.accuracyScore < 70;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-xs font-mono inline-flex items-center gap-1",
                        p.accuracyScore >= 80
                          ? "bg-success/10 text-success"
                          : p.accuracyScore >= 50
                            ? "bg-warning/10 text-warning"
                            : "bg-error/10 text-error"
                      )}
                      title={guide ? `/${guide.ipa}/ — ${guide.descVi}` : p.phoneme}
                    >
                      {p.phoneme}
                      {isBad && (
                        <span className="text-[9px] opacity-70">
                          {p.accuracyScore}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

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

          {phonemes && badPhonemes.length === 0 && score < 75 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/10">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-warning" />
              <p className="text-sm text-ink-faded">
                Từng âm riêng lẻ khá ổn, hãy chú ý nối âm và nhịp điệu khi phát âm cả từ.
              </p>
            </div>
          )}

          {score >= 75 && (
            <p className="text-sm text-success text-center font-medium">
              Tốt lắm! Phát âm đã đạt chuẩn.
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            {score < 75 && (
              <Button variant="secondary" onClick={handleRetry}>
                <RotateCcw size={16} />
                Thử lại
              </Button>
            )}
            <Button onClick={() => onComplete(score, phonemes)}>
              {score >= 75 ? "Tiếp" : "Qua từ tiếp"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {!result && !isListening && !isProcessing && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onSkip}>
            <SkipForward size={16} />
            Bỏ qua
          </Button>
        </div>
      )}
    </Card>
  );
}
