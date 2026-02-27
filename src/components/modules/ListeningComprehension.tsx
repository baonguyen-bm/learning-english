"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import type { ListeningItem } from "@/types/exercises";
import { ScoreDisplay } from "@/components/ui/ScoreDisplay";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  Volume2,
  Snail,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface QuestionResult {
  key: string;
  score: number;
}

interface ListeningComprehensionProps {
  item: ListeningItem;
  onComplete: (score: number, questionResults: QuestionResult[]) => void;
}

type Phase = "listen" | "questions" | "done";
type TTSBackend = "browser" | "api" | null;

const VOICE_KEYS = ["default", "male", "female", "male2", "female2"];

export function ListeningComprehension({
  item,
  onComplete,
}: ListeningComprehensionProps) {
  const [phase, setPhase] = useState<Phase>("listen");
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [ttsBackend, setTTSBackend] = useState<TTSBackend>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("speechSynthesis" in window) {
      const synth = window.speechSynthesis;
      const loadVoices = () => {
        const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"));
        if (voices.length > 0) {
          voicesRef.current = voices;
          setTTSBackend("browser");
        }
      };
      loadVoices();
      synth.addEventListener("voiceschanged", loadVoices);

      const timeout = setTimeout(() => {
        setTTSBackend((prev) => prev ?? "api");
      }, 2000);

      return () => {
        synth.removeEventListener("voiceschanged", loadVoices);
        clearTimeout(timeout);
      };
    }
    setTTSBackend("api");
  }, []);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  const playDialogBrowser = useCallback(
    (rate: number) => {
      speechSynthesis.cancel();
      setIsPlaying(true);

      const speakers = [...new Set(item.dialog.map((l) => l.speaker))];
      const voices = voicesRef.current;
      let i = 0;

      function speakNext() {
        if (i >= item.dialog.length) {
          setIsPlaying(false);
          setHasPlayed(true);
          return;
        }
        const line = item.dialog[i];
        const speakerIdx = speakers.indexOf(line.speaker);
        const utterance = new SpeechSynthesisUtterance(line.text);
        utterance.lang = "en-US";
        utterance.rate = rate;
        if (voices.length > 0)
          utterance.voice = voices[speakerIdx % voices.length];

        utterance.onend = () => {
          i++;
          setTimeout(speakNext, 500);
        };
        utterance.onerror = () => {
          i++;
          setTimeout(speakNext, 500);
        };
        speechSynthesis.speak(utterance);
      }
      speakNext();
    },
    [item.dialog]
  );

  const playDialogAPI = useCallback(
    async (rate: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsPlaying(true);

      const speakers = [...new Set(item.dialog.map((l) => l.speaker))];

      try {
        for (let i = 0; i < item.dialog.length; i++) {
          if (controller.signal.aborted) break;

          const line = item.dialog[i];
          const speakerIdx = speakers.indexOf(line.speaker);
          const voice = VOICE_KEYS[speakerIdx % VOICE_KEYS.length];

          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: line.text, rate, voice }),
            signal: controller.signal,
          });

          if (!res.ok) throw new Error("TTS failed");

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          await new Promise<void>((resolve, reject) => {
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error("playback failed"));
            };
            controller.signal.addEventListener("abort", () => {
              audio.pause();
              URL.revokeObjectURL(url);
              reject(new Error("aborted"));
            });
            audio.play().catch(reject);
          });

          if (i < item.dialog.length - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        setIsPlaying(false);
        setHasPlayed(true);
      } catch (e) {
        if ((e as Error).message !== "aborted") {
          setIsPlaying(false);
          setHasPlayed(true);
        }
      }
    },
    [item.dialog]
  );

  const playDialog = useCallback(
    (rate: number = 0.9) => {
      if (isPlaying) return;
      if (ttsBackend === "browser") {
        playDialogBrowser(rate);
      } else {
        playDialogAPI(rate);
      }
    },
    [isPlaying, ttsBackend, playDialogBrowser, playDialogAPI]
  );

  const stopPlayback = useCallback(() => {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const handleSelectAnswer = (optionIdx: number) => {
    if (showFeedback) return;
    setSelectedAnswer(optionIdx);
    setShowFeedback(true);

    const question = item.questions[currentQ];
    const isCorrect = optionIdx === question.correct;
    const slug = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    setQuestionResults((prev) => [
      ...prev,
      { key: `${slug}:q${currentQ}`, score: isCorrect ? 100 : 0 },
    ]);
  };

  const handleNextQuestion = () => {
    if (currentQ + 1 < item.questions.length) {
      setCurrentQ((q) => q + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      setPhase("done");
    }
  };

  const allResults = [...questionResults];
  const overallScore =
    allResults.length > 0
      ? Math.round(
          allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length
        )
      : 0;

  return (
    <Card className="space-y-5 animate-scale-in">
      <div className="space-y-1">
        <p className="text-xs font-medium text-ink-faded uppercase tracking-wider">
          Listening Comprehension
        </p>
        <h2 className="font-display font-semibold text-xl text-ink">{item.title}</h2>
      </div>

      {phase === "listen" && (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-3 p-4 rounded-lg bg-page border border-rule">
            <p className="text-xs font-medium text-ink-faded uppercase tracking-wider">
              Dialog
            </p>
            {item.dialog.map((line, i) => {
              const speakers = [
                ...new Set(item.dialog.map((l) => l.speaker)),
              ];
              const speakerIdx = speakers.indexOf(line.speaker);
              const isSecondSpeaker = speakerIdx % 2 === 1;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-0.5",
                    isSecondSpeaker && "items-end"
                  )}
                >
                  <span className="text-xs font-medium text-primary">
                    {line.speaker}
                  </span>
                  <div
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm text-ink max-w-[85%]",
                      isSecondSpeaker
                        ? "bg-primary/10 rounded-tr-sm"
                        : "bg-surface border border-rule rounded-tl-sm"
                    )}
                  >
                    {hasPlayed ? line.text : "• • •"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => playDialog()} disabled={isPlaying}>
              <Volume2 size={18} />
              {isPlaying
                ? "Playing..."
                : hasPlayed
                  ? "Replay"
                  : "Play Dialog"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => playDialog(0.6)}
              disabled={isPlaying}
            >
              <Snail size={16} />
              Slow
            </Button>
          </div>

          {hasPlayed && (
            <Button
              onClick={() => {
                stopPlayback();
                setPhase("questions");
              }}
              className="w-full animate-slide-up"
            >
              Ready to Answer <ArrowRight size={16} />
            </Button>
          )}
        </div>
      )}

      {phase === "questions" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">
              Question {currentQ + 1} of {item.questions.length}
            </p>
            <div className="flex gap-1.5">
              {item.questions.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-colors",
                    i < currentQ
                      ? questionResults[i]?.score === 100
                        ? "bg-success"
                        : "bg-error"
                      : i === currentQ
                        ? "bg-primary"
                        : "bg-rule"
                  )}
                />
              ))}
            </div>
          </div>

          <p className="font-display font-semibold text-lg text-ink">
            {item.questions[currentQ].question}
          </p>

          <div className="space-y-2">
            {item.questions[currentQ].options.map((option, idx) => {
              const isCorrect = idx === item.questions[currentQ].correct;
              const isSelected = idx === selectedAnswer;

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectAnswer(idx)}
                  disabled={showFeedback}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border-2 transition-all",
                    "min-h-[44px] flex items-center gap-3",
                    !showFeedback &&
                      "border-rule hover:border-primary hover:bg-primary/5 active:scale-[0.98]",
                    showFeedback &&
                      isCorrect &&
                      "border-success bg-success/5",
                    showFeedback &&
                      isSelected &&
                      !isCorrect &&
                      "border-error bg-error/5",
                    showFeedback &&
                      !isSelected &&
                      !isCorrect &&
                      "border-rule opacity-50",
                    "disabled:cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0",
                      "text-xs font-medium",
                      !showFeedback && "border-rule text-ink-faded",
                      showFeedback &&
                        isCorrect &&
                        "border-success text-success",
                      showFeedback &&
                        isSelected &&
                        !isCorrect &&
                        "border-error text-error"
                    )}
                  >
                    {showFeedback && isCorrect ? (
                      <CheckCircle2 size={18} />
                    ) : showFeedback && isSelected && !isCorrect ? (
                      <XCircle size={18} />
                    ) : (
                      String.fromCharCode(65 + idx)
                    )}
                  </span>
                  <span className="text-sm text-ink">{option}</span>
                </button>
              );
            })}
          </div>

          {showFeedback && (
            <Button
              onClick={handleNextQuestion}
              className="w-full animate-slide-up"
            >
              {currentQ + 1 < item.questions.length ? (
                <>
                  Next Question <ArrowRight size={16} />
                </>
              ) : (
                <>
                  See Results <ArrowRight size={16} />
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4 animate-slide-up">
          <ScoreDisplay score={overallScore} />

          <div className="space-y-2">
            {item.questions.map((q, i) => {
              const result = questionResults[i];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 text-sm p-2 rounded-lg",
                    result?.score === 100
                      ? "text-success bg-success/5"
                      : "text-error bg-error/5"
                  )}
                >
                  {result?.score === 100 ? (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={16} className="shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">{q.question}</p>
                    <p className="text-xs opacity-75 mt-0.5">
                      Correct: {q.options[q.correct]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={() => onComplete(overallScore, allResults)}>
            Next <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}
