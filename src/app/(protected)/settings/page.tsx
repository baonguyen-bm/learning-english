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
} from "lucide-react";
import {
  getGoogleSTTKey,
  setGoogleSTTKey,
  removeGoogleSTTKey,
} from "@/hooks/useSTT";

export default function SettingsPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "removed">(
    "idle"
  );
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);
  const [sttSupported, setSttSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const key = getGoogleSTTKey();
    setSavedKey(key);
    if (key) setApiKey(key);

    setTtsSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis.getVoices().length > 0 || true
        : false
    );
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
            className="p-2 -ml-2 rounded-lg hover:bg-page transition-colors"
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
