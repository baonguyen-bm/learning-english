"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import type { WordPronunciationResult, PhonemeResult } from "@/types/pronunciation";
import { findVietnameseErrors } from "@/lib/vietnameseHeuristics";

/**
 * Azure SAPI phoneme → IPA + Vietnamese pronunciation guide.
 * Only includes phonemes that Vietnamese speakers commonly struggle with.
 */
const PHONEME_GUIDE: Record<string, { ipa: string; descVi: string }> = {
  // Consonants
  th: { ipa: "θ", descVi: "Đặt đầu lưỡi giữa hai hàm răng, thổi hơi nhẹ (\"th\" trong \"think\")" },
  dh: { ipa: "ð", descVi: "Đặt đầu lưỡi giữa hai hàm răng + rung thanh (\"th\" trong \"this\")" },
  r: { ipa: "ɹ", descVi: "Cuộn lưỡi ra sau, KHÔNG chạm vòm miệng. Khác \"r\" tiếng Việt" },
  l: { ipa: "l", descVi: "Đầu lưỡi chạm chân răng cửa trên, hơi thoát hai bên lưỡi" },
  z: { ipa: "z", descVi: "Giống \"s\" nhưng RUNG dây thanh. Đặt tay lên cổ cảm nhận rung" },
  zh: { ipa: "ʒ", descVi: "Giống \"sh\" nhưng rung thanh (âm giữa \"measure\")" },
  sh: { ipa: "ʃ", descVi: "Tròn môi nhẹ, đẩy hơi qua khe lưỡi-vòm miệng. Rộng hơn \"s\"" },
  jh: { ipa: "dʒ", descVi: "Đầu lưỡi chạm vòm rồi buông + rung thanh (\"j\" trong \"job\")" },
  ch: { ipa: "tʃ", descVi: "Đầu lưỡi chạm vòm rồi buông, KHÔNG rung thanh (\"ch\" trong \"church\")" },
  v: { ipa: "v", descVi: "Răng cửa trên chạm môi dưới + thổi hơi. Không phải \"b\"" },
  f: { ipa: "f", descVi: "Răng cửa trên chạm môi dưới + thổi hơi, KHÔNG rung thanh" },
  w: { ipa: "w", descVi: "Tròn môi rồi mở ra nhanh. Giống bắt đầu nói \"u\" rồi chuyển sang nguyên âm" },
  ng: { ipa: "ŋ", descVi: "Cuối lưỡi chạm vòm mềm (\"ng\" trong \"sing\"). Không phải \"n\" + \"g\"" },
  b: { ipa: "b", descVi: "Hai môi khép rồi bật ra + rung thanh" },
  p: { ipa: "p", descVi: "Hai môi khép rồi bật ra, KHÔNG rung thanh, có hơi bật mạnh" },
  d: { ipa: "d", descVi: "Đầu lưỡi chạm chân răng cửa trên rồi bật + rung thanh" },
  t: { ipa: "t", descVi: "Đầu lưỡi chạm chân răng cửa trên rồi bật, KHÔNG rung, hơi bật mạnh" },
  g: { ipa: "ɡ", descVi: "Cuối lưỡi chạm vòm mềm rồi bật + rung thanh" },
  k: { ipa: "k", descVi: "Cuối lưỡi chạm vòm mềm rồi bật, KHÔNG rung, hơi bật mạnh" },
  s: { ipa: "s", descVi: "Đầu lưỡi gần chân răng cửa, thổi hơi qua khe hẹp" },
  n: { ipa: "n", descVi: "Đầu lưỡi chạm chân răng cửa trên, hơi thoát qua mũi" },
  m: { ipa: "m", descVi: "Hai môi khép, hơi thoát qua mũi" },
  hh: { ipa: "h", descVi: "Thổi hơi nhẹ từ họng, miệng mở theo nguyên âm sau" },
  y: { ipa: "j", descVi: "Giống âm \"i\" ngắn chuyển nhanh sang nguyên âm sau (\"y\" trong \"yes\")" },
  // Vowels
  iy: { ipa: "iː", descVi: "\"I\" dài — miệng hẹp, lưỡi cao. Kéo dài hơn /ɪ/" },
  ih: { ipa: "ɪ", descVi: "\"I\" ngắn — miệng hơi mở hơn /iː/, ngắn gọn (\"sit\" ≠ \"seat\")" },
  ey: { ipa: "eɪ", descVi: "Bắt đầu từ \"ê\" rồi lướt sang \"i\" (\"day\", \"make\")" },
  eh: { ipa: "ɛ", descVi: "\"E\" mở — miệng mở rộng hơn \"ê\" tiếng Việt (\"bed\", \"said\")" },
  ae: { ipa: "æ", descVi: "Mở miệng rộng + kéo sang hai bên. Rộng hơn \"e\" (\"cat\", \"bad\")" },
  aa: { ipa: "ɑː", descVi: "\"A\" mở rộng, miệng mở tối đa, lưỡi thấp (\"father\", \"hot\")" },
  ao: { ipa: "ɔː", descVi: "\"O\" tròn dài — tròn môi, lưỡi thấp-giữa (\"law\", \"caught\")" },
  ow: { ipa: "oʊ", descVi: "Bắt đầu từ \"ô\" rồi lướt sang \"u\" (\"go\", \"home\")" },
  uh: { ipa: "ʊ", descVi: "\"U\" ngắn — môi hơi tròn, lưỡi cao-sau (\"book\", \"put\")" },
  uw: { ipa: "uː", descVi: "\"U\" dài — môi tròn chặt, lưỡi rất cao (\"food\", \"blue\")" },
  ah: { ipa: "ʌ", descVi: "Giống \"ơ\" ngắn — miệng hơi mở, lưỡi giữa (\"cup\", \"but\")" },
  ax: { ipa: "ə", descVi: "Âm schwa — rất ngắn, nhẹ, không nhấn. Đọc lướt qua, đừng nhấn mạnh" },
  er: { ipa: "ɝ", descVi: "\"Ơ\" + cuộn lưỡi ra sau (\"bird\", \"her\"). Người Việt hay bỏ cuộn lưỡi" },
  ay: { ipa: "aɪ", descVi: "Bắt đầu từ \"a\" rồi lướt sang \"i\" (\"my\", \"like\")" },
  aw: { ipa: "aʊ", descVi: "Bắt đầu từ \"a\" rồi lướt sang \"u\" (\"how\", \"out\")" },
  oy: { ipa: "ɔɪ", descVi: "Bắt đầu từ \"o\" rồi lướt sang \"i\" (\"boy\", \"join\")" },
};

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
  const hasPhonemes = word.phonemes && word.phonemes.length > 0;
  const badPhonemes = hasPhonemes
    ? word.phonemes!.filter((p) => p.accuracyScore < 70)
    : [];
  const heuristicTips = !hasPhonemes
    ? findVietnameseErrors(word.word, targetWord)
    : [];

  return (
    <div className="p-4 rounded-lg bg-surface border border-rule space-y-3 animate-slide-up">
      {/* Header */}
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

      {/* Phoneme map — show all phonemes with bad ones highlighted */}
      {hasPhonemes && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-faded uppercase tracking-wider">
            Phân tích từng âm
          </p>
          <div className="flex flex-wrap gap-1">
            {word.phonemes!.map((p, i) => (
              <PhonemeChip key={i} phoneme={p} />
            ))}
          </div>
        </div>
      )}

      {/* Specific phoneme errors with Vietnamese guidance */}
      {badPhonemes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-error uppercase tracking-wider">
            Âm cần cải thiện
          </p>
          {badPhonemes.map((p, i) => {
            const guide = PHONEME_GUIDE[p.phoneme.toLowerCase()];
            if (!guide) return null;
            return (
              <div
                key={i}
                className="p-3 rounded-lg bg-error/5 border border-error/10 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-error">
                    {p.phoneme}
                  </span>
                  <span className="text-xs text-ink-faded">
                    /{guide.ipa}/ — {p.accuracyScore}/100
                  </span>
                </div>
                <p className="text-sm text-ink-faded">{guide.descVi}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Good phonemes summary */}
      {hasPhonemes && badPhonemes.length === 0 && word.accuracyScore < 80 && (
        <p className="text-sm text-ink-faded">
          Từng âm riêng lẻ khá ổn, hãy chú ý nối âm tự nhiên và nhịp điệu khi nói cả từ.
        </p>
      )}

      {/* Heuristic fallback (no Azure phonemes) */}
      {heuristicTips.map((tip, i) => (
        <div key={i} className="text-sm text-ink-faded space-y-1">
          <p className="font-medium text-ink">
            {tip.ipaTarget} → {tip.ipaActual}
          </p>
          <p>{tip.tipVi}</p>
        </div>
      ))}
    </div>
  );
}

function PhonemeChip({ phoneme }: { phoneme: PhonemeResult }) {
  const guide = PHONEME_GUIDE[phoneme.phoneme.toLowerCase()];
  const isBad = phoneme.accuracyScore < 70;

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-mono inline-flex items-center gap-1",
        phoneme.accuracyScore >= 80
          ? "bg-success/10 text-success"
          : phoneme.accuracyScore >= 50
            ? "bg-warning/10 text-warning"
            : "bg-error/10 text-error"
      )}
      title={guide ? `/${guide.ipa}/ — ${guide.descVi}` : phoneme.phoneme}
    >
      {phoneme.phoneme}
      {isBad && <span className="text-[9px] opacity-70">{phoneme.accuracyScore}</span>}
    </span>
  );
}
