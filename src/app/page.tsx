"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Button, StatCard, Spinner } from "@/components/ui";
import type { QuizMode, UserProfile } from "@/types";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { apiFetch } = useApi();
  const [startingQuiz, setStartingQuiz] = useState<QuizMode | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unfinishedSession, setUnfinishedSession] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Load user profile and check for unfinished sessions
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
        };
        await setDoc(doc(getClientDb(), "users", user.uid), newProfile);
        setProfile(newProfile);
      }

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
    };

    loadData().catch(console.error);
  }, [user]);

  const handleStartQuiz = async (mode: QuizMode) => {
    setStartingQuiz(mode);
    try {
      const data = await apiFetch<{ sessionId: string; questions: unknown[] }>("/api/build-quiz", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      // Store quiz data so the quiz page doesn't need another API call
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

  return (
    <div className="space-y-6 px-4 pt-6">
      <div>
        <h1 className="text-2xl font-bold">
          Hey{profile?.displayName ? `, ${profile.displayName.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-sm text-text-secondary">Ready for a quick sprint?</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Streak"
          value={profile?.currentStreak ?? 0}
          sub="days"
        />
        <StatCard label="Accuracy" value={`${accuracy}%`} sub="7-day" />
        <StatCard
          label="Quizzes"
          value={profile?.totalQuizzes ?? 0}
          sub="completed"
        />
      </div>

      {unfinishedSession && (
        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.push(`/quiz/${unfinishedSession}`)}
        >
          Continue Last Session →
        </Button>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
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
