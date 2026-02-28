"use client";

import React, { useState } from "react";
import { useSTT } from "@/hooks/useSTT";
import { useTTS } from "@/hooks/useTTS";
import { scoreSpeaking } from "@/lib/scoring";
import { ScoreDisplay } from "@/components/ui/ScoreDisplay";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { Mic, Square, ArrowRight, RotateCcw, AlertTriangle, SkipForward, Settings, Volume2 } from "lucide-react";

interface SpeakingProps {
  targetSentence: string;
  onComplete: (score: number) => void;
}

export function Speaking({ targetSentence, onComplete }: SpeakingProps) {
  const {
    startListening,
    stopListening,
    isListening,
    transcript,
    supported,
    error,
    resetTranscript,
  } = useSTT();
  const { speak, cancel, isSpeaking } = useTTS();
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const handleListen = () => {
    if (isSpeaking) {
      cancel();
    } else {
      speak(targetSentence, 0.85);
    }
  };

  if (!supported) {
    return (
      <Card className="space-y-4 animate-scale-in">
        <p className="font-display font-semibold text-xl md:text-2xl text-ink text-center py-4 leading-relaxed">
          &ldquo;{targetSentence}&rdquo;
        </p>
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleListen}
          >
            <Volume2 size={16} className={isSpeaking ? "animate-pulse" : ""} />
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
              Your browser doesn&apos;t support speech recognition natively. You
              can configure a Google Cloud API key in{" "}
              <a href="/settings" className="text-primary hover:underline inline-flex items-center gap-0.5">
                Settings <Settings size={12} />
              </a>{" "}
              to enable it.
            </p>
          </div>
        </div>
        <Button onClick={() => onComplete(0)}>
          Skip <ArrowRight size={16} />
        </Button>
      </Card>
    );
  }

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = () => {
    if (isListening) stopListening();
    const result = scoreSpeaking(transcript, targetSentence);
    setScore(result);
    setSubmitted(true);
  };

  const handleRetry = () => {
    resetTranscript();
    startListening();
  };

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
          <Volume2 size={16} className={isSpeaking ? "animate-pulse" : ""} />
          {isSpeaking ? "Playing..." : "Listen first"}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={submitted}
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
          {isListening ? "Listening… tap to stop" : "Tap to start recording"}
        </p>
      </div>

      {error && (
        <p className="text-sm text-error text-center animate-fade-in">
          {error}
        </p>
      )}

      {!transcript && !submitted && !isListening && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => onComplete(0)}>
            <SkipForward size={16} />
            Skip
          </Button>
        </div>
      )}

      {transcript && !submitted && (
        <div className="space-y-4 animate-slide-up">
          <div className="p-4 rounded-lg bg-page border border-rule">
            <p className="text-xs font-medium text-ink-faded uppercase tracking-wider mb-1">
              You said:
            </p>
            <p className="font-body text-lg text-ink">
              &ldquo;{transcript}&rdquo;
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSubmit}>Submit</Button>
            <Button variant="secondary" onClick={handleRetry}>
              <RotateCcw size={16} />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {submitted && (
        <div className="space-y-4 animate-slide-up">
          <ScoreDisplay score={score} />
          <div className="p-4 rounded-lg bg-page border border-rule">
            <p className="text-xs font-medium text-ink-faded uppercase tracking-wider mb-1">
              You said:
            </p>
            <p className="font-body text-lg text-ink">
              &ldquo;{transcript}&rdquo;
            </p>
          </div>
          <Button onClick={() => onComplete(score)}>
            Next <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}
