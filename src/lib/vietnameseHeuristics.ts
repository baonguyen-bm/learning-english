import { lcsAlignment, levenshteinDistance } from "./scoring";

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
  if (target.includes("z") && spoken.includes("s")) {
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

  // Heuristic: v → b
  if (target.startsWith("v") && spoken.startsWith("b")) {
    const vb = VIETNAMESE_PHONEME_ERRORS.find(
      (e) => e.errorPattern === "v_to_b_or_v"
    );
    if (vb && !tips.includes(vb)) tips.push(vb);
  }

  return tips;
}

/**
 * Analyze transcript vs target using confidence scores and heuristics.
 * Uses lcsAlignment from scoring.ts for accurate word matching.
 * This is the zero-cost fallback when Azure is not configured.
 */
export function analyzeWithHeuristics(
  transcript: string,
  targetSentence: string,
  confidence: number | null
): WordAnalysis[] {
  const normalize = (s: string): string[] =>
    s.trim().toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);

  const spokenWords = normalize(transcript);
  const targetWords = normalize(targetSentence);

  const alignment: Map<number, number> = lcsAlignment(spokenWords, targetWords);

  return targetWords.map((target, j) => {
    if (!alignment.has(j)) {
      return {
        word: target,
        status: "error" as const,
        score: 0,
        tips: VIETNAMESE_PHONEME_ERRORS.filter(
          (e) => e.errorPattern === "final_consonant_drop"
        ),
      };
    }

    const spokenIdx = alignment.get(j)!;
    const spoken = spokenWords[spokenIdx];
    const dist = levenshteinDistance(spoken, target);

    if (dist === 0) {
      const isSuspect = confidence !== null && confidence < 0.7;
      return {
        word: target,
        status: isSuspect ? ("suspect" as const) : ("correct" as const),
        score: isSuspect ? 70 : 100,
        tips: isSuspect ? findVietnameseErrors(spoken, target) : [],
      };
    }

    const tips = findVietnameseErrors(spoken, target);
    const score = dist === 1 ? 50 : dist === 2 ? 25 : 0;
    return {
      word: target,
      status: "error" as const,
      score,
      tips,
    };
  });
}
