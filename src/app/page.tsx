"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Button, StatCard, Spinner, Card, ProgressBar } from "@/components/ui";
import type { QuizMode, UserProfile, QuestionProgress } from "@/types";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

const DAILY_GOAL_TARGET = 10;

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { apiFetch } = useApi();
  const [startingQuiz, setStartingQuiz] = useState<QuizMode | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unfinishedSession, setUnfinishedSession] = useState<string | null>(
    null
  );
  const [cardsDue, setCardsDue] = useState<number>(0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Load user profile, check for unfinished sessions, and count cards due
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const profileRef = doc(getClientDb(), "users", user.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          totalQuizzes: 0,
          totalQuestions: 0,
          totalCorrect: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastQuizDate: null,
          streakFreezeUsedAt: null,
          streakFreezeWeekStart: null,
          dailyGoalProgress: 0,
          dailyGoalDate: null,
          dailyGoalCompleted: false,
          timezone: null,
          badges: [],
          badgesLastCheckedAt: null,
        };
        await setDoc(doc(getClientDb(), "users", user.uid), newProfile);
        setProfile(newProfile);
      }

      // Check for unfinished sessions
      try {
        const sessionsRef = collection(
          getClientDb(),
          `users/${user.uid}/quiz_sessions`
        );
        const q = query(
          sessionsRef,
          where("status", "==", "in-progress"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setUnfinishedSession(snap.docs[0].id);
        }
      } catch {
        // Ignore — no unfinished session or index not ready
      }

      // Count cards due for review (spaced repetition)
      try {
        const progressRef = collection(
          getClientDb(),
          `users/${user.uid}/question_progress`
        );
        const progressSnap = await getDocs(progressRef);
        const now = new Date().toISOString();
        let dueCount = 0;
        progressSnap.docs.forEach((d) => {
          const p = d.data() as QuestionProgress;
          if (p.nextEligibleAt && p.nextEligibleAt <= now) {
            dueCount++;
          }
        });
        setCardsDue(dueCount);
      } catch {
        // Ignore — progress collection may not exist yet
      }
    };

    loadData().catch(console.error);
  }, [user]);

  const handleStartQuiz = async (mode: QuizMode) => {
    setStartingQuiz(mode);
    try {
      const data = await apiFetch<{ sessionId: string; questions: unknown[] }>(
        "/api/build-quiz",
        {
          method: "POST",
          body: JSON.stringify({ mode }),
        }
      );
      sessionStorage.setItem(
        `quiz-${data.sessionId}`,
        JSON.stringify(data)
      );
      router.push(`/quiz/${data.sessionId}`);
    } catch (err) {
      console.error("Failed to start quiz:", err);
      setStartingQuiz(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const accuracy =
    profile && profile.totalQuestions > 0
      ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100)
      : 0;

  const streak = profile?.currentStreak ?? 0;
  const firstName = profile?.displayName?.split(" ")[0] ?? "";

  // Daily goal: check if date matches today in user's local tz
  const todayLocal = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  const dailyProgress =
    profile?.dailyGoalDate === todayLocal
      ? profile.dailyGoalProgress ?? 0
      : 0;
  const dailyGoalMet = dailyProgress >= DAILY_GOAL_TARGET;

  return (
    <div className="animate-fade-in space-y-6 px-4 pt-6 pb-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Hey{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {streak > 0
            ? `${streak}-day streak — keep it going!`
            : "Ready for a quick sprint?"}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Streak"
          value={streak}
          sub="days"
          icon={streak > 0 ? "🔥" : "—"}
          accent="streak"
        />
        <StatCard
          label="Accuracy"
          value={`${accuracy}%`}
          sub="all-time"
          accent="accuracy"
        />
        <StatCard
          label="Quizzes"
          value={profile?.totalQuizzes ?? 0}
          sub="done"
        />
      </div>

      {/* Daily goal progress */}
      <Card>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {dailyGoalMet ? "🎉 Daily Goal Complete!" : "📊 Daily Goal"}
            </span>
            <span className="text-sm text-text-secondary">
              {Math.min(dailyProgress, DAILY_GOAL_TARGET)}/{DAILY_GOAL_TARGET}{" "}
              questions
            </span>
          </div>
          <ProgressBar
            current={Math.min(dailyProgress, DAILY_GOAL_TARGET)}
            total={DAILY_GOAL_TARGET}
            colorClass={dailyGoalMet ? "bg-success" : "bg-primary"}
          />
          {dailyGoalMet && (
            <p className="text-xs text-success font-medium text-center">
              Great job! You hit your daily target!
            </p>
          )}
        </div>
      </Card>

      {/* Cards due for review */}
      {cardsDue > 0 && (
        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <p className="text-sm font-medium">
                {cardsDue} question{cardsDue !== 1 ? "s" : ""} due for review
              </p>
              <p className="text-xs text-text-secondary">
                Based on your spaced repetition schedule
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleStartQuiz("weak-spots")}
            disabled={!!startingQuiz}
          >
            Review
          </Button>
        </Card>
      )}

      {/* Resume unfinished session */}
      {unfinishedSession && (
        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.push(`/quiz/${unfinishedSession}`)}
        >
          ↩ Resume Last Session
        </Button>
      )}

      {/* Start a sprint */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Start a Sprint
        </h2>

        <Button
          size="lg"
          loading={startingQuiz === "quick-5"}
          disabled={!!startingQuiz}
          onClick={() => handleStartQuiz("quick-5")}
        >
          ⚡ Quick 5
        </Button>

        <Button
          size="lg"
          variant="secondary"
          loading={startingQuiz === "standard-10"}
          disabled={!!startingQuiz}
          onClick={() => handleStartQuiz("standard-10")}
        >
          📝 Standard 10
        </Button>

        <Button
          size="lg"
          variant="danger"
          loading={startingQuiz === "weak-spots"}
          disabled={!!startingQuiz}
          onClick={() => handleStartQuiz("weak-spots")}
        >
          🎯 Weak Spots
        </Button>
      </div>
    </div>
  );
}
