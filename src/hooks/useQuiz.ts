"use client";

import { useState, useCallback, useRef } from "react";
import { useApi } from "./useApi";
import type {
  QuizMode,
  QuizQuestionPayload,
  AnswerOption,
  SubmitAnswerResponse,
  BuildQuizResponse,
} from "@/types";

interface QuizState {
  sessionId: string | null;
  questions: QuizQuestionPayload[];
  currentIndex: number;
  score: number;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  lastAnswer: SubmitAnswerResponse | null;
  isComplete: boolean;
}

export function useQuiz() {
  const { apiFetch } = useApi();
  const startTimeRef = useRef<number>(0);

  const [state, setState] = useState<QuizState>({
    sessionId: null,
    questions: [],
    currentIndex: 0,
    score: 0,
    isLoading: false,
    isSubmitting: false,
    error: null,
    lastAnswer: null,
    isComplete: false,
  });

  const startQuiz = useCallback(
    async (mode: QuizMode) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const data = await apiFetch<BuildQuizResponse>("/api/build-quiz", {
          method: "POST",
          body: JSON.stringify({ mode }),
        });

        setState({
          sessionId: data.sessionId,
          questions: data.questions,
          currentIndex: 0,
          score: 0,
          isLoading: false,
          isSubmitting: false,
          error: null,
          lastAnswer: null,
          isComplete: false,
        });

        startTimeRef.current = Date.now();
        return data.sessionId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start quiz";
        setState((s) => ({ ...s, isLoading: false, error: message }));
        return null;
      }
    },
    [apiFetch]
  );

  const submitAnswer = useCallback(
    async (selectedOption: AnswerOption) => {
      if (!state.sessionId || state.isSubmitting) return null;

      const question = state.questions[state.currentIndex];
      if (!question) return null;

      const timeSpentMs = Date.now() - startTimeRef.current;

      setState((s) => ({ ...s, isSubmitting: true, error: null }));

      try {
        const data = await apiFetch<SubmitAnswerResponse>(
          "/api/submit-answer",
          {
            method: "POST",
            body: JSON.stringify({
              sessionId: state.sessionId,
              questionId: question.id,
              selectedOption,
              timeSpentMs,
            }),
          }
        );

        const isComplete =
          data.sessionProgress.currentIndex >=
          data.sessionProgress.totalQuestions;

        setState((s) => ({
          ...s,
          isSubmitting: false,
          lastAnswer: data,
          score: data.sessionProgress.score,
          isComplete,
        }));

        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to submit answer";
        setState((s) => ({ ...s, isSubmitting: false, error: message }));
        return null;
      }
    },
    [apiFetch, state.sessionId, state.questions, state.currentIndex, state.isSubmitting]
  );

  const nextQuestion = useCallback(() => {
    setState((s) => ({
      ...s,
      currentIndex: s.currentIndex + 1,
      lastAnswer: null,
    }));
    startTimeRef.current = Date.now();
  }, []);

  const currentQuestion = state.questions[state.currentIndex] || null;

  return {
    ...state,
    currentQuestion,
    startQuiz,
    submitAnswer,
    nextQuestion,
  };
}
