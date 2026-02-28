# Pronunciation Assessment — Design & Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current "guess-based" speaking feedback with real pronunciation assessment that tells Vietnamese learners exactly which sounds they mispronounce and how to fix them — in Vietnamese.

**Architecture:** Two-tier pronunciation system. Primary: Azure Speech SDK Pronunciation Assessment (phoneme-level, word-level, prosody). Fallback: Browser Web Speech API with confidence scores + Vietnamese heuristic error database. User configures Azure key in Settings; without it, zero-cost fallback activates automatically. Google Cloud STT is removed entirely.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `microsoft-cognitiveservices-speech-sdk` (Azure), Browser Web Speech API, Tailwind CSS.

---

## Task 1: Remove Google Cloud STT

Remove all Google Cloud STT code since Azure Speech SDK replaces it for both STT and pronunciation assessment.

**Files:**
- Modify: `src/hooks/useSTT.ts`
- Modify: `src/app/(protected)/settings/page.tsx`

**Step 1: Simplify `useSTT.ts` to browser-only**

Remove all Google Cloud code. The hook becomes a thin wrapper around browser Web Speech API only.

```typescript
// src/hooks/useSTT.ts
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
```

Key changes vs current:
- Removed: `STTBackend` type, `google-cloud` backend, `getGoogleSTTKey`/`setGoogleSTTKey`/`removeGoogleSTTKey` exports, `MediaRecorder` code, `refreshBackend`
- Added: `confidence` state from `SpeechRecognitionResult.confidence`

**Step 2: Remove Google Cloud STT section from Settings page**

Remove the entire "Google Cloud Speech-to-Text" card and all related state/handlers (`apiKey`, `savedKey`, `saveStatus`, `handleSave`, `handleRemove`, `maskKey`). Also remove the Google STT import from useSTT. Keep the "Speech API Status" card but simplify STT status to just show browser support.

**Step 3: Commit**

```bash
git add src/hooks/useSTT.ts src/app/\(protected\)/settings/page.tsx
git commit -m "refactor: remove Google Cloud STT, simplify useSTT to browser-only"
```

---

## Task 2: Azure Speech Configuration

Add Azure Speech key + region config to Settings, stored in localStorage.

**Files:**
- Create: `src/lib/azureSpeechConfig.ts`
- Modify: `src/app/(protected)/settings/page.tsx`

**Step 1: Create Azure config helpers**

```typescript
// src/lib/azureSpeechConfig.ts
const AZURE_SPEECH_KEY = "azure_speech_key";
const AZURE_SPEECH_REGION = "azure_speech_region";

export interface AzureSpeechConfig {
  key: string;
  region: string;
}

export function getAzureSpeechConfig(): AzureSpeechConfig | null {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem(AZURE_SPEECH_KEY);
  const region = localStorage.getItem(AZURE_SPEECH_REGION);
  if (!key || !region) return null;
  return { key, region };
}

export function setAzureSpeechConfig(config: AzureSpeechConfig) {
  localStorage.setItem(AZURE_SPEECH_KEY, config.key);
  localStorage.setItem(AZURE_SPEECH_REGION, config.region);
}

export function removeAzureSpeechConfig() {
  localStorage.removeItem(AZURE_SPEECH_KEY);
  localStorage.removeItem(AZURE_SPEECH_REGION);
}
```

**Step 2: Add Azure config card to Settings page**

Add a new card to the Settings page (replacing the old Google Cloud card position) with:
- Azure Speech Key input (password field)
- Azure Region dropdown/input (e.g., "eastus", "southeastasia", "westeurope")
- Save/Remove buttons
- Status indicator showing if Azure is configured
- Help link to Azure portal
- Explanation that Azure enables detailed pronunciation feedback

**Step 3: Update Speech API Status card**

Update the STT status row to show three possible states:
- "Azure Speech" (green) — when Azure key is configured
- "Browser" (green) — when browser STT available but no Azure
- "Not configured" (warning) — when neither available

**Step 4: Commit**

```bash
git add src/lib/azureSpeechConfig.ts src/app/\(protected\)/settings/page.tsx
git commit -m "feat: add Azure Speech key configuration to Settings"
```

---

## Task 3: Vietnamese Pronunciation Heuristic Database

Build the database of common pronunciation errors for Vietnamese English learners, with tips in Vietnamese.

**Files:**
- Create: `src/lib/vietnameseHeuristics.ts`

**Step 1: Create the heuristic database**

```typescript
// src/lib/vietnameseHeuristics.ts

export interface PronunciationTip {
  errorPattern: string;
  ipaTarget: string;
  ipaActual: string;
  tipVi: string;
  examples: string[];
}

export interface WordAnalysis {
  word: string;
  status: "correct" | "error" | "suspect";
  score: number;
  tips: PronunciationTip[];
}

/**
 * Common phoneme errors for Vietnamese speakers learning English.
 * Each entry maps a "heard as" → "should be" pattern with Vietnamese guidance.
 */
export const VIETNAMESE_PHONEME_ERRORS: PronunciationTip[] = [
  // --- Consonants ---
  {
    errorPattern: "th_to_s",
    ipaTarget: "/θ/",
    ipaActual: "/s/",
    tipVi:
      "Âm \"th\" (như trong \"think\"): Đặt đầu lưỡi giữa hai hàm răng, thổi hơi nhẹ ra. Không phải âm \"s\" của tiếng Việt.",
    examples: ["think→sink", "three→sree", "thank→sank", "bath→bass", "math→mass"],
  },
  {
    errorPattern: "th_to_d",
    ipaTarget: "/ð/",
    ipaActual: "/d/",
    tipVi:
      "Âm \"th\" hữu thanh (như trong \"this\"): Đặt đầu lưỡi giữa hai hàm răng và rung dây thanh. Khác với \"d\" vì lưỡi phải ở giữa răng.",
    examples: ["this→dis", "that→dat", "the→de", "them→dem", "there→dere"],
  },
  {
    errorPattern: "r_confusion",
    ipaTarget: "/ɹ/",
    ipaActual: "/ɾ/ hoặc /z/",
    tipVi:
      "Âm \"r\" tiếng Anh: Cuộn đầu lưỡi ra sau, KHÔNG chạm vòm miệng. Khác hoàn toàn với \"r\" tiếng Việt (rung lưỡi). Hình dung như bạn đang sắp nói \"ư\" nhưng không tròn môi.",
    examples: ["right", "red", "run", "read", "really"],
  },
  {
    errorPattern: "l_r_confusion",
    ipaTarget: "/l/",
    ipaActual: "/ɹ/ hoặc ngược lại",
    tipVi:
      "Phân biệt L và R: Âm L — đầu lưỡi chạm chân răng cửa trên. Âm R — lưỡi cuộn ra sau, KHÔNG chạm đâu cả.",
    examples: ["light/right", "long/wrong", "alive/arrive"],
  },
  {
    errorPattern: "final_consonant_drop",
    ipaTarget: "phụ âm cuối",
    ipaActual: "(bị nuốt)",
    tipVi:
      "Phụ âm cuối từ: Tiếng Việt ít có phụ âm cuối nên người Việt hay nuốt mất. Hãy phát âm rõ ràng âm cuối — đặc biệt /t/, /d/, /k/, /g/, /s/, /z/. Ví dụ: \"cat\" phải nghe rõ âm \"t\" ở cuối.",
    examples: ["cat", "bad", "back", "dogs", "asked", "hands"],
  },
  {
    errorPattern: "consonant_cluster",
    ipaTarget: "nhóm phụ âm",
    ipaActual: "(bị đơn giản hoá)",
    tipVi:
      "Nhóm phụ âm liền nhau (str-, pl-, -nds, -sks): Không thêm nguyên âm xen giữa. \"Street\" là /striːt/, không phải \"sơ-tờ-rít\". Tập nói chậm từng âm rồi nối lại.",
    examples: ["street", "plan", "friends", "tasks", "splash"],
  },
  {
    errorPattern: "sh_to_s",
    ipaTarget: "/ʃ/",
    ipaActual: "/s/",
    tipVi:
      "Âm \"sh\" (như \"she\"): Tròn môi nhẹ và đẩy hơi ra qua khe giữa lưỡi và vòm miệng. Rộng hơn âm \"s\". Giống âm \"s\" nhưng lưỡi ở xa răng hơn.",
    examples: ["she→see", "ship→sip", "shop→sop", "should→sould"],
  },
  {
    errorPattern: "z_to_s",
    ipaTarget: "/z/",
    ipaActual: "/s/",
    tipVi:
      "Âm \"z\": Giống hệt vị trí miệng của \"s\" nhưng RUNG dây thanh (đặt tay lên cổ sẽ cảm thấy rung). \"Zoo\" ≠ \"Sue\".",
    examples: ["zoo→sue", "zero→sero", "easy→eassy", "is→iss"],
  },
  {
    errorPattern: "v_to_b_or_v",
    ipaTarget: "/v/",
    ipaActual: "/b/ hoặc /v/ Việt",
    tipVi:
      "Âm \"v\" tiếng Anh: Răng cửa trên chạm nhẹ môi dưới rồi thổi hơi qua. Người miền Bắc hay đọc thành \"b\", người miền Nam hay đọc đúng hơn.",
    examples: ["very→berry", "van→ban", "vine→bine"],
  },
  {
    errorPattern: "dj_to_z",
    ipaTarget: "/dʒ/",
    ipaActual: "/z/ hoặc /j/",
    tipVi:
      "Âm \"j\" (như \"job\"): Đầu lưỡi chạm vòm miệng rồi buông ra + rung thanh. Giống âm \"ch\" nhưng thêm rung. Không phải \"z\".",
    examples: ["job→zob", "just→zust", "judge→zudge"],
  },
  // --- Vowels ---
  {
    errorPattern: "short_long_vowel",
    ipaTarget: "/ɪ/ vs /iː/",
    ipaActual: "(lẫn lộn)",
    tipVi:
      "Nguyên âm ngắn vs dài: \"ship\" /ɪ/ (ngắn, miệng hơi mở) ≠ \"sheep\" /iː/ (dài, miệng hẹp). Người Việt hay đọc cùng một kiểu — hãy chú ý độ dài và độ mở miệng.",
    examples: ["ship/sheep", "sit/seat", "bit/beat", "fill/feel"],
  },
  {
    errorPattern: "ae_to_e",
    ipaTarget: "/æ/",
    ipaActual: "/e/",
    tipVi:
      "Âm /æ/ (như \"cat\"): Mở miệng rộng hơn âm \"e\", hạ hàm dưới xuống. \"Bad\" ≠ \"bed\". Hãy tưởng tượng bạn đang nói \"a\" nhưng kéo miệng rộng sang hai bên.",
    examples: ["bad→bed", "cat→ket", "man→men", "hat→het"],
  },
  {
    errorPattern: "schwa_stress",
    ipaTarget: "/ə/",
    ipaActual: "(đọc rõ ràng quá)",
    tipVi:
      "Âm schwa /ə/ (âm yếu): Trong tiếng Anh, âm tiết không nhấn thường đọc nhẹ thành /ə/. Ví dụ: \"banana\" → /bəˈnænə/. Đừng đọc rõ ràng từng âm tiết như tiếng Việt.",
    examples: ["banana", "about", "support", "today"],
  },
  // --- Prosody ---
  {
    errorPattern: "flat_intonation",
    ipaTarget: "ngữ điệu lên-xuống",
    ipaActual: "đều đều (flat)",
    tipVi:
      "Ngữ điệu: Tiếng Anh có nhịp lên-xuống rõ ràng. Câu hỏi Yes/No lên cuối, câu hỏi Wh- xuống cuối. Câu kể xuống cuối. Đừng đọc đều đều như tiếng Việt.",
    examples: [],
  },
  {
    errorPattern: "word_stress",
    ipaTarget: "trọng âm đúng",
    ipaActual: "trọng âm sai",
    tipVi:
      "Trọng âm từ: Mỗi từ tiếng Anh có một âm tiết được nhấn mạnh hơn. Ví dụ: \"beGIN\" (nhấn âm 2), không phải \"BEgin\". Sai trọng âm khiến người bản xứ rất khó hiểu.",
    examples: ["begin", "important", "computer", "development"],
  },
];

/**
 * Given a transcript word that differs from the target word,
 * find matching Vietnamese error patterns.
 */
export function findVietnameseErrors(
  spokenWord: string,
  targetWord: string
): PronunciationTip[] {
  const spoken = spokenWord.toLowerCase();
  const target = targetWord.toLowerCase();
  if (spoken === target) return [];

  const tips: PronunciationTip[] = [];

  for (const entry of VIETNAMESE_PHONEME_ERRORS) {
    for (const example of entry.examples) {
      const [from, to] = example.includes("→")
        ? example.split("→").map((s) => s.trim().toLowerCase())
        : [example.toLowerCase(), ""];

      if (!to) {
        if (target.toLowerCase() === from) {
          tips.push(entry);
          break;
        }
        continue;
      }

      if (target === from && spoken === to) {
        tips.push(entry);
        break;
      }
    }
  }

  // Heuristic: final consonant dropped
  if (
    target.length > spoken.length &&
    target.startsWith(spoken) &&
    target.length - spoken.length <= 2
  ) {
    const drop = VIETNAMESE_PHONEME_ERRORS.find(
      (e) => e.errorPattern === "final_consonant_drop"
    );
    if (drop && !tips.includes(drop)) tips.push(drop);
  }

  // Heuristic: th → s/t/d substitution
  if (target.includes("th") && !spoken.includes("th")) {
    const thVoiceless = VIETNAMESE_PHONEME_ERRORS.find(
      (e) => e.errorPattern === "th_to_s"
    );
    const thVoiced = VIETNAMESE_PHONEME_ERRORS.find(
      (e) => e.errorPattern === "th_to_d"
    );
    if (spoken.replace(/s/g, "th") === target && thVoiceless && !tips.includes(thVoiceless)) {
      tips.push(thVoiceless);
    } else if (spoken.replace(/d/g, "th") === target && thVoiced && !tips.includes(thVoiced)) {
      tips.push(thVoiced);
    }
  }

  // Heuristic: sh → s
  if (target.includes("sh") && spoken.includes("s") && !spoken.includes("sh")) {
    const sh = VIETNAMESE_PHONEME_ERRORS.find(
      (e) => e.errorPattern === "sh_to_s"
    );
    if (sh && !tips.includes(sh)) tips.push(sh);
  }

  // Heuristic: z → s
  if (target.includes("z") && spoken.replace(/z/g, "s") !== spoken) {
    const z = VIETNAMESE_PHONEME_ERRORS.find(
      (e) => e.errorPattern === "z_to_s"
    );
    if (
      z &&
      !tips.includes(z) &&
      spoken.replace(/s/g, "z") === target
    ) {
      tips.push(z);
    }
  }

  return tips;
}

/**
 * Analyze transcript vs target using confidence scores and heuristics.
 * This is the zero-cost fallback when Azure is not configured.
 */
export function analyzeWithHeuristics(
  transcript: string,
  targetSentence: string,
  confidence: number | null
): WordAnalysis[] {
  const spokenWords = transcript
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const targetWords = targetSentence
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  return targetWords.map((target, i) => {
    const spoken = spokenWords[i];

    if (!spoken) {
      return {
        word: target,
        status: "error" as const,
        score: 0,
        tips: [
          VIETNAMESE_PHONEME_ERRORS.find(
            (e) => e.errorPattern === "final_consonant_drop"
          )!,
        ].filter(Boolean),
      };
    }

    if (spoken === target) {
      const isSuspect = confidence !== null && confidence < 0.7;
      return {
        word: target,
        status: isSuspect ? ("suspect" as const) : ("correct" as const),
        score: isSuspect ? 70 : 100,
        tips: isSuspect
          ? findVietnameseErrors(spoken, target)
          : [],
      };
    }

    const tips = findVietnameseErrors(spoken, target);
    return {
      word: target,
      status: "error" as const,
      score: 0,
      tips,
    };
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/vietnameseHeuristics.ts
git commit -m "feat: add Vietnamese pronunciation heuristic database with tips"
```

---

## Task 4: Pronunciation Assessment Types

Define shared TypeScript types for pronunciation results used by both Azure and fallback modes.

**Files:**
- Create: `src/types/pronunciation.ts`

**Step 1: Create types**

```typescript
// src/types/pronunciation.ts

export interface PhonemeResult {
  phoneme: string;
  accuracyScore: number;
  /** IPA representation */
  ipa?: string;
}

export interface WordPronunciationResult {
  word: string;
  accuracyScore: number;
  errorType: "none" | "mispronunciation" | "omission" | "insertion";
  phonemes?: PhonemeResult[];
}

export interface PronunciationResult {
  transcript: string;
  /** 0-100 */
  accuracyScore: number;
  /** 0-100 */
  fluencyScore: number;
  /** 0-100 */
  completenessScore: number;
  /** 0-100, only from Azure */
  prosodyScore?: number;
  /** 0-100 overall */
  pronunciationScore: number;
  words: WordPronunciationResult[];
  /** Which engine produced this result */
  source: "azure" | "heuristic";
}
```

**Step 2: Commit**

```bash
git add src/types/pronunciation.ts
git commit -m "feat: add pronunciation assessment TypeScript types"
```

---

## Task 5: `usePronunciation` Hook — Azure Mode

Create the pronunciation assessment hook using Azure Speech SDK.

**Files:**
- Run: `npm install microsoft-cognitiveservices-speech-sdk`
- Create: `src/hooks/usePronunciation.ts`

**Step 1: Install Azure Speech SDK**

```bash
npm install microsoft-cognitiveservices-speech-sdk
```

**Step 2: Create `usePronunciation` hook**

```typescript
// src/hooks/usePronunciation.ts
"use client";

import { useState, useCallback, useRef } from "react";
import { getAzureSpeechConfig } from "@/lib/azureSpeechConfig";
import { analyzeWithHeuristics } from "@/lib/vietnameseHeuristics";
import type { PronunciationResult, WordPronunciationResult } from "@/types/pronunciation";

type AssessmentStatus = "idle" | "listening" | "processing" | "done" | "error";

export function usePronunciation() {
  const [status, setStatus] = useState<AssessmentStatus>("idle");
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<unknown>(null);
  const browserSttRef = useRef<SpeechRecognition | null>(null);

  const hasAzure = useCallback(() => !!getAzureSpeechConfig(), []);

  /**
   * Start pronunciation assessment.
   * Uses Azure if configured, otherwise falls back to browser STT + heuristics.
   */
  const assess = useCallback(async (referenceText: string) => {
    setError(null);
    setResult(null);

    const azureConfig = getAzureSpeechConfig();
    if (azureConfig) {
      await assessWithAzure(azureConfig, referenceText);
    } else {
      assessWithBrowser(referenceText);
    }
  }, []);

  async function assessWithAzure(
    config: { key: string; region: string },
    referenceText: string
  ) {
    try {
      const sdk = await import("microsoft-cognitiveservices-speech-sdk");

      const speechConfig = sdk.SpeechConfig.fromSubscription(
        config.key,
        config.region
      );
      speechConfig.speechRecognitionLanguage = "en-US";

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      const pronConfig = new sdk.PronunciationAssessmentConfig(
        referenceText,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true // enable miscue
      );
      pronConfig.enableProsodyAssessment = true;
      pronConfig.applyTo(recognizer);

      recognizerRef.current = recognizer;
      setStatus("listening");

      recognizer.recognized = (_s: unknown, e: { result: { text: string; reason: number } }) => {
        setStatus("processing");
        const speechResult = e.result;

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

        recognizer.close();
        recognizerRef.current = null;
      };

      recognizer.canceled = () => {
        setError(
          "Recognition canceled. Check your Azure key and region."
        );
        setStatus("error");
        recognizer.close();
        recognizerRef.current = null;
      };

      recognizer.startContinuousRecognitionAsync(
        () => {},
        (err: string) => {
          setError(err || "Failed to start Azure recognition.");
          setStatus("error");
        }
      );
    } catch (e) {
      setError(
        `Azure SDK error: ${e instanceof Error ? e.message : "Unknown error"}`
      );
      setStatus("error");
    }
  }

  function assessWithBrowser(referenceText: string) {
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

  const stop = useCallback(() => {
    if (recognizerRef.current) {
      const recognizer = recognizerRef.current as {
        stopContinuousRecognitionAsync: (
          cb?: () => void,
          err?: (e: string) => void
        ) => void;
      };
      recognizer.stopContinuousRecognitionAsync();
      recognizerRef.current = null;
    }
    if (browserSttRef.current) {
      browserSttRef.current.stop();
      browserSttRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return {
    assess,
    stop,
    reset,
    status,
    result,
    error,
    hasAzure,
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
```

**Step 3: Commit**

```bash
npm install microsoft-cognitiveservices-speech-sdk
git add src/hooks/usePronunciation.ts package.json package-lock.json
git commit -m "feat: add usePronunciation hook with Azure + heuristic fallback"
```

---

## Task 6: Pronunciation Feedback UI Components

Create reusable UI components for displaying pronunciation results.

**Files:**
- Create: `src/components/pronunciation/WordHighlight.tsx`
- Create: `src/components/pronunciation/PronunciationReport.tsx`

**Step 1: Create `WordHighlight` — inline colored words**

This component renders the target sentence with each word colored by accuracy:
- Green (>=80): correct
- Yellow (>=50): close/suspect
- Red (<50): error
- Gray strikethrough: omission

Tapping a word with an error shows its tips in Vietnamese.

```typescript
// src/components/pronunciation/WordHighlight.tsx
"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import type { WordPronunciationResult } from "@/types/pronunciation";
import { findVietnameseErrors, VIETNAMESE_PHONEME_ERRORS } from "@/lib/vietnameseHeuristics";

interface WordHighlightProps {
  words: WordPronunciationResult[];
  targetSentence: string;
}

export function WordHighlight({ words, targetSentence }: WordHighlightProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { speak } = useTTS();
  const targetWords = targetSentence
    .trim()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 p-4 rounded-lg bg-page border border-rule">
        {words.map((w, i) => {
          const colorClass =
            w.errorType === "omission"
              ? "text-ink-ghost line-through"
              : w.accuracyScore >= 80
                ? "text-success"
                : w.accuracyScore >= 50
                  ? "text-warning"
                  : "text-error";

          const isSelected = selectedIndex === i;
          const hasError = w.errorType !== "none" || w.accuracyScore < 80;

          return (
            <button
              key={i}
              onClick={() => hasError && setSelectedIndex(isSelected ? null : i)}
              className={cn(
                "px-1.5 py-0.5 rounded font-display text-lg transition-all",
                colorClass,
                hasError && "cursor-pointer hover:bg-ink/5 underline decoration-dotted",
                isSelected && "bg-ink/10 ring-1 ring-current",
                !hasError && "cursor-default"
              )}
            >
              {targetWords[i] || w.word}
            </button>
          );
        })}
      </div>

      {selectedIndex !== null && words[selectedIndex] && (
        <WordTipCard
          word={words[selectedIndex]}
          targetWord={targetWords[selectedIndex] || words[selectedIndex].word}
          onPlayAudio={() => speak(targetWords[selectedIndex] || words[selectedIndex].word, 0.7)}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
}

function WordTipCard({
  word,
  targetWord,
  onPlayAudio,
  onClose,
}: {
  word: WordPronunciationResult;
  targetWord: string;
  onPlayAudio: () => void;
  onClose: () => void;
}) {
  const tips = word.phonemes
    ? getPhonemeBasedTips(word)
    : findVietnameseErrors(word.word, targetWord);

  // If no specific tips found, show general advice
  const fallbackTip = tips.length === 0
    ? VIETNAMESE_PHONEME_ERRORS.find(
        (e) =>
          e.errorPattern === "final_consonant_drop" ||
          e.errorPattern === "word_stress"
      )
    : null;

  return (
    <div className="p-4 rounded-lg bg-surface border border-rule space-y-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-ink">
            &ldquo;{targetWord}&rdquo;
          </span>
          <button
            onClick={onPlayAudio}
            className="p-1.5 rounded-md hover:bg-page transition-colors"
          >
            <Volume2 size={16} className="text-primary" />
          </button>
          {word.accuracyScore < 100 && (
            <span className="text-xs font-medium text-ink-faded">
              {word.accuracyScore}/100
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-ink-faded hover:text-ink"
        >
          Đóng
        </button>
      </div>

      {word.errorType === "omission" && (
        <p className="text-sm text-error">
          Bạn đã bỏ qua từ này. Hãy thử nói lại và phát âm rõ từ
          &ldquo;{targetWord}&rdquo;.
        </p>
      )}

      {tips.map((tip, i) => (
        <div key={i} className="text-sm text-ink-faded space-y-1">
          <p className="font-medium text-ink">
            {tip.ipaTarget} → {tip.ipaActual}
          </p>
          <p>{tip.tipVi}</p>
        </div>
      ))}

      {fallbackTip && (
        <div className="text-sm text-ink-faded">
          <p>{fallbackTip.tipVi}</p>
        </div>
      )}

      {word.phonemes && word.phonemes.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {word.phonemes.map((p, i) => (
            <span
              key={i}
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-mono",
                p.accuracyScore >= 80
                  ? "bg-success/10 text-success"
                  : p.accuracyScore >= 50
                    ? "bg-warning/10 text-warning"
                    : "bg-error/10 text-error"
              )}
            >
              {p.phoneme}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getPhonemeBasedTips(word: WordPronunciationResult) {
  if (!word.phonemes) return [];
  const badPhonemes = word.phonemes.filter((p) => p.accuracyScore < 60);
  const tips = [];

  for (const p of badPhonemes) {
    const phoneme = p.phoneme.toLowerCase();
    // Map Azure phoneme names to our heuristic patterns
    const matching = VIETNAMESE_PHONEME_ERRORS.find((entry) => {
      const target = entry.ipaTarget.toLowerCase();
      return target.includes(phoneme) || phoneme.includes(target.replace(/\//g, ""));
    });
    if (matching) tips.push(matching);
  }

  return tips;
}
```

**Step 2: Create `PronunciationReport` — expandable detail card**

```typescript
// src/components/pronunciation/PronunciationReport.tsx
"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Zap, Target, AudioLines, CheckCircle2 } from "lucide-react";
import type { PronunciationResult } from "@/types/pronunciation";

interface PronunciationReportProps {
  result: PronunciationResult;
}

export function PronunciationReport({ result }: PronunciationReportProps) {
  const [expanded, setExpanded] = useState(false);

  const scores = [
    {
      label: "Độ chính xác",
      value: result.accuracyScore,
      icon: Target,
      description: "Phát âm từng âm có đúng không",
    },
    {
      label: "Độ trôi chảy",
      value: result.fluencyScore,
      icon: AudioLines,
      description: "Nói có tự nhiên, liền mạch không",
    },
    {
      label: "Độ đầy đủ",
      value: result.completenessScore,
      icon: CheckCircle2,
      description: "Có nói đủ các từ trong câu không",
    },
    ...(result.prosodyScore !== undefined
      ? [
          {
            label: "Ngữ điệu",
            value: result.prosodyScore,
            icon: Zap,
            description: "Nhịp điệu, trọng âm, lên xuống giọng",
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-lg border border-rule overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-surface hover:bg-page transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">
            Chi tiết phát âm
          </span>
          {result.source === "azure" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Azure
            </span>
          )}
          {result.source === "heuristic" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink/10 text-ink-faded font-medium">
              Ước lượng
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-ink-faded" />
        ) : (
          <ChevronDown size={16} className="text-ink-faded" />
        )}
      </button>

      {expanded && (
        <div className="p-4 border-t border-rule space-y-4 animate-slide-up">
          <div className="grid grid-cols-2 gap-3">
            {scores.map((s) => (
              <div key={s.label} className="p-3 rounded-lg bg-page space-y-1">
                <div className="flex items-center gap-1.5">
                  <s.icon size={14} className="text-ink-faded" />
                  <span className="text-xs font-medium text-ink-faded">
                    {s.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "font-display text-2xl tabular-nums",
                      s.value >= 80
                        ? "text-success"
                        : s.value >= 50
                          ? "text-warning"
                          : "text-error"
                    )}
                  >
                    {s.value}
                  </span>
                  <span className="text-xs text-ink-ghost">/100</span>
                </div>
                <p className="text-[11px] text-ink-ghost">{s.description}</p>
              </div>
            ))}
          </div>

          {result.source === "heuristic" && (
            <p className="text-xs text-ink-ghost text-center">
              💡 Cấu hình Azure Speech trong Cài đặt để nhận phân tích chi tiết từng âm vị.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/pronunciation/
git commit -m "feat: add WordHighlight and PronunciationReport UI components"
```

---

## Task 7: Refactor `Speaking.tsx`

Replace the current simple Speaking component with the new pronunciation assessment flow.

**Files:**
- Modify: `src/components/modules/Speaking.tsx`

**Step 1: Rewrite Speaking component**

Key changes:
- Use `usePronunciation` hook instead of `useSTT`
- Show `WordHighlight` for inline feedback after assessment
- Show `PronunciationReport` for detailed scores
- Keep existing TTS listen-first flow
- Use `result.pronunciationScore` as the score passed to `onComplete`

```typescript
// src/components/modules/Speaking.tsx
"use client";

import React, { useState } from "react";
import { usePronunciation } from "@/hooks/usePronunciation";
import { useTTS } from "@/hooks/useTTS";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WordHighlight } from "@/components/pronunciation/WordHighlight";
import { PronunciationReport } from "@/components/pronunciation/PronunciationReport";
import { cn } from "@/lib/utils";
import {
  Mic,
  Square,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  SkipForward,
  Settings,
  Volume2,
} from "lucide-react";

interface SpeakingProps {
  targetSentence: string;
  onComplete: (score: number) => void;
}

export function Speaking({ targetSentence, onComplete }: SpeakingProps) {
  const { assess, stop, reset, status, result, error } = usePronunciation();
  const { speak, cancel, isSpeaking } = useTTS();
  const [submitted, setSubmitted] = useState(false);

  const isListening = status === "listening";
  const isProcessing = status === "processing";
  const supported =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const hasAnySupport = supported; // Azure also needs mic, checked at runtime

  const handleListen = () => {
    if (isSpeaking) cancel();
    else speak(targetSentence, 0.85);
  };

  const handleToggle = () => {
    if (isListening) {
      stop();
    } else {
      assess(targetSentence);
    }
  };

  const handleSubmit = () => {
    if (isListening) stop();
    setSubmitted(true);
  };

  const handleRetry = () => {
    reset();
    setSubmitted(false);
    assess(targetSentence);
  };

  if (!hasAnySupport) {
    return (
      <Card className="space-y-4 animate-scale-in">
        <p className="font-display font-semibold text-xl md:text-2xl text-ink text-center py-4 leading-relaxed">
          &ldquo;{targetSentence}&rdquo;
        </p>
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={handleListen}>
            <Volume2
              size={16}
              className={isSpeaking ? "animate-pulse" : ""}
            />
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
              Your browser doesn&apos;t support speech recognition. Configure
              Azure Speech in{" "}
              <a
                href="/settings"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Settings <Settings size={12} />
              </a>{" "}
              to enable pronunciation assessment.
            </p>
          </div>
        </div>
        <Button onClick={() => onComplete(0)}>
          Skip <ArrowRight size={16} />
        </Button>
      </Card>
    );
  }

  const score = result?.pronunciationScore ?? 0;

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
          <Volume2
            size={16}
            className={isSpeaking ? "animate-pulse" : ""}
          />
          {isSpeaking ? "Playing..." : "Listen first"}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={submitted || isProcessing}
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
          {isListening
            ? "Đang nghe… nhấn để dừng"
            : isProcessing
              ? "Đang phân tích..."
              : "Nhấn để bắt đầu nói"}
        </p>
      </div>

      {error && (
        <p className="text-sm text-error text-center animate-fade-in">
          {error}
        </p>
      )}

      {!result && !submitted && !isListening && !isProcessing && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => onComplete(0)}>
            <SkipForward size={16} />
            Skip
          </Button>
        </div>
      )}

      {result && !submitted && (
        <div className="space-y-4 animate-slide-up">
          <WordHighlight
            words={result.words}
            targetSentence={targetSentence}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSubmit}>Nộp bài</Button>
            <Button variant="secondary" onClick={handleRetry}>
              <RotateCcw size={16} />
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {submitted && result && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-baseline gap-1 animate-score-pop">
            <span
              className={cn(
                "font-display text-4xl tabular-nums",
                score >= 80
                  ? "text-success"
                  : score >= 50
                    ? "text-warning"
                    : "text-error"
              )}
            >
              {score}
            </span>
            <span className="text-ink-ghost text-lg">/ 100</span>
          </div>

          <WordHighlight
            words={result.words}
            targetSentence={targetSentence}
          />

          <PronunciationReport result={result} />

          <Button onClick={() => onComplete(score)}>
            Tiếp <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}
```

**Step 2: Verify the import in `scoreSpeaking` is no longer needed**

Check if `scoreSpeaking` from `src/lib/scoring.ts` is imported elsewhere. If only used in Speaking.tsx, it can stay but is no longer called. No need to remove — YAGNI for cleanup.

**Step 3: Commit**

```bash
git add src/components/modules/Speaking.tsx
git commit -m "feat: refactor Speaking with pronunciation assessment UI"
```

---

## Task 8: Update Settings Page — Final Cleanup

Ensure settings page has the Azure config card, removed Google Cloud card, and updated status display.

**Files:**
- Modify: `src/app/(protected)/settings/page.tsx`

This was partially done in Task 1 and Task 2. This step is for final verification:

**Step 1: Verify settings page renders correctly**

- "Speech API Status" card shows Azure/Browser/Not configured for STT
- "Azure Speech" card with key + region inputs
- No Google Cloud card
- "How it works" card updated to mention Azure pronunciation assessment

**Step 2: Manually test Settings page**

Run: `npm run dev`
Navigate to `/settings` and verify:
- Azure key + region can be saved
- Status indicators update correctly
- No errors in console

**Step 3: Commit any remaining changes**

```bash
git add src/app/\(protected\)/settings/page.tsx
git commit -m "refactor: finalize Settings page with Azure config, remove Google Cloud"
```

---

## Task 9: End-to-End Manual Testing

**Step 1: Test zero-cost fallback mode (no Azure key)**

1. Go to Settings, ensure no Azure key is saved
2. Go to a Speaking exercise
3. Listen to target sentence
4. Record your speech
5. Verify:
   - Inline word highlights appear (green/yellow/red)
   - Tapping error words shows Vietnamese tips
   - "Ước lượng" badge appears in detail report
   - Score is calculated and saved

**Step 2: Test Azure mode (with Azure key)**

1. Go to Settings, enter Azure Speech key + region
2. Go to a Speaking exercise
3. Record your speech
4. Verify:
   - More detailed word highlights with phoneme badges
   - "Azure" badge in detail report
   - Prosody score appears in report
   - Vietnamese tips appear for error phonemes

**Step 3: Test edge cases**

- No speech detected → error message
- Very short speech (1 word) → partial completeness score
- Perfect pronunciation → all green, high score
- Switch between Azure and no-Azure modes

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete pronunciation assessment with Azure + Vietnamese heuristic fallback"
```
