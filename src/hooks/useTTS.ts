"use client";

import { useState, useEffect, useCallback } from "react";

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSupported(true);
    }
  }, []);

  const speak = useCallback(
    (text: string, rate = 0.9) => {
      if (!supported) {
        setError("Audio unavailable — your browser does not support text-to-speech.");
        return;
      }

      setError(null);
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = rate;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        setIsSpeaking(false);
        if (e.error !== "canceled") {
          setError("Audio playback failed. Try again.");
        }
      };

      window.speechSynthesis.speak(utterance);
    },
    [supported]
  );

  const cancel = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [supported]);

  return { speak, cancel, isSpeaking, supported, error };
}
