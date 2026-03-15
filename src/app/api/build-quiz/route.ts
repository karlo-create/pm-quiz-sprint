import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/firebase/auth-helpers";
import { buildQuizRequestSchema } from "@/lib/validation/schemas";
import { selectQuestions } from "@/lib/quiz/selection";
import type {
  Question,
  QuestionProgress,
  QuizSession,
  QuizQuestionPayload,
} from "@/types";

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = buildQuizRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { mode } = parsed.data;
  const userId = user.uid;

  try {
    // Mark any unfinished sessions as abandoned
    const unfinishedSnap = await adminDb
      .collection(`users/${userId}/quiz_sessions`)
      .where("status", "==", "in-progress")
      .limit(5)
      .get();

    if (!unfinishedSnap.empty) {
      const abandonBatch = adminDb.batch();
      unfinishedSnap.docs.forEach((d) =>
        abandonBatch.update(d.ref, { status: "abandoned" })
      );
      await abandonBatch.commit();
    }

    // Fetch all questions from pool
    const questionsSnap = await adminDb.collection("questions").get();
    const allQuestions: Question[] = questionsSnap.docs
      .map((d) => d.data() as Question)
      .filter((q) => !q.flagged);

    if (allQuestions.length === 0) {
      return NextResponse.json(
        { error: "No questions available. Generate questions from the Admin panel first." },
        { status: 404 }
      );
    }

    // Fetch user's progress
    const progressSnap = await adminDb
      .collection(`users/${userId}/question_progress`)
      .get();

    const progressMap = new Map<string, QuestionProgress>();
    progressSnap.docs.forEach((d) => {
      const prog = d.data() as QuestionProgress;
      progressMap.set(prog.questionId, prog);
    });

    // Select questions
    const selectedIds = selectQuestions(allQuestions, progressMap, mode);

    if (selectedIds.length === 0) {
      return NextResponse.json(
        { error: "Could not select questions for this mode." },
        { status: 404 }
      );
    }

    // Build session
    const sessionRef = adminDb
      .collection(`users/${userId}/quiz_sessions`)
      .doc();

    const session: QuizSession = {
      id: sessionRef.id,
      userId,
      mode,
      questionIds: selectedIds,
      currentIndex: 0,
      answers: {},
      startedAt: new Date().toISOString(),
      completedAt: null,
      score: 0,
      totalQuestions: selectedIds.length,
      status: "in-progress",
    };

    await sessionRef.set(session);

    // Build question payloads (without correct answers)
    const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
    const questions: QuizQuestionPayload[] = selectedIds
      .map((id) => {
        const q = questionMap.get(id);
        if (!q) return null;
        return {
          id: q.id,
          category: q.category,
          subCategory: q.subCategory,
          difficulty: q.difficulty,
          questionText: q.questionText,
          options: q.options,
          tags: q.tags,
        };
      })
      .filter((q): q is QuizQuestionPayload => q !== null);

    return NextResponse.json({
      sessionId: session.id,
      questions,
    });
  } catch (error) {
    console.error("Build quiz error:", error);
    return NextResponse.json(
      { error: "Failed to build quiz" },
      { status: 500 }
    );
  }
}
