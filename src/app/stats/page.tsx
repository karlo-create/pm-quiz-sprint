"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, StatCard, Spinner, CategoryBadge } from "@/components/ui";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
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

interface CategoryStat {
  category: QuestionCategory;
  seen: number;
  correct: number;
  accuracy: number;
}

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
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
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
      // Load profile
      const profileSnap = await getDoc(doc(getClientDb(), "users", user.uid));
      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as UserProfile);
      }

      // Load all progress records
      const progressSnap = await getDocs(
        collection(getClientDb(), `users/${user.uid}/question_progress`)
      );

      const progressList = progressSnap.docs.map(
        (d) => d.data() as QuestionProgress
      );

      // Status counts
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

      // Category stats (needs question data to map questionId → category)
      // For now, aggregate from progress records
      const catMap = new Map<
        QuestionCategory,
        { seen: number; correct: number }
      >();

      ALL_CATEGORIES.forEach((cat) => {
        catMap.set(cat, { seen: 0, correct: 0 });
      });

      // We'll aggregate all progress regardless of category for the overview
      const totalSeen = progressList.reduce(
        (acc, p) => acc + p.timesSeen,
        0
      );
      const totalCorrect = progressList.reduce(
        (acc, p) => acc + p.timesCorrect,
        0
      );

      setCategoryStats(
        ALL_CATEGORIES.map((cat) => ({
          category: cat,
          seen: 0, // Would need question lookup to properly categorize
          correct: 0,
          accuracy: 0,
        }))
      );

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
    <div className="space-y-6 px-4 pt-6">
      <h1 className="text-2xl font-bold">Stats</h1>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Quizzes" value={profile?.totalQuizzes ?? 0} />
        <StatCard
          label="Total Questions"
          value={profile?.totalQuestions ?? 0}
        />
        <StatCard label="Overall Accuracy" value={`${accuracy}%`} />
        <StatCard
          label="Current Streak"
          value={profile?.currentStreak ?? 0}
          sub="days"
        />
      </div>

      {/* Question status breakdown */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Question Mastery
        </h2>
        <Card>
          <div className="space-y-3">
            <StatusRow
              label="New"
              count={statusCounts.new}
              total={totalProgress}
              color="bg-blue-500"
            />
            <StatusRow
              label="Learning"
              count={statusCounts.learning}
              total={totalProgress}
              color="bg-amber-500"
            />
            <StatusRow
              label="Solid"
              count={statusCounts.solid}
              total={totalProgress}
              color="bg-emerald-500"
            />
            <StatusRow
              label="Needs Review"
              count={statusCounts["needs-review"]}
              total={totalProgress}
              color="bg-red-500"
            />
          </div>
        </Card>
      </div>

      {/* Category coverage */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Categories
        </h2>
        <div className="space-y-2">
          {ALL_CATEGORIES.map((cat) => (
            <Card key={cat} className="flex items-center justify-between">
              <CategoryBadge category={cat} />
              <span className="text-sm text-text-secondary">
                {CATEGORY_LABELS[cat]}
              </span>
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
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-text-secondary">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
