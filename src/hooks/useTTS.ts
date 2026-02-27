"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type TTSBackend = "browser" | "api";

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [backend, setBackend] = useState<TTSBackend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("speechSynthesis" in window) {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      if (voices.length > 0) {
        setBackend("browser");
        return;
      }
      const onVoices = () => {
        const v = synth.getVoices();
        setBackend(v.length > 0 ? "browser" : "api");
        synth.removeEventListener("voiceschanged", onVoices);
      };
      synth.addEventListener("voiceschanged", onVoices);
      setTimeout(() => {
        if (!backend) setBackend("api");
      }, 2000);
      return () => synth.removeEventListener("voiceschanged", onVoices);
    }

    setBackend("api");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakBrowser = useCallback(
    (text: string, rate: number) => {
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
    []
  );

  const speakAPI = useCallback(
    async (text: string, rate: number, voice: string = "default") => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSpeaking(true);
      setError(null);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, rate, voice }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("TTS API failed");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setError("Audio playback failed. Try again.");
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setIsSpeaking(false);
          setError("Failed to generate speech. Check your connection.");
        }
      }
    },
    []
  );

  const speak = useCallback(
    (text: string, rate = 0.9, voice: string = "default") => {
      setError(null);
      if (backend === "browser") {
        speakBrowser(text, rate);
      } else if (backend === "api") {
        speakAPI(text, rate, voice);
      }
    },
    [backend, speakBrowser, speakAPI]
  );

  const cancel = useCallback(() => {
    if (backend === "browser" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    abortRef.current?.abort();
    setIsSpeaking(false);
  }, [backend]);

  const supported = backend !== null;

  return { speak, cancel, isSpeaking, supported, error, backend };
}
