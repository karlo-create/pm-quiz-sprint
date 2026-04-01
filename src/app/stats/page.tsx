"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, StatCard, Spinner } from "@/components/ui";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { BADGE_DEFINITIONS } from "@/lib/quiz/achievements";
import type {
  UserProfile,
  QuestionProgress,
  QuestionCategory,
} from "@/types";
import { CATEGORY_LABELS } from "@/types";

const ALL_CATEGORIES: QuestionCategory[] = [
  "product-management",
  "ai-pm",
  "tech-basics",
  "ux-ui",
];

const CATEGORY_ICONS: Record<QuestionCategory, string> = {
  "product-management": "📦",
  "ai-pm": "🤖",
  "tech-basics": "⚙️",
  "ux-ui": "🎨",
};

interface StatusCounts {
  new: number;
  learning: number;
  solid: number;
  "needs-review": number;
}

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    new: 0,
    learning: 0,
    solid: 0,
    "needs-review": 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const profileSnap = await getDoc(doc(getClientDb(), "users", user.uid));
      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as UserProfile);
      }

      const progressSnap = await getDocs(
        collection(getClientDb(), `users/${user.uid}/question_progress`)
      );

      const progressList = progressSnap.docs.map(
        (d) => d.data() as QuestionProgress
      );

      const counts: StatusCounts = {
        new: 0,
        learning: 0,
        solid: 0,
        "needs-review": 0,
      };
      progressList.forEach((p) => {
        counts[p.status]++;
      });
      setStatusCounts(counts);

      setIsLoading(false);
    };

    load().catch(console.error);
  }, [user]);

  if (authLoading || isLoading) {
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

  const totalProgress =
    statusCounts.new +
    statusCounts.learning +
    statusCounts.solid +
    statusCounts["needs-review"];

  return (
    <div className="animate-fade-in space-y-6 px-4 pt-6">
      <h1 className="text-2xl font-bold">Stats</h1>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Quizzes" value={profile?.totalQuizzes ?? 0} />
        <StatCard
          label="Total Questions"
          value={profile?.totalQuestions ?? 0}
        />
        <StatCard label="Overall Accuracy" value={`${accuracy}%`} accent="accuracy" />
        <StatCard
          label="Current Streak"
          value={profile?.currentStreak ?? 0}
          sub="days"
          icon={(profile?.currentStreak ?? 0) > 0 ? "🔥" : undefined}
          accent={(profile?.currentStreak ?? 0) > 0 ? "streak" : "default"}
        />
      </div>

      {/* Question mastery breakdown */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Question Mastery
        </h2>
        <Card>
          {totalProgress === 0 ? (
            <p className="text-center text-sm text-text-secondary py-2">
              Complete some quizzes to see your mastery progress.
            </p>
          ) : (
            <div className="space-y-3">
              <StatusRow
                label="New"
                count={statusCounts.new}
                total={totalProgress}
                color="bg-blue-500"
                dot="bg-blue-500"
              />
              <StatusRow
                label="Learning"
                count={statusCounts.learning}
                total={totalProgress}
                color="bg-amber-500"
                dot="bg-amber-500"
              />
              <StatusRow
                label="Solid"
                count={statusCounts.solid}
                total={totalProgress}
                color="bg-emerald-500"
                dot="bg-emerald-500"
              />
              <StatusRow
                label="Needs Review"
                count={statusCounts["needs-review"]}
                total={totalProgress}
                color="bg-red-500"
                dot="bg-red-500"
              />
            </div>
          )}
        </Card>
      </div>

      {/* Achievement badges */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Achievements
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {BADGE_DEFINITIONS.map((badge) => {
            const earned = (profile?.badges || []).includes(badge.id);
            return (
              <Card
                key={badge.id}
                className={`text-center py-3 ${earned ? "" : "opacity-40"}`}
              >
                <p className="text-2xl">{badge.icon}</p>
                <p className="text-xs font-semibold mt-1">{badge.name}</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {badge.description}
                </p>
                {earned && (
                  <span className="inline-block mt-1 text-xs text-success font-medium">
                    Earned ✓
                  </span>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Category coverage */}
      <div className="pb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Categories
        </h2>
        <div className="space-y-2">
          {ALL_CATEGORIES.map((cat) => (
            <Card key={cat} className="flex items-center gap-3 py-3">
              <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
              <span className="text-sm font-medium">{CATEGORY_LABELS[cat]}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  count,
  total,
  color,
  dot,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  dot: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          <span>{label}</span>
        </div>
        <span className="text-text-secondary font-medium">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
