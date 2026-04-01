"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useApi } from "@/hooks/useApi";
import {
  Button,
  Spinner,
  ProgressBar,
  CategoryBadge,
  DifficultyBadge,
  Card,
} from "@/components/ui";
import { BADGE_DEFINITIONS } from "@/lib/quiz/achievements";
import type {
  QuizQuestionPayload,
  AnswerOption,
  SubmitAnswerResponse,
} from "@/types";

const OPTION_LABELS: AnswerOption[] = ["A", "B", "C", "D"];

interface QuizData {
  sessionId: string;
  questions: QuizQuestionPayload[];
}

export default function QuizPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { apiFetch } = useApi();

  const [questions, setQuestions] = useState<QuizQuestionPayload[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<AnswerOption | null>(
    null
  );
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  // Used to re-trigger stagger animation on each new question
  const [questionKey, setQuestionKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !sessionId) return;

    const stored = sessionStorage.getItem(`quiz-${sessionId}`);
    if (stored) {
      try {
        const data = JSON.parse(stored) as QuizData;
        setQuestions(data.questions);
        setIsLoading(false);
        setQuestionStartTime(Date.now());
        return;
      } catch {
        // fall through
      }
    }

    router.replace("/");
  }, [user, sessionId, router]);

  const currentQuestion = questions[currentIndex] || null;
  const totalQuestions = questions.length;

  const handleSelectAnswer = async (option: AnswerOption) => {
    if (isSubmitting || feedback) return;

    setSelectedOption(option);
    setIsSubmitting(true);

    try {
      const timeSpentMs = Date.now() - questionStartTime;
      const data = await apiFetch<SubmitAnswerResponse>("/api/submit-answer", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion!.id,
          selectedOption: option,
          timeSpentMs,
        }),
      });

      setFeedback(data);
      setScore(data.sessionProgress.score);
    } catch (err) {
      console.error("Failed to submit:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= totalQuestions) {
      router.push(`/results/${sessionId}`);
      return;
    }
    setCurrentIndex(nextIdx);
    setSelectedOption(null);
    setFeedback(null);
    setQuestionStartTime(Date.now());
    setQuestionKey((k) => k + 1);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-text-secondary">No questions available.</p>
      </div>
    );
  }

  return (
    <div className="quiz-active flex min-h-screen flex-col px-4 pt-4">
      {/* Progress header */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span className="font-medium">
            {currentIndex + 1} <span className="text-border">/ {totalQuestions}</span>
          </span>
          <span className="font-medium">
            {score} correct
          </span>
        </div>
        <ProgressBar current={currentIndex + 1} total={totalQuestions} />
      </div>

      {/* Category & difficulty badges */}
      <div className="mb-3 flex items-center gap-2 animate-fade-in" key={`badges-${questionKey}`}>
        <CategoryBadge category={currentQuestion.category} />
        <DifficultyBadge difficulty={currentQuestion.difficulty} />
      </div>

      {/* Question text */}
      <div className="mb-6 animate-slide-up" key={`question-${questionKey}`}>
        <h2 className="text-lg font-semibold leading-snug">
          {currentQuestion.questionText}
        </h2>
      </div>

      {/* Answer buttons */}
      <div className="flex-1 space-y-3" key={`options-${questionKey}`}>
        {currentQuestion.options.map((optionText, idx) => {
          const option = OPTION_LABELS[idx];
          const isSelected = selectedOption === option;
          const showFeedback = feedback !== null;
          const isCorrect = feedback?.correctOption === option;
          const isWrong = showFeedback && isSelected && !feedback?.isCorrect;

          let buttonClass =
            `w-full text-left rounded-xl border-2 p-4 transition-all tap-target animate-option-${idx} `;

          if (showFeedback) {
            if (isCorrect) {
              buttonClass += "border-success bg-success/10 text-success font-semibold animate-correct";
            } else if (isWrong) {
              buttonClass += "border-error bg-error/10 text-error font-semibold animate-wrong";
            } else {
              buttonClass += "border-border opacity-40";
            }
          } else if (isSelected) {
            buttonClass += "border-primary bg-primary/10";
          } else {
            buttonClass +=
              "border-border hover:border-primary/50 active:scale-[0.98]";
          }

          return (
            <button
              key={option}
              className={buttonClass}
              onClick={() => handleSelectAnswer(option)}
              disabled={isSubmitting || showFeedback}
            >
              <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background border border-border text-sm font-bold">
                {option}
              </span>
              {optionText}
            </button>
          );
        })}
      </div>

      {/* Feedback section */}
      {feedback && (
        <div className="mt-4 space-y-3 pb-4 animate-slide-up">
          <Card
            className={`border-2 ${
              feedback.isCorrect
                ? "border-success bg-success/5"
                : "border-error bg-error/5"
            }`}
          >
            <p className={`mb-1 text-sm font-bold ${feedback.isCorrect ? "text-success" : "text-error"}`}>
              {feedback.isCorrect ? "✓ Correct!" : "✗ Incorrect"}
            </p>
            <p className="text-sm leading-relaxed text-text-secondary">
              {feedback.explanation}
            </p>
          </Card>

          {/* Daily goal completion toast */}
          {feedback.dailyGoalJustCompleted && (
            <Card className="border-2 border-success bg-success/5 text-center animate-pop-in">
              <p className="text-lg font-bold text-success">🎉 Daily Goal Complete!</p>
              <p className="text-sm text-text-secondary">
                You answered {feedback.dailyGoalTarget} questions today!
              </p>
            </Card>
          )}

          {/* New badge earned toast */}
          {feedback.newBadges && feedback.newBadges.length > 0 && (
            <div className="space-y-2">
              {feedback.newBadges.map((badgeId) => {
                const badge = BADGE_DEFINITIONS.find((b) => b.id === badgeId);
                if (!badge) return null;
                return (
                  <Card
                    key={badgeId}
                    className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-center animate-pop-in"
                  >
                    <p className="text-2xl">{badge.icon}</p>
                    <p className="text-sm font-bold mt-1">Badge Earned!</p>
                    <p className="text-sm text-text-secondary">{badge.name}</p>
                  </Card>
                );
              })}
            </div>
          )}

          <Button size="lg" onClick={handleNext}>
            {currentIndex + 1 >= totalQuestions ? "See Results →" : "Next →"}
          </Button>
        </div>
      )}
    </div>
  );
}
