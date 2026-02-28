"use client";

import React, { useState } from "react";
import { usePronunciation } from "@/hooks/usePronunciation";
import { useTTS } from "@/hooks/useTTS";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WordHighlight } from "@/components/pronunciation/WordHighlight";
import { PronunciationReport } from "@/components/pronunciation/PronunciationReport";
import { cn } from "@/lib/utils";
import {
  Mic,
  Square,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  SkipForward,
  Settings,
  Volume2,
} from "lucide-react";

interface SpeakingProps {
  targetSentence: string;
  onComplete: (score: number) => void;
}

export function Speaking({ targetSentence, onComplete }: SpeakingProps) {
  const { assess, stop, reset, status, result, error } = usePronunciation();
  const { speak, cancel, isSpeaking } = useTTS();
  const [submitted, setSubmitted] = useState(false);

  const isListening = status === "listening";
  const isLoading = status === "loading";
  const isProcessing = status === "processing";
  const supported =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const handleListen = () => {
    if (isSpeaking) cancel();
    else speak(targetSentence, 0.85);
  };

  const handleToggle = () => {
    if (isListening) {
      stop();
    } else {
      assess(targetSentence);
    }
  };

  const handleSubmit = () => {
    if (isListening) stop();
    setSubmitted(true);
  };

  const handleRetry = () => {
    reset();
    setSubmitted(false);
    assess(targetSentence);
  };

  if (!supported) {
    return (
      <Card className="space-y-4 animate-scale-in">
        <p className="font-display font-semibold text-xl md:text-2xl text-ink text-center py-4 leading-relaxed">
          &ldquo;{targetSentence}&rdquo;
        </p>
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={handleListen}>
            <Volume2
              size={16}
              className={isSpeaking ? "animate-pulse" : ""}
            />
            {isSpeaking ? "Playing..." : "Listen"}
          </Button>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-warning-light">
          <AlertTriangle size={20} className="shrink-0 mt-0.5 text-warning" />
          <div>
            <p className="font-medium text-warning">
              Speech recognition unavailable
            </p>
            <p className="text-sm text-ink-faded mt-1">
              Your browser doesn&apos;t support speech recognition. Configure
              Azure Speech in{" "}
              <a
                href="/settings"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Settings <Settings size={12} />
              </a>{" "}
              to enable pronunciation assessment.
            </p>
          </div>
        </div>
        <Button onClick={() => onComplete(0)}>
          Skip <ArrowRight size={16} />
        </Button>
      </Card>
    );
  }

  const score = result?.pronunciationScore ?? 0;

  return (
    <Card className="space-y-5 animate-scale-in">
      <p className="font-display font-semibold text-xl md:text-2xl text-ink text-center py-4 leading-relaxed">
        &ldquo;{targetSentence}&rdquo;
      </p>

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
          {isSpeaking ? "Playing..." : "Listen first"}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={submitted || isProcessing || isLoading}
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
            ? "Đang tải engine phát âm..."
            : isListening
              ? "Đang nghe… nhấn để dừng"
              : isProcessing
                ? "Đang phân tích..."
                : "Nhấn để bắt đầu nói"}
        </p>
      </div>

      {error && (
        <p className="text-sm text-error text-center animate-fade-in">
          {error}
        </p>
      )}

      {!result && !submitted && !isListening && !isProcessing && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => onComplete(0)}>
            <SkipForward size={16} />
            Skip
          </Button>
        </div>
      )}

      {result && !submitted && (
        <div className="space-y-4 animate-slide-up">
          <WordHighlight
            words={result.words}
            targetSentence={targetSentence}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSubmit}>Nộp bài</Button>
            <Button variant="secondary" onClick={handleRetry}>
              <RotateCcw size={16} />
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {submitted && result && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-baseline gap-1 animate-score-pop">
            <span
              className={cn(
                "font-display text-4xl tabular-nums",
                score >= 80
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

          <WordHighlight
            words={result.words}
            targetSentence={targetSentence}
          />

          <PronunciationReport result={result} />

          <Button onClick={() => onComplete(score)}>
            Tiếp <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}
