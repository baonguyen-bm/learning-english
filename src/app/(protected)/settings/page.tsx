"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Mic,
  MessageSquare,
} from "lucide-react";
import {
  getDialogVoices,
  setDialogVoices,
  DIALOG_VOICE_OPTIONS,
} from "@/lib/dialogVoices";

const MAX_SPEAKER_SLOTS = 5;
const VOICE_PREVIEW_PHRASE =
  "Hello, this is a sample of my voice for the dialogue.";

async function previewVoice(
  voiceKey: string,
  onStart: () => void,
  onEnd: () => void
) {
  onStart();
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: VOICE_PREVIEW_PHRASE,
        rate: 0.9,
        voice: voiceKey,
      }),
    });
    if (!res.ok) throw new Error("TTS failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      onEnd();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      onEnd();
    };
    await audio.play();
  } catch {
    onEnd();
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);
  const [sttSupported, setSttSupported] = useState<boolean | null>(null);
  const [dialogVoices, setDialogVoicesState] = useState<string[]>([]);

  useEffect(() => {
    setTtsSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis.getVoices().length > 0 || true
        : false
    );
    setDialogVoicesState(getDialogVoices());
    setSttSupported(
      typeof window !== "undefined" &&
        ("webkitSpeechRecognition" in window ||
          "SpeechRecognition" in window)
    );
  }, []);

  const handleDialogVoiceChange = (speakerIndex: number, voiceKey: string) => {
    const next = [...getDialogVoices()];
    while (next.length <= speakerIndex) next.push("default");
    next[speakerIndex] = voiceKey;
    setDialogVoices(next);
    setDialogVoicesState(getDialogVoices());
  };

  return (
    <main className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 bg-surface border-b border-rule px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="min-w-[44px] min-h-[44px] -ml-2 rounded-lg hover:bg-page transition-colors flex items-center justify-center"
          >
            <ArrowLeft size={20} className="text-ink" />
          </button>
          <h1 className="font-display font-semibold text-lg text-ink">Settings</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card className="space-y-4">
          <h2 className="font-display font-semibold text-lg text-ink">
            Speech API Status
          </h2>
          <p className="text-sm text-ink-faded">
            Your browser&apos;s built-in speech capabilities.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-page">
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-ink-faded" />
                <span className="text-sm font-medium text-ink">
                  Text-to-Speech (TTS)
                </span>
              </div>
              {ttsSupported ? (
                <span className="text-xs font-medium text-success flex items-center gap-1">
                  <CheckCircle2 size={14} /> Browser
                </span>
              ) : (
                <span className="text-xs font-medium text-primary flex items-center gap-1">
                  <CheckCircle2 size={14} /> Edge TTS API
                </span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-page">
              <div className="flex items-center gap-2">
                <Mic size={18} className="text-ink-faded" />
                <span className="text-sm font-medium text-ink">
                  Speech-to-Text (STT)
                </span>
              </div>
              {sttSupported ? (
                <span className="text-xs font-medium text-success flex items-center gap-1">
                  <CheckCircle2 size={14} /> Browser
                </span>
              ) : (
                <span className="text-xs font-medium text-warning flex items-center gap-1">
                  <AlertTriangle size={14} /> Not configured
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-primary" />
            <h2 className="font-display font-semibold text-lg text-ink">
              Dialog Voices
            </h2>
          </div>
          <p className="text-sm text-ink-faded">
            Preview each voice, then assign to speakers. Speaker 1 is the first
            person, Speaker 2 the second, etc. Saved to your browser.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-ink-faded uppercase tracking-wider">
              Preview (click to hear)
            </p>
            <div className="flex flex-wrap gap-2">
              {DIALOG_VOICE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    previewVoice(opt.key, () => setPreviewPlaying(true), () =>
                      setPreviewPlaying(false)
                    )
                  }
                  disabled={previewPlaying}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-page border border-rule hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Volume2 size={16} className="text-primary shrink-0" />
                  <span className="text-sm text-ink">{opt.label}</span>
                </button>
              ))}
            </div>
            {previewPlaying && (
              <p className="text-xs text-ink-faded">Playing...</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-ink-faded uppercase tracking-wider">
              Assign to speakers
            </p>
            <div className="space-y-3">
            {Array.from({ length: MAX_SPEAKER_SLOTS }, (_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-page"
              >
                <span className="text-sm font-medium text-ink shrink-0">
                  Speaker {i + 1}
                </span>
                <select
                  value={dialogVoices[i] ?? "default"}
                  onChange={(e) =>
                    handleDialogVoiceChange(i, e.target.value)
                  }
                  className="flex-1 max-w-[200px] px-3 py-2 rounded-lg bg-surface border border-rule text-sm text-ink focus:border-primary focus:outline-none"
                >
                  {DIALOG_VOICE_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    previewVoice(
                      dialogVoices[i] ?? "default",
                      () => setPreviewPlaying(true),
                      () => setPreviewPlaying(false)
                    )
                  }
                  disabled={previewPlaying}
                  className="p-2 rounded-lg border border-rule hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Preview speaker voice"
                >
                  <Volume2 size={18} className="text-primary" />
                </button>
              </div>
            ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display font-semibold text-lg text-ink">How it works</h2>
          <div className="text-sm text-ink-faded space-y-2">
            <p>
              <strong className="text-ink">TTS (Hear words & dialogs):</strong>{" "}
              The app tries your browser&apos;s built-in speech synthesis first. If
              unavailable, it uses Microsoft Edge TTS via a server API route — no
              setup needed.
            </p>
            <p>
              <strong className="text-ink">
                STT (Speaking exercises):
              </strong>{" "}
              The app uses your browser&apos;s built-in speech recognition. For
              detailed pronunciation assessment with phoneme-level feedback,
              configure Azure Speech in the settings above.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
