"use client";

import React, { useState, useEffect } from "react";
import { useTTS } from "@/hooks/useTTS";
import { scoreSpelling, diffChars } from "@/lib/scoring";
import { ScoreDisplay } from "@/components/ui/ScoreDisplay";
import { CharDiff } from "@/components/ui/CharDiff";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { Volume2, ArrowRight, Check, Lightbulb, SkipForward } from "lucide-react";

interface SpellingBeeProps {
  word: string;
  definition?: string;
  phonetic?: string;
  syllables?: string;
  onComplete: (score: number) => void;
}

export function SpellingBee({
  word,
  definition,
  phonetic,
  syllables,
  onComplete,
}: SpellingBeeProps) {
  const { speak, isSpeaking, error: ttsError } = useTTS();
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (submitted && score < 100) {
      speak(word);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const result = scoreSpelling(input, word);
    setScore(result);
    setSubmitted(true);
  };

  const handleGiveUp = () => {
    setScore(0);
    setGaveUp(true);
    setSubmitted(true);
  };

  const charOps =
    submitted && !gaveUp && input ? diffChars(input, word) : null;

  return (
    <Card className="space-y-4 animate-scale-in">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => speak(word)} disabled={isSpeaking}>
          <Volume2 size={18} />
          {isSpeaking ? "Speaking..." : "Hear Word"}
        </Button>
        {definition && !submitted && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowHint((h) => !h)}
          >
            <Lightbulb size={16} />
            {showHint ? "Hide Hint" : "Hint"}
          </Button>
        )}
      </div>

      {ttsError && (
        <p className="text-sm text-error animate-fade-in">{ttsError}</p>
      )}

      {showHint && definition && !submitted && (
        <p className="text-sm text-ink-faded italic border-l-2 border-accent pl-3 animate-fade-in">
          {definition}
        </p>
      )}

      <Input
        value={input}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setInput(e.target.value)
        }
        disabled={submitted}
        placeholder="Spell the word..."
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          "font-mono text-lg tracking-wide",
          submitted && score >= 80 && "border-success",
          submitted && score >= 50 && score < 80 && "border-warning",
          submitted && score < 50 && "border-error"
        )}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" && !submitted && input.trim()) {
            handleSubmit();
          }
        }}
      />

      {!submitted ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSubmit} disabled={!input.trim()}>
            Check Spelling
          </Button>
          <Button variant="ghost" onClick={handleGiveUp}>
            <SkipForward size={16} />
            I Don&apos;t Know
          </Button>
        </div>
      ) : (
        <div className="space-y-4 animate-slide-up">
          {gaveUp ? (
            <p className="text-sm font-medium text-ink-faded">
              No worries — here&apos;s the answer:
            </p>
          ) : (
            <ScoreDisplay score={score} />
          )}

          {/* Correct word with pronunciation guide */}
          <div className="p-4 rounded-lg bg-page border border-rule space-y-2">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-success shrink-0" />
              <span className="font-mono text-xl tracking-wide text-success">
                {word}
              </span>
              <button
                onClick={() => speak(word)}
                className="text-ink-ghost hover:text-primary transition-colors p-1"
              >
                <Volume2 size={16} />
              </button>
            </div>

            {syllables && (
              <p className="text-base text-ink font-body pl-7">
                <span className="text-ink-faded text-xs uppercase tracking-wider mr-2">
                  Syllables
                </span>
                {syllables}
              </p>
            )}

            {phonetic && (
              <p className="text-base text-primary font-body pl-7">
                <span className="text-ink-faded text-xs uppercase tracking-wider mr-2">
                  Pronounce
                </span>
                {phonetic}
              </p>
            )}
          </div>

          {/* Character-level diff */}
          {charOps && score < 100 && <CharDiff ops={charOps} />}

          {definition && (
            <p className="text-sm text-ink-faded italic border-l-2 border-accent pl-3">
              {definition}
            </p>
          )}

          <Button onClick={() => onComplete(score)}>
            Next <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}
