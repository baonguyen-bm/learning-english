"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type STTBackend = "browser" | "google-cloud" | "none";

const GOOGLE_STT_KEY = "google_cloud_stt_api_key";

export function getGoogleSTTKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GOOGLE_STT_KEY);
}

export function setGoogleSTTKey(key: string) {
  localStorage.setItem(GOOGLE_STT_KEY, key);
}

export function removeGoogleSTTKey() {
  localStorage.removeItem(GOOGLE_STT_KEY);
}

export function useSTT() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [backend, setBackend] = useState<STTBackend>("none");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      setBackend("browser");
    } else if (getGoogleSTTKey()) {
      setBackend("google-cloud");
    } else {
      setBackend("none");
    }
  }, []);

  const startBrowserListening = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex][0].transcript;
      setTranscript(result);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      const messages: Record<string, string> = {
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "No microphone found. Check your device settings.",
        "not-allowed": "Microphone access denied. Allow permission and retry.",
      };
      setError(messages[event.error] || "Could not hear you. Please try again.");
    };

    recognitionRef.current = recognition;
    setTranscript("");
    recognition.start();
  }, []);

  const startGoogleCloudListening = useCallback(async () => {
    const apiKey = getGoogleSTTKey();
    if (!apiKey) {
      setError("Google Cloud API key not configured. Go to Settings to add it.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);

        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];

          try {
            const res = await fetch(
              `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  config: {
                    encoding: "WEBM_OPUS",
                    sampleRateHertz: 48000,
                    languageCode: "en-US",
                    model: "latest_short",
                  },
                  audio: { content: base64Audio },
                }),
              }
            );

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              const msg =
                errData?.error?.message || "Google Cloud STT request failed";
              setError(msg);
              setIsListening(false);
              return;
            }

            const data = await res.json();
            const text =
              data.results?.[0]?.alternatives?.[0]?.transcript || "";
            setTranscript(text);
          } catch {
            setError("Failed to reach Google Cloud. Check your connection.");
          }
          setIsListening(false);
        };
      };

      setIsListening(true);
      setTranscript("");
      setError(null);
      mediaRecorder.start();
    } catch {
      setError("Microphone access denied. Allow permission and retry.");
    }
  }, []);

  const startListening = useCallback(() => {
    if (isListening) return;
    setError(null);

    if (backend === "browser") {
      startBrowserListening();
    } else if (backend === "google-cloud") {
      startGoogleCloudListening();
    }
  }, [backend, isListening, startBrowserListening, startGoogleCloudListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  const refreshBackend = useCallback(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      setBackend("browser");
    } else if (getGoogleSTTKey()) {
      setBackend("google-cloud");
    } else {
      setBackend("none");
    }
  }, []);

  const supported = backend !== "none";

  return {
    startListening,
    stopListening,
    resetTranscript,
    refreshBackend,
    isListening,
    transcript,
    supported,
    backend,
    error,
  };
}
