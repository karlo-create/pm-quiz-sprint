import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/firebase/auth-helpers";
import { submitAnswerRequestSchema } from "@/lib/validation/schemas";
import {
  updateProgress,
  createFreshProgress,
} from "@/lib/quiz/spaced-repetition";
import type {
  Question,
  QuestionProgress,
  QuizSession,
  Attempt,
  SubmitAnswerResponse,
} from "@/types";
import { FieldValue } from "firebase-admin/firestore";

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

    // Batch write
    const batch = adminDb.batch();
    batch.set(attemptRef, attempt);
    batch.update(sessionRef, sessionUpdate);
    batch.set(progressRef, updatedProgress);
    batch.update(questionSnap.ref, questionUpdate);

    // Update user profile stats
    const userRef = adminDb.doc(`users/${userId}`);
    batch.update(userRef, {
      totalQuestions: FieldValue.increment(1),
      totalCorrect: FieldValue.increment(isCorrect ? 1 : 0),
      lastActiveAt: now,
    });

    if (isComplete) {
      batch.update(userRef, {
        totalQuizzes: FieldValue.increment(1),
        lastQuizDate: now.split("T")[0],
      });
    }

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
