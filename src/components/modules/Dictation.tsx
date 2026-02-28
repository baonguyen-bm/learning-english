"use client";

import React, { useState } from "react";
import { useTTS } from "@/hooks/useTTS";
import { scoreDictation, diffWords } from "@/lib/scoring";
import { WordDiff } from "@/components/ui/WordDiff";
import { ScoreDisplay } from "@/components/ui/ScoreDisplay";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { Volume2, Snail, ArrowRight, SkipForward } from "lucide-react";

interface DictationProps {
  sentence: string;
  hint?: string;
  onComplete: (score: number) => void;
}

export function Dictation({ sentence, hint, onComplete }: DictationProps) {
  const { speak, isSpeaking, error: ttsError } = useTTS();
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const result = scoreDictation(input, sentence);
    setScore(result);
    setSubmitted(true);
  };

  const handleGiveUp = () => {
    setScore(0);
    setGaveUp(true);
    setSubmitted(true);
  };

  const borderColor = () => {
    if (!submitted) return "";
    if (score >= 80) return "border-success";
    if (score >= 50) return "border-warning";
    return "border-error";
  };

  return (
    <Card className="space-y-4 animate-scale-in">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => speak(sentence)} disabled={isSpeaking}>
          <Volume2 size={18} />
          {isSpeaking ? "Playing..." : "Play Audio"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => speak(sentence, 0.6)}
          disabled={isSpeaking}
        >
          <Snail size={16} />
          Slow
        </Button>
      </div>

      {ttsError && (
        <p className="text-sm text-error animate-fade-in">{ttsError}</p>
      )}

      {hint && (
        <p className="text-sm text-primary font-medium">Topic: {hint}</p>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={submitted}
        className={cn(
          "w-full bg-transparent border-b-2 border-rule px-1 py-3 min-h-[80px]",
          "font-mono text-ink placeholder:text-ink-ghost resize-none",
          "transition-colors duration-250 ease-out",
          "focus:border-primary focus:outline-none",
          "disabled:opacity-60",
          borderColor()
        )}
        placeholder="Type what you hear..."
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !submitted && input.trim()) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />

      {!submitted ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSubmit} disabled={!input.trim()}>
            Check Answer
          </Button>
          <Button variant="ghost" onClick={handleGiveUp}>
            <SkipForward size={16} />
            Give Up
          </Button>
        </div>
      ) : (
        <div className="space-y-4 animate-slide-up">
          {gaveUp ? (
            <p className="text-sm font-medium text-ink-faded">
              No worries — here&apos;s the sentence:
            </p>
          ) : (
            <ScoreDisplay score={score} />
          )}
          <div className="p-4 rounded-lg bg-page border border-rule">
            <p className="text-xs font-medium text-ink-faded uppercase tracking-wider mb-1">
              Correct sentence
            </p>
            <p className="font-mono text-ink leading-relaxed">{sentence}</p>
          </div>
          {!gaveUp && (
            <WordDiff
              results={diffWords(input, sentence)}
              onWordClick={(word) => speak(word)}
            />
          )}
          <Button onClick={() => onComplete(score)}>
            Next <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}
