/**
 * Achievement badge system.
 * Badges are checked after each answer submission and awarded when conditions are met.
 */

import type { UserProfile, QuestionProgress, QuestionCategory } from "@/types";
import { CATEGORY_LABELS } from "@/types";

export interface BadgeDefinition {
  id: string;
  icon: string;
  name: string;
  description: string;
  check: (ctx: BadgeCheckContext) => boolean;
}

export interface BadgeCheckContext {
  profile: UserProfile;
  progressList: QuestionProgress[];
  justCompletedQuiz: boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-quiz",
    icon: "🎯",
    name: "First Quiz Completed",
    description: "Complete your first quiz",
    check: (ctx) => ctx.profile.totalQuizzes >= 1,
  },
  {
    id: "streak-7",
    icon: "🔥",
    name: "7-Day Streak",
    description: "Maintain a 7-day streak",
    check: (ctx) => ctx.profile.currentStreak >= 7,
  },
  {
    id: "streak-30",
    icon: "🔥🔥",
    name: "30-Day Streak",
    description: "Maintain a 30-day streak",
    check: (ctx) => ctx.profile.currentStreak >= 30,
  },
  {
    id: "questions-50",
    icon: "📚",
    name: "50 Questions Answered",
    description: "Answer 50 questions total",
    check: (ctx) => ctx.profile.totalQuestions >= 50,
  },
  {
    id: "questions-200",
    icon: "📚📚",
    name: "200 Questions Answered",
    description: "Answer 200 questions total",
    check: (ctx) => ctx.profile.totalQuestions >= 200,
  },
  {
    id: "mastery-pm",
    icon: "🏆",
    name: "PM Mastery",
    description: "80%+ accuracy in Product Management",
    check: (ctx) => checkCategoryMastery(ctx, "product-management"),
  },
  {
    id: "mastery-ai",
    icon: "🏆",
    name: "AI PM Mastery",
    description: "80%+ accuracy in AI PM",
    check: (ctx) => checkCategoryMastery(ctx, "ai-pm"),
  },
  {
    id: "mastery-tech",
    icon: "🏆",
    name: "Tech Mastery",
    description: "80%+ accuracy in Tech Basics",
    check: (ctx) => checkCategoryMastery(ctx, "tech-basics"),
  },
  {
    id: "mastery-ux",
    icon: "🏆",
    name: "UX/UI Mastery",
    description: "80%+ accuracy in UX/UI",
    check: (ctx) => checkCategoryMastery(ctx, "ux-ui"),
  },
];

function checkCategoryMastery(
  ctx: BadgeCheckContext,
  _category: QuestionCategory
): boolean {
  // Category mastery requires question-to-category mapping which is expensive.
  // For now, use overall accuracy as a proxy if user has answered enough questions.
  // A proper implementation would need question docs joined with progress.
  // We check overall accuracy >= 80% with at least 20 questions.
  if (ctx.profile.totalQuestions < 20) return false;
  const accuracy = ctx.profile.totalCorrect / ctx.profile.totalQuestions;
  return accuracy >= 0.8;
}

/**
 * Check all badge conditions and return newly earned badge IDs.
 * Does NOT persist — caller handles Firestore writes.
 */
export function checkAndAwardBadges(
  profile: UserProfile,
  progressList: QuestionProgress[],
  justCompletedQuiz: boolean
): string[] {
  const existingBadges = new Set(profile.badges || []);
  const ctx: BadgeCheckContext = { profile, progressList, justCompletedQuiz };

  const newBadges: string[] = [];
  for (const badge of BADGE_DEFINITIONS) {
    if (!existingBadges.has(badge.id) && badge.check(ctx)) {
      newBadges.push(badge.id);
    }
  }

  return newBadges;
}
