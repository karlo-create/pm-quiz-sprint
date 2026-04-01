"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Card, Spinner, ScoreRing } from "@/components/ui";
import { doc, getDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { QuizSession, Question, AnswerOption } from "@/types";

const OPTION_LABELS: AnswerOption[] = ["A", "B", "C", "D"];

export default function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !sessionId) return;

    const load = async () => {
      const ref = doc(
        getClientDb(),
        `users/${user.uid}/quiz_sessions/${sessionId}`
      );
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const sess = snap.data() as QuizSession;
        setSession(sess);

        // Fetch full question data for review
        const questionIds = Object.keys(sess.answers);
        const questionMap: Record<string, Question> = {};
        await Promise.all(
          questionIds.map(async (qId) => {
            const qSnap = await getDoc(doc(getClientDb(), "questions", qId));
            if (qSnap.exists()) {
              questionMap[qId] = qSnap.data() as Question;
            }
          })
        );
        setQuestions(questionMap);
      }
      setIsLoading(false);
    };

    load().catch(console.error);
  }, [user, sessionId]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-text-secondary">Session not found.</p>
      </div>
    );
  }

  const percentage = Math.round(
    (session.score / session.totalQuestions) * 100
  );
  const answers = Object.values(session.answers);
  const wrongAnswers = answers.filter((a) => !a.isCorrect);

  const emoji =
    percentage >= 80
      ? "🎉"
      : percentage >= 60
        ? "👍"
        : percentage >= 40
          ? "📚"
          : "💪";

  const resultLabel =
    percentage >= 80
      ? "Excellent work!"
      : percentage >= 60
        ? "Good job!"
        : percentage >= 40
          ? "Keep studying!"
          : "Keep pushing!";

  return (
    <div className="animate-fade-in space-y-6 px-4 pt-8 pb-8">
      {/* Score hero */}
      <div className="text-center animate-pop-in">
        <p className="text-5xl">{emoji}</p>
        <h1 className="mt-2 text-4xl font-bold">
          {session.score}/{session.totalQuestions}
        </h1>
        <p className="mt-1 text-base text-text-secondary">{resultLabel}</p>
      </div>

      {/* Score ring */}
      <div className="flex justify-center">
        <ScoreRing percentage={percentage} />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-3">
          <p className="text-xs text-text-secondary">Correct</p>
          <p className="text-2xl font-bold text-success">{session.score}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-text-secondary">Incorrect</p>
          <p className="text-2xl font-bold text-error">
            {session.totalQuestions - session.score}
          </p>
        </Card>
      </div>

      {/* Full question review */}
      <div className="animate-slide-up">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Question Review ({answers.length})
        </h2>
        <div className="space-y-3">
          {answers.map((a, idx) => {
            const q = questions[a.questionId];
            if (!q) return null;
            return (
              <Card
                key={a.questionId}
                className={`text-sm space-y-2 border-l-4 ${a.isCorrect ? "border-l-success/50" : "border-l-error/50"}`}
              >
                <p className="font-medium">
                  {idx + 1}. {q.questionText}
                </p>
                <div className="space-y-1 pl-2">
                  {q.options.map((opt, i) => {
                    const label = OPTION_LABELS[i];
                    const isUserAnswer = label === a.selectedOption;
                    const isCorrectAnswer = label === q.correctOption;
                    let optClass = "text-text-secondary";
                    if (isCorrectAnswer)
                      optClass = "text-success font-semibold";
                    if (isUserAnswer && !a.isCorrect)
                      optClass = "text-error font-semibold line-through";
                    if (isUserAnswer && a.isCorrect)
                      optClass = "text-success font-semibold";
                    return (
                      <p key={label} className={optClass}>
                        {label}. {opt}
                        {isUserAnswer && !isCorrectAnswer && " ← your answer"}
                        {isCorrectAnswer && " ✓"}
                      </p>
                    );
                  })}
                </div>
                {q.explanation && (
                  <p className="text-xs text-text-secondary border-t border-border pt-2">
                    <span className="font-semibold">Why:</span>{" "}
                    {q.explanation}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {wrongAnswers.length > 0 && (
          <Button
            size="lg"
            variant="danger"
            onClick={() => router.push("/")}
          >
            🎯 Retry Weak Spots
          </Button>
        )}

        <Button size="lg" onClick={() => router.push("/")}>
          ⚡ Start Another Sprint
        </Button>

        <Button
          size="lg"
          variant="ghost"
          onClick={() => router.push("/stats")}
        >
          View Stats →
        </Button>
      </div>
    </div>
  );
}
