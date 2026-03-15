import type { QuestionProgress } from "@/types";
import { addDays } from "date-fns";

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

// Quality grades mapped from quiz performance
// 0 = wrong, 3 = correct but slow/uncertain, 5 = correct and confident
function qualityFromAnswer(isCorrect: boolean, timeSpentMs: number): number {
  if (!isCorrect) return 1;
  if (timeSpentMs > 30000) return 3; // slow but correct
  if (timeSpentMs > 15000) return 4; // moderate
  return 5; // quick and correct
}

/**
 * Updates a QuestionProgress record after an answer using a SM-2 variant.
 * Returns the updated progress (does not persist — caller handles Firestore).
 */
export function updateProgress(
  progress: QuestionProgress,
  isCorrect: boolean,
  timeSpentMs: number
): QuestionProgress {
  const now = new Date().toISOString();
  const quality = qualityFromAnswer(isCorrect, timeSpentMs);

  const updated: QuestionProgress = {
    ...progress,
    timesSeen: progress.timesSeen + 1,
    timesCorrect: progress.timesCorrect + (isCorrect ? 1 : 0),
    timesWrong: progress.timesWrong + (isCorrect ? 0 : 1),
    streakCorrect: isCorrect ? progress.streakCorrect + 1 : 0,
    lastSeenAt: now,
  };

  // Update ease factor (SM-2 formula)
  updated.easeFactor = Math.max(
    MIN_EASE_FACTOR,
    progress.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Calculate next interval
  if (!isCorrect) {
    // Reset to short interval on wrong answer
    updated.interval = 1;
    updated.status = "needs-review";
  } else if (progress.interval === 0) {
    // First correct answer
    updated.interval = 1;
    updated.status = "learning";
  } else if (progress.interval === 1) {
    updated.interval = 3;
    updated.status = "learning";
  } else {
    updated.interval = Math.round(progress.interval * updated.easeFactor);
    updated.status = updated.streakCorrect >= 3 ? "solid" : "learning";
  }

  // Cap interval at 90 days
  updated.interval = Math.min(updated.interval, 90);

  // Set next eligible date
  updated.nextEligibleAt = addDays(new Date(), updated.interval).toISOString();

  return updated;
}

/** Creates a fresh progress record for a question the user has never seen. */
export function createFreshProgress(
  questionId: string,
  userId: string
): QuestionProgress {
  return {
    questionId,
    userId,
    timesSeen: 0,
    timesCorrect: 0,
    timesWrong: 0,
    streakCorrect: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    lastSeenAt: null,
    nextEligibleAt: null,
    status: "new",
  };
}
