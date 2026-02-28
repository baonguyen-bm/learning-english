"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useSTT() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported(
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window
    );
  }, []);

  const startListening = useCallback(() => {
    if (isListening) return;
    setError(null);

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex][0];
      setTranscript(result.transcript);
      setConfidence(result.confidence ?? null);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      const messages: Record<string, string> = {
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "No microphone found. Check your device settings.",
        "not-allowed": "Microphone access denied. Allow permission and retry.",
      };
      setError(
        messages[event.error] || "Could not hear you. Please try again."
      );
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setConfidence(null);
    recognition.start();
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setConfidence(null);
    setError(null);
  }, []);

  return {
    startListening,
    stopListening,
    resetTranscript,
    isListening,
    transcript,
    confidence,
    supported,
    error,
  };
}
