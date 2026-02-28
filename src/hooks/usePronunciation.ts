"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getAzureSpeechConfig } from "@/lib/azureSpeechConfig";
import { analyzeWithHeuristics } from "@/lib/vietnameseHeuristics";
import type { PronunciationResult, WordPronunciationResult } from "@/types/pronunciation";

type AssessmentStatus = "idle" | "loading" | "listening" | "processing" | "done" | "error";

export function usePronunciation() {
  const [status, setStatus] = useState<AssessmentStatus>("idle");
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [azureConfigured, setAzureConfigured] = useState(false);
  const recognizerRef = useRef<unknown>(null);
  const browserSttRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setAzureConfigured(!!getAzureSpeechConfig());
  }, []);

  /**
   * Start pronunciation assessment.
   * Uses Azure if configured, otherwise falls back to browser STT + heuristics.
   */
  const assess = useCallback(async (referenceText: string) => {
    setError(null);
    setResult(null);

    const azureConfig = getAzureSpeechConfig();
    if (azureConfig) {
      try {
        setStatus("loading");
        const sdk = await import("microsoft-cognitiveservices-speech-sdk");

        const speechConfig = sdk.SpeechConfig.fromSubscription(
          azureConfig.key,
          azureConfig.region
        );
        speechConfig.speechRecognitionLanguage = "en-US";

        const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        const pronConfig = new sdk.PronunciationAssessmentConfig(
          referenceText,
          sdk.PronunciationAssessmentGradingSystem.HundredMark,
          sdk.PronunciationAssessmentGranularity.Phoneme,
          true
        );
        pronConfig.enableProsodyAssessment = true;
        pronConfig.applyTo(recognizer);

        recognizerRef.current = recognizer;
        setStatus("listening");

        recognizer.recognizeOnceAsync(
          (speechResult) => {
            setStatus("processing");

            if (speechResult.reason === sdk.ResultReason.RecognizedSpeech) {
              const pronResult =
                sdk.PronunciationAssessmentResult.fromResult(speechResult);

              const detailJson = speechResult.properties?.getProperty(
                sdk.PropertyId.SpeechServiceResponse_JsonResult
              );

              let words: WordPronunciationResult[] = [];
              if (detailJson) {
                try {
                  const parsed = JSON.parse(detailJson);
                  const nBest = parsed?.NBest?.[0];
                  if (nBest?.Words) {
                    words = nBest.Words.map(
                      (w: {
                        Word: string;
                        PronunciationAssessment: {
                          AccuracyScore: number;
                          ErrorType: string;
                        };
                        Phonemes?: {
                          Phoneme: string;
                          PronunciationAssessment: { AccuracyScore: number };
                        }[];
                      }) => ({
                        word: w.Word,
                        accuracyScore:
                          w.PronunciationAssessment?.AccuracyScore ?? 0,
                        errorType: mapErrorType(
                          w.PronunciationAssessment?.ErrorType
                        ),
                        phonemes: w.Phonemes?.map((p) => ({
                          phoneme: p.Phoneme,
                          accuracyScore:
                            p.PronunciationAssessment?.AccuracyScore ?? 0,
                        })),
                      })
                    );
                  }
                } catch {
                  // fall through — words stays empty
                }
              }

              setResult({
                transcript: speechResult.text,
                accuracyScore: pronResult.accuracyScore,
                fluencyScore: pronResult.fluencyScore,
                completenessScore: pronResult.completenessScore,
                prosodyScore: pronResult.prosodyScore,
                pronunciationScore: pronResult.pronunciationScore,
                words,
                source: "azure",
              });
              setStatus("done");
            } else {
              setError("Could not recognize speech. Please try again.");
              setStatus("error");
            }

            try { recognizer.close(); } catch { /* already disposed */ }
            recognizerRef.current = null;
          },
          (err: string) => {
            setError(
              err || "Recognition failed. Check your Azure key and region."
            );
            setStatus("error");
            try { recognizer.close(); } catch { /* already disposed */ }
            recognizerRef.current = null;
          }
        );
      } catch (e) {
        setError(
          `Azure SDK error: ${e instanceof Error ? e.message : "Unknown error"}`
        );
        setStatus("error");
      }
    } else {
      // --- Browser fallback mode ---
      if (
        typeof window === "undefined" ||
        !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
      ) {
        setError(
          "Speech recognition not available. Configure Azure Speech in Settings for pronunciation assessment."
        );
        setStatus("error");
        return;
      }

      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      browserSttRef.current = recognition;
      setStatus("listening");

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        setStatus("processing");
        const sttResult = event.results[event.resultIndex][0];
        const transcript = sttResult.transcript;
        const confidence = sttResult.confidence ?? null;

        const wordAnalyses = analyzeWithHeuristics(
          transcript,
          referenceText,
          confidence
        );

        const correctCount = wordAnalyses.filter(
          (w) => w.status === "correct"
        ).length;
        const totalWords = wordAnalyses.length;
        const accuracyScore =
          totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;

        setResult({
          transcript,
          accuracyScore,
          fluencyScore: confidence !== null ? Math.round(confidence * 100) : 50,
          completenessScore:
            totalWords > 0
              ? Math.round(
                  (wordAnalyses.filter((w) => w.status !== "error" || w.score > 0)
                    .length /
                    totalWords) *
                    100
                )
              : 0,
          pronunciationScore: accuracyScore,
          words: wordAnalyses.map((w) => ({
            word: w.word,
            accuracyScore: w.score,
            errorType:
              w.status === "correct" || w.status === "suspect"
                ? ("none" as const)
                : ("mispronunciation" as const),
          })),
          source: "heuristic",
        });
        setStatus("done");
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const messages: Record<string, string> = {
          "no-speech": "No speech detected. Please try again.",
          "audio-capture": "No microphone found.",
          "not-allowed": "Microphone access denied.",
        };
        setError(messages[event.error] || "Could not hear you. Try again.");
        setStatus("error");
        browserSttRef.current = null;
      };

      recognition.onend = () => {
        browserSttRef.current = null;
      };

      recognition.start();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        const r = recognizerRef.current as { close: () => void };
        try { r.close(); } catch { /* ignore */ }
        recognizerRef.current = null;
      }
      if (browserSttRef.current) {
        browserSttRef.current.stop();
        browserSttRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (recognizerRef.current) {
      const recognizer = recognizerRef.current as { close: () => void };
      try { recognizer.close(); } catch { /* ignore */ }
      recognizerRef.current = null;
    }
    if (browserSttRef.current) {
      browserSttRef.current.stop();
      browserSttRef.current = null;
    }
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setAzureConfigured(!!getAzureSpeechConfig());
  }, []);

  return {
    assess,
    stop,
    reset,
    status,
    result,
    error,
    azureConfigured,
  };
}

function mapErrorType(
  azureErrorType?: string
): "none" | "mispronunciation" | "omission" | "insertion" {
  switch (azureErrorType?.toLowerCase()) {
    case "mispronunciation":
      return "mispronunciation";
    case "omission":
      return "omission";
    case "insertion":
      return "insertion";
    default:
      return "none";
  }
}
