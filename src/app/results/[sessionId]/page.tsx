"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Card, Spinner, CategoryBadge } from "@/components/ui";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { QuizSession, QuestionCategory } from "@/types";
import { CATEGORY_LABELS } from "@/types";

interface CategoryResult {
  category: QuestionCategory;
  total: number;
  correct: number;
}

export default function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<QuizSession | null>(null);
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
        db,
        `users/${user.uid}/quiz_sessions/${sessionId}`
      );
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setSession(snap.data() as QuizSession);
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

  // Compute per-category accuracy (we don't have category on answers,
  // so we show overall score for now)
  const emoji =
    percentage >= 80
      ? "🎉"
      : percentage >= 60
        ? "👍"
        : percentage >= 40
          ? "📚"
          : "💪";

  return (
    <div className="space-y-6 px-4 pt-8">
      {/* Score hero */}
      <div className="text-center">
        <p className="text-5xl">{emoji}</p>
        <h1 className="mt-2 text-4xl font-bold">
          {session.score}/{session.totalQuestions}
        </h1>
        <p className="mt-1 text-lg text-text-secondary">{percentage}% correct</p>
      </div>

      {/* Score ring visual */}
      <div className="flex justify-center">
        <div className="relative h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-surface"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={
                percentage >= 70
                  ? "text-success"
                  : percentage >= 40
                    ? "text-warning"
                    : "text-error"
              }
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${percentage}, 100`}
              strokeLinecap="round"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-text-secondary">Correct</p>
          <p className="text-xl font-bold text-success">{session.score}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Incorrect</p>
          <p className="text-xl font-bold text-error">
            {session.totalQuestions - session.score}
          </p>
        </Card>
      </div>

      {/* Wrong answers to review */}
      {wrongAnswers.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Questions to Review
          </h2>
          <div className="space-y-2">
            {wrongAnswers.map((a) => (
              <Card key={a.questionId} className="text-sm">
                <p className="text-text-secondary">
                  Q: {a.questionId.slice(0, 8)}...
                </p>
                <p>
                  Your answer:{" "}
                  <span className="font-semibold text-error">
                    {a.selectedOption}
                  </span>
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3 pb-6">
        {wrongAnswers.length > 0 && (
          <Button
            size="lg"
            variant="danger"
            onClick={() => {
              router.push("/");
              // Home page will offer weak spots mode
            }}
          >
            🎯 Retry Weak Spots
          </Button>
        )}

        <Button
          size="lg"
          onClick={() => router.push("/")}
        >
          Start Another Sprint
        </Button>

        <Button
          size="lg"
          variant="ghost"
          onClick={() => router.push("/stats")}
        >
          View Stats
        </Button>
      </div>
    </div>
  );
}
