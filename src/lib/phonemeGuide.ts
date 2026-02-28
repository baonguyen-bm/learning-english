import type { PhonemeResult } from "@/types/pronunciation";

/**
 * Azure SAPI phoneme → IPA + Vietnamese pronunciation guide.
 * Shared across WordHighlight and WordDrill components.
 */
export const PHONEME_GUIDE: Record<string, { ipa: string; descVi: string }> = {
  th: { ipa: "θ", descVi: 'Đặt đầu lưỡi giữa hai hàm răng, thổi hơi nhẹ ("th" trong "think")' },
  dh: { ipa: "ð", descVi: 'Đặt đầu lưỡi giữa hai hàm răng + rung thanh ("th" trong "this")' },
  r: { ipa: "ɹ", descVi: "Cuộn lưỡi ra sau, KHÔNG chạm vòm miệng. Khác \"r\" tiếng Việt" },
  l: { ipa: "l", descVi: "Đầu lưỡi chạm chân răng cửa trên, hơi thoát hai bên lưỡi" },
  z: { ipa: "z", descVi: 'Giống "s" nhưng RUNG dây thanh. Đặt tay lên cổ cảm nhận rung' },
  zh: { ipa: "ʒ", descVi: 'Giống "sh" nhưng rung thanh (âm giữa "measure")' },
  sh: { ipa: "ʃ", descVi: 'Tròn môi nhẹ, đẩy hơi qua khe lưỡi-vòm miệng. Rộng hơn "s"' },
  jh: { ipa: "dʒ", descVi: 'Đầu lưỡi chạm vòm rồi buông + rung thanh ("j" trong "job")' },
  ch: { ipa: "tʃ", descVi: 'Đầu lưỡi chạm vòm rồi buông, KHÔNG rung thanh ("ch" trong "church")' },
  v: { ipa: "v", descVi: 'Răng cửa trên chạm môi dưới + thổi hơi. Không phải "b"' },
  f: { ipa: "f", descVi: "Răng cửa trên chạm môi dưới + thổi hơi, KHÔNG rung thanh" },
  w: { ipa: "w", descVi: 'Tròn môi rồi mở ra nhanh. Giống bắt đầu nói "u" rồi chuyển sang nguyên âm' },
  ng: { ipa: "ŋ", descVi: 'Cuối lưỡi chạm vòm mềm ("ng" trong "sing"). Không phải "n" + "g"' },
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
  y: { ipa: "j", descVi: 'Giống âm "i" ngắn chuyển nhanh sang nguyên âm sau ("y" trong "yes")' },
  iy: { ipa: "iː", descVi: '"I" dài — miệng hẹp, lưỡi cao. Kéo dài hơn /ɪ/' },
  ih: { ipa: "ɪ", descVi: '"I" ngắn — miệng hơi mở hơn /iː/, ngắn gọn ("sit" ≠ "seat")' },
  ey: { ipa: "eɪ", descVi: 'Bắt đầu từ "ê" rồi lướt sang "i" ("day", "make")' },
  eh: { ipa: "ɛ", descVi: '"E" mở — miệng mở rộng hơn "ê" tiếng Việt ("bed", "said")' },
  ae: { ipa: "æ", descVi: 'Mở miệng rộng + kéo sang hai bên. Rộng hơn "e" ("cat", "bad")' },
  aa: { ipa: "ɑː", descVi: '"A" mở rộng, miệng mở tối đa, lưỡi thấp ("father", "hot")' },
  ao: { ipa: "ɔː", descVi: '"O" tròn dài — tròn môi, lưỡi thấp-giữa ("law", "caught")' },
  ow: { ipa: "oʊ", descVi: 'Bắt đầu từ "ô" rồi lướt sang "u" ("go", "home")' },
  uh: { ipa: "ʊ", descVi: '"U" ngắn — môi hơi tròn, lưỡi cao-sau ("book", "put")' },
  uw: { ipa: "uː", descVi: '"U" dài — môi tròn chặt, lưỡi rất cao ("food", "blue")' },
  ah: { ipa: "ʌ", descVi: 'Giống "ơ" ngắn — miệng hơi mở, lưỡi giữa ("cup", "but")' },
  ax: { ipa: "ə", descVi: "Âm schwa — rất ngắn, nhẹ, không nhấn. Đọc lướt qua, đừng nhấn mạnh" },
  er: { ipa: "ɝ", descVi: '"Ơ" + cuộn lưỡi ra sau ("bird", "her"). Người Việt hay bỏ cuộn lưỡi' },
  ay: { ipa: "aɪ", descVi: 'Bắt đầu từ "a" rồi lướt sang "i" ("my", "like")' },
  aw: { ipa: "aʊ", descVi: 'Bắt đầu từ "a" rồi lướt sang "u" ("how", "out")' },
  oy: { ipa: "ɔɪ", descVi: 'Bắt đầu từ "o" rồi lướt sang "i" ("boy", "join")' },
};

/**
 * Get phonemes with score below threshold from a PhonemeResult array.
 */
export function getBadPhonemes(
  phonemes: PhonemeResult[] | undefined,
  threshold = 70
): PhonemeResult[] {
  return phonemes?.filter((p) => p.accuracyScore < threshold) ?? [];
}
