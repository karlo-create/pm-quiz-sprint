import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/firebase/auth-helpers";
import { submitAnswerRequestSchema } from "@/lib/validation/schemas";
import {
  updateProgress,
  createFreshProgress,
} from "@/lib/quiz/spaced-repetition";
import { computeStreakUpdate, getLocalDateString } from "@/lib/quiz/streaks";
import { checkAndAwardBadges } from "@/lib/quiz/achievements";
import type {
  Question,
  QuestionProgress,
  QuizSession,
  Attempt,
  SubmitAnswerResponse,
  UserProfile,
} from "@/types";
import { FieldValue } from "firebase-admin/firestore";

const DAILY_GOAL_TARGET = 10;

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = submitAnswerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { sessionId, questionId, selectedOption, timeSpentMs } = parsed.data;
  const userId = user.uid;

  // Get user's timezone from request header (sent by client)
  const timezone =
    req.headers.get("x-user-timezone") || "UTC";

  try {
    // Fetch session
    const sessionRef = adminDb.doc(
      `users/${userId}/quiz_sessions/${sessionId}`
    );
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const session = sessionSnap.data() as QuizSession;

    if (session.status !== "in-progress") {
      return NextResponse.json(
        { error: "Session is not active" },
        { status: 400 }
      );
    }

    // Check if already answered
    if (session.answers[questionId]) {
      return NextResponse.json(
        { error: "Question already answered" },
        { status: 400 }
      );
    }

    // Fetch question
    const questionSnap = await adminDb
      .collection("questions")
      .doc(questionId)
      .get();

    if (!questionSnap.exists) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const question = questionSnap.data() as Question;
    const isCorrect = selectedOption === question.correctOption;
    const now = new Date().toISOString();

    // Fetch user profile for streak/goal/badge updates
    const userRef = adminDb.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    const profile = userSnap.data() as UserProfile;

    // Save attempt
    const attemptRef = adminDb.collection(`users/${userId}/attempts`).doc();
    const attempt: Attempt = {
      id: attemptRef.id,
      userId,
      questionId,
      sessionId,
      selectedOption,
      correctOption: question.correctOption,
      isCorrect,
      answeredAt: now,
      timeSpentMs,
    };

    // Update session
    const newScore = session.score + (isCorrect ? 1 : 0);
    const newIndex = session.currentIndex + 1;
    const isComplete = newIndex >= session.totalQuestions;

    const sessionUpdate: Record<string, unknown> = {
      [`answers.${questionId}`]: {
        questionId,
        selectedOption,
        isCorrect,
        answeredAt: now,
        timeSpentMs,
      },
      currentIndex: newIndex,
      score: newScore,
    };

    if (isComplete) {
      sessionUpdate.status = "completed";
      sessionUpdate.completedAt = now;
    }

    // Update question progress (spaced repetition)
    const progressRef = adminDb.doc(
      `users/${userId}/question_progress/${questionId}`
    );
    const progressSnap = await progressRef.get();

    let currentProgress: QuestionProgress;
    if (progressSnap.exists) {
      currentProgress = progressSnap.data() as QuestionProgress;
    } else {
      currentProgress = createFreshProgress(questionId, userId);
    }

    const updatedProgress = updateProgress(
      currentProgress,
      isCorrect,
      timeSpentMs
    );

    // Update global question counters
    const questionUpdate: Record<string, FieldValue> = {
      globalTimesServed: FieldValue.increment(1),
    };
    if (isCorrect) {
      questionUpdate.globalTimesCorrect = FieldValue.increment(1);
    } else {
      questionUpdate.globalTimesWrong = FieldValue.increment(1);
    }

    // --- Daily goal tracking ---
    const todayLocal = getLocalDateString(timezone);
    let dailyGoalProgress = profile.dailyGoalProgress || 0;
    let dailyGoalDate = profile.dailyGoalDate || null;
    let dailyGoalCompleted = profile.dailyGoalCompleted || false;

    // Reset if it's a new day
    if (dailyGoalDate !== todayLocal) {
      dailyGoalProgress = 0;
      dailyGoalDate = todayLocal;
      dailyGoalCompleted = false;
    }

    dailyGoalProgress += 1;
    const justCompletedDailyGoal =
      !dailyGoalCompleted && dailyGoalProgress >= DAILY_GOAL_TARGET;
    if (justCompletedDailyGoal) {
      dailyGoalCompleted = true;
    }

    // Batch write
    const batch = adminDb.batch();
    batch.set(attemptRef, attempt);
    batch.update(sessionRef, sessionUpdate);
    batch.set(progressRef, updatedProgress);
    batch.update(questionSnap.ref, questionUpdate);

    // Build user profile update
    const userUpdate: Record<string, unknown> = {
      totalQuestions: FieldValue.increment(1),
      totalCorrect: FieldValue.increment(isCorrect ? 1 : 0),
      lastActiveAt: now,
      timezone,
      dailyGoalProgress,
      dailyGoalDate,
      dailyGoalCompleted,
    };

    // --- Streak update (on quiz completion only) ---
    let newBadges: string[] = [];

    if (isComplete) {
      userUpdate.totalQuizzes = FieldValue.increment(1);

      const streakResult = computeStreakUpdate(
        profile.currentStreak || 0,
        profile.longestStreak || 0,
        profile.lastQuizDate,
        profile.streakFreezeUsedAt || null,
        profile.streakFreezeWeekStart || null,
        timezone
      );
      userUpdate.currentStreak = streakResult.currentStreak;
      userUpdate.longestStreak = streakResult.longestStreak;
      userUpdate.lastQuizDate = streakResult.lastQuizDate;
      userUpdate.streakFreezeUsedAt = streakResult.streakFreezeUsedAt;
      userUpdate.streakFreezeWeekStart = streakResult.streakFreezeWeekStart;

      // --- Badge check (on quiz completion) ---
      // Build a simulated "after" profile for badge checking
      const simulatedProfile: UserProfile = {
        ...profile,
        totalQuestions: (profile.totalQuestions || 0) + 1,
        totalCorrect: (profile.totalCorrect || 0) + (isCorrect ? 1 : 0),
        totalQuizzes: (profile.totalQuizzes || 0) + 1,
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
        badges: profile.badges || [],
      };

      // We pass an empty progressList here — category mastery checks
      // use profile-level stats, not individual progress records
      newBadges = checkAndAwardBadges(simulatedProfile, [], true);

      if (newBadges.length > 0) {
        userUpdate.badges = [...(profile.badges || []), ...newBadges];
        userUpdate.badgesLastCheckedAt = now;
      }
    }

    batch.update(userRef, userUpdate);

    await batch.commit();

    const response: SubmitAnswerResponse = {
      isCorrect,
      correctOption: question.correctOption,
      explanation: question.explanation,
      sessionProgress: {
        currentIndex: newIndex,
        totalQuestions: session.totalQuestions,
        score: newScore,
      },
      dailyGoalProgress,
      dailyGoalTarget: DAILY_GOAL_TARGET,
      dailyGoalJustCompleted: justCompletedDailyGoal,
      newBadges,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Submit answer error:", error);
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 }
    );
  }
}
