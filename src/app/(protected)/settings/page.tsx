"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  Key,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Mic,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import {
  getGoogleSTTKey,
  setGoogleSTTKey,
  removeGoogleSTTKey,
} from "@/hooks/useSTT";
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
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "removed">(
    "idle"
  );
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);
  const [sttSupported, setSttSupported] = useState<boolean | null>(null);
  const [dialogVoices, setDialogVoicesState] = useState<string[]>([]);

  useEffect(() => {
    const key = getGoogleSTTKey();
    setSavedKey(key);
    if (key) setApiKey(key);

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

  const handleSave = () => {
    if (!apiKey.trim()) return;
    setGoogleSTTKey(apiKey.trim());
    setSavedKey(apiKey.trim());
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 3000);
  };

  const handleRemove = () => {
    removeGoogleSTTKey();
    setApiKey("");
    setSavedKey(null);
    setSaveStatus("removed");
    setTimeout(() => setSaveStatus("idle"), 3000);
  };

  const handleDialogVoiceChange = (speakerIndex: number, voiceKey: string) => {
    const next = [...getDialogVoices()];
    while (next.length <= speakerIndex) next.push("default");
    next[speakerIndex] = voiceKey;
    setDialogVoices(next);
    setDialogVoicesState(getDialogVoices());
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
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
            Your browser&apos;s built-in speech capabilities. If unavailable, the
            app uses cloud-based alternatives automatically.
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
              ) : savedKey ? (
                <span className="text-xs font-medium text-primary flex items-center gap-1">
                  <CheckCircle2 size={14} /> Google Cloud
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

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Key size={20} className="text-primary" />
            <h2 className="font-display font-semibold text-lg text-ink">
              Google Cloud Speech-to-Text
            </h2>
          </div>

          <div className="text-sm text-ink-faded space-y-2">
            <p>
              Required only if your browser doesn&apos;t support speech
              recognition natively. The API key is stored locally in your
              browser and never sent to our server.
            </p>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Get a Google Cloud API key
              <ExternalLink size={14} />
            </a>
          </div>

          {savedKey && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
              <div>
                <p className="text-sm font-medium text-success">Key saved</p>
                <p className="text-xs text-ink-faded font-mono mt-0.5">
                  {maskKey(savedKey)}
                </p>
              </div>
              <button
                onClick={handleRemove}
                className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors"
                title="Remove API key"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setApiKey(e.target.value)
              }
              placeholder="Paste your Google Cloud API key..."
              className="flex-1 font-mono text-sm"
            />
            <Button onClick={handleSave} disabled={!apiKey.trim()}>
              Save
            </Button>
          </div>

          {saveStatus === "saved" && (
            <p className="text-sm text-success flex items-center gap-1 animate-fade-in">
              <CheckCircle2 size={14} /> API key saved to browser storage
            </p>
          )}
          {saveStatus === "removed" && (
            <p className="text-sm text-ink-faded flex items-center gap-1 animate-fade-in">
              <Trash2 size={14} /> API key removed
            </p>
          )}
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
              The app tries your browser&apos;s built-in speech recognition first.
              If unavailable, it records audio from your microphone and sends it
              to Google Cloud Speech-to-Text using your API key. The audio and key
              go directly from your browser to Google — never through our server.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
