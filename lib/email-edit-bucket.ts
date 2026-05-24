import type { EmailEditBucket } from "@/lib/types";

const MINOR_MAX_RATIO = 0.15;
const MODERATE_MAX_RATIO = 0.6;

export type EmailEditClassification = {
  bucket: EmailEditBucket;
  changeRatio: number;
  changedWordCount: number;
  totalWordCount: number;
};

export const emailEditBucketLabels: Record<EmailEditBucket, string> = {
  unchanged: "Sent unchanged",
  minor: "Minor edits",
  moderate: "Moderate edits",
  major: "Major rewrite",
  no_ai_draft: "No AI draft to compare"
};

export function classifyEmailEdit(aiDraft: string, sentDraft: string): EmailEditClassification {
  const aiWords = toWords(aiDraft);
  const sentWords = toWords(sentDraft);

  if (aiWords.length === 0) {
    return { bucket: "no_ai_draft", changeRatio: 0, changedWordCount: 0, totalWordCount: sentWords.length };
  }

  const totalWordCount = Math.max(aiWords.length, sentWords.length);
  const changedWordCount = wordEditDistance(aiWords, sentWords);
  const changeRatio = roundRatio(changedWordCount / totalWordCount);

  return { bucket: bucketForRatio(changeRatio), changeRatio, changedWordCount, totalWordCount };
}

function bucketForRatio(ratio: number): EmailEditBucket {
  if (ratio === 0) return "unchanged";
  if (ratio <= MINOR_MAX_RATIO) return "minor";
  if (ratio <= MODERATE_MAX_RATIO) return "moderate";
  return "major";
}

function toWords(text: string): string[] {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized.length === 0 ? [] : normalized.split(" ");
}

function wordEditDistance(a: string[], b: string[]): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row++) distances[row][0] = row;
  for (let col = 0; col < cols; col++) distances[0][col] = col;

  for (let row = 1; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const substitutionCost = a[row - 1] === b[col - 1] ? 0 : 1;
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + substitutionCost
      );
    }
  }

  return distances[rows - 1][cols - 1];
}

function roundRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}
