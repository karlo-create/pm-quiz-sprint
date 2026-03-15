import CryptoJS from "crypto-js";

/** Generates a fingerprint hash from normalized question text for deduplication. */
export function generateFingerprint(questionText: string): string {
  const normalized = questionText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return CryptoJS.SHA256(normalized).toString().slice(0, 16);
}

/** Format a percentage for display. */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Returns the answer letter index (A=0, B=1, C=2, D=3). */
export function optionIndex(option: "A" | "B" | "C" | "D"): number {
  return { A: 0, B: 1, C: 2, D: 3 }[option];
}

/** Returns the answer letter from index. */
export function indexToOption(index: number): "A" | "B" | "C" | "D" {
  return (["A", "B", "C", "D"] as const)[index];
}
