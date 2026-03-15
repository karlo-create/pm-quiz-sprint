import type {
  Question,
  QuestionCategory,
  QuestionProgress,
  QuizMode,
  Difficulty,
} from "@/types";
import { differenceInHours } from "date-fns";

interface ScoredQuestion {
  question: Question;
  progress: QuestionProgress | null;
  score: number;
}

const MODE_SIZE: Record<QuizMode, number> = {
  "quick-5": 5,
  "standard-10": 10,
  "weak-spots": 10,
};

const CATEGORY_WEIGHTS_MAP: Record<QuestionCategory, number> = {
  "product-management": 0.6,
  "ai-pm": 0.2,
  "tech-basics": 0.15,
  "ux-ui": 0.05,
};

/**
 * Scores a question for selection priority.
 * Higher score = more likely to be selected.
 */
function scoreQuestion(
  question: Question,
  progress: QuestionProgress | null,
  mode: QuizMode
): number {
  let score = 0;
  const now = new Date();

  // ─── Never-seen bonus ─────────────────────────────────────────────
  if (!progress || progress.timesSeen === 0) {
    score += 50;
    return score; // New questions always get priority baseline
  }

  // ─── Spaced repetition eligibility ────────────────────────────────
  if (progress.nextEligibleAt) {
    const eligible = new Date(progress.nextEligibleAt);
    if (eligible > now) {
      // Not yet eligible — heavy penalty proportional to time remaining
      const hoursUntilEligible = differenceInHours(eligible, now);
      score -= Math.min(200, hoursUntilEligible * 2);
    } else {
      // Overdue — bonus for overdue items
      const hoursOverdue = differenceInHours(now, eligible);
      score += Math.min(40, hoursOverdue * 0.5);
    }
  }

  // ─── Error rate boost ─────────────────────────────────────────────
  if (progress.timesSeen > 0) {
    const errorRate = progress.timesWrong / progress.timesSeen;
    score += errorRate * 60; // Max +60 for 100% error rate
  }

  // ─── Weak spots mode: heavily boost wrong answers ─────────────────
  if (mode === "weak-spots") {
    if (progress.status === "needs-review") score += 80;
    if (progress.timesWrong > progress.timesCorrect) score += 40;
  }

  // ─── Low-exposure boost ───────────────────────────────────────────
  if (progress.timesSeen <= 2) {
    score += 20;
  }

  // ─── Recency penalty ─────────────────────────────────────────────
  if (progress.lastSeenAt) {
    const hoursSince = differenceInHours(now, new Date(progress.lastSeenAt));
    if (hoursSince < 4) score -= 100; // Seen very recently
    else if (hoursSince < 24) score -= 30;
    else if (hoursSince < 72) score -= 10;
  }

  // ─── Streak penalty (avoid over-drilling mastered questions) ──────
  if (progress.streakCorrect >= 3) score -= 20;
  if (progress.streakCorrect >= 5) score -= 30;

  return score;
}

/**
 * Selects questions for a quiz session.
 * Returns question IDs in the order they should be presented.
 */
export function selectQuestions(
  allQuestions: Question[],
  progressMap: Map<string, QuestionProgress>,
  mode: QuizMode
): string[] {
  const targetSize = MODE_SIZE[mode];

  // Score all questions
  const scored: ScoredQuestion[] = allQuestions
    .filter((q) => !q.flagged)
    .map((q) => ({
      question: q,
      progress: progressMap.get(q.id) || null,
      score: scoreQuestion(q, progressMap.get(q.id) || null, mode),
    }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Apply category distribution
  const selected: ScoredQuestion[] = [];
  const categoryBudgets = new Map<QuestionCategory, number>();

  if (mode === "weak-spots") {
    // For weak spots, just take the highest-scored questions
    return scored
      .slice(0, targetSize)
      .map((s) => s.question.id);
  }

  // Calculate target counts per category
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS_MAP)) {
    const target = Math.max(1, Math.round(targetSize * weight));
    categoryBudgets.set(cat as QuestionCategory, target);
  }

  // Fill category slots
  const used = new Set<string>();
  for (const [category, budget] of categoryBudgets) {
    const candidates = scored.filter(
      (s) => s.question.category === category && !used.has(s.question.id)
    );
    const take = candidates.slice(0, budget);
    take.forEach((s) => {
      selected.push(s);
      used.add(s.question.id);
    });
  }

  // Fill remaining slots from top scores regardless of category
  if (selected.length < targetSize) {
    const remaining = scored.filter((s) => !used.has(s.question.id));
    const needed = targetSize - selected.length;
    remaining.slice(0, needed).forEach((s) => {
      selected.push(s);
    });
  }

  // Ensure difficulty variety: shuffle within selection
  return shuffleWithDifficultySpread(
    selected.slice(0, targetSize).map((s) => ({
      id: s.question.id,
      difficulty: s.question.difficulty,
    }))
  );
}

/** Shuffle questions but avoid clustering same difficulty levels. */
function shuffleWithDifficultySpread(
  items: { id: string; difficulty: Difficulty }[]
): string[] {
  // Simple approach: interleave difficulties
  const byDifficulty: Record<Difficulty, string[]> = {
    easy: [],
    medium: [],
    hard: [],
  };

  for (const item of items) {
    byDifficulty[item.difficulty].push(item.id);
  }

  // Shuffle each group
  for (const arr of Object.values(byDifficulty)) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Interleave: easy → medium → hard → repeat
  const result: string[] = [];
  const order: Difficulty[] = ["easy", "medium", "hard"];
  let idx = 0;

  while (result.length < items.length) {
    const diff = order[idx % 3];
    if (byDifficulty[diff].length > 0) {
      result.push(byDifficulty[diff].shift()!);
    }
    idx++;
    // Safety: avoid infinite loop if one category is empty
    if (idx > items.length * 3) break;
  }

  // Add any remaining
  for (const arr of Object.values(byDifficulty)) {
    result.push(...arr);
  }

  return result.slice(0, items.length);
}
