"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useApi } from "@/hooks/useApi";
import {
  Button,
  Card,
  Spinner,
  CategoryBadge,
} from "@/components/ui";
import type { PoolStatus, QuestionBatch } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { apiFetch } = useApi();

  const [poolStatuses, setPoolStatuses] = useState<PoolStatus[]>([]);
  const [batches, setBatches] = useState<QuestionBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      // Load pool status
      const statusData = await apiFetch<{
        statuses: PoolStatus[];
        needsRefresh: boolean;
      }>("/api/refresh-pool");
      setPoolStatuses(statusData.statuses);

      // Load recent batches from client-side Firestore
      const batchQuery = query(
        collection(db, "question_batches"),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const batchSnap = await getDocs(batchQuery);
      setBatches(batchSnap.docs.map((d) => d.data() as QuestionBatch));
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleGenerateBatch = async () => {
    setIsGenerating(true);
    setLastResult(null);
    try {
      const result = await apiFetch<{
        batchId: string;
        accepted: number;
        rejected: number;
        duplicates: number;
      }>("/api/generate-batch", {
        method: "POST",
        body: JSON.stringify({ count: 50 }),
      });
      setLastResult(
        `Batch ${result.batchId.slice(0, 8)}... — ${result.accepted} accepted, ${result.rejected} rejected, ${result.duplicates} duplicates`
      );
      await loadData();
    } catch (err) {
      setLastResult(
        `Error: ${err instanceof Error ? err.message : "Unknown"}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefreshPool = async () => {
    setIsRefreshing(true);
    setLastResult(null);
    try {
      const result = await apiFetch<{
        triggered: boolean;
        lowCategories?: string[];
      }>("/api/refresh-pool", { method: "POST" });
      setLastResult(
        result.triggered
          ? `Triggered generation for: ${result.lowCategories?.join(", ")}`
          : "All categories above threshold"
      );
      await loadData();
    } catch (err) {
      setLastResult(
        `Error: ${err instanceof Error ? err.message : "Unknown"}`
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pt-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      {/* Pool status */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Question Pool
        </h2>
        <div className="space-y-2">
          {poolStatuses.map((s) => (
            <Card
              key={s.category}
              className={`flex items-center justify-between ${
                s.belowThreshold ? "border-warning" : ""
              }`}
            >
              <div>
                <CategoryBadge category={s.category} />
                {s.belowThreshold && (
                  <span className="ml-2 text-xs text-warning">
                    ⚠ Low
                  </span>
                )}
              </div>
              <div className="text-right text-sm">
                <p>
                  {s.unflagged}{" "}
                  <span className="text-text-secondary">active</span>
                </p>
                <p className="text-xs text-text-secondary">
                  {s.total} total
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          size="lg"
          loading={isGenerating}
          disabled={isGenerating || isRefreshing}
          onClick={handleGenerateBatch}
        >
          Generate 50 Questions
        </Button>

        <Button
          size="lg"
          variant="secondary"
          loading={isRefreshing}
          disabled={isGenerating || isRefreshing}
          onClick={handleRefreshPool}
        >
          Auto-Refresh Low Categories
        </Button>

        {lastResult && (
          <Card>
            <p className="text-sm">{lastResult}</p>
          </Card>
        )}
      </div>

      {/* Prompt version */}
      <Card>
        <p className="text-xs text-text-secondary">Prompt Version</p>
        <p className="text-sm font-mono">v1.0</p>
      </Card>

      {/* Recent batches */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Recent Batches
        </h2>
        <div className="space-y-2">
          {batches.map((b) => (
            <Card key={b.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {b.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-text-secondary">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-success">+{b.acceptedCount} accepted</p>
                  {b.rejectedCount > 0 && (
                    <p className="text-xs text-error">
                      {b.rejectedCount} rejected
                    </p>
                  )}
                  {b.duplicateCount > 0 && (
                    <p className="text-xs text-warning">
                      {b.duplicateCount} dupes
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                Status: {b.status} • Model: {b.model} • Prompt: {b.promptVersion}
              </p>
            </Card>
          ))}
          {batches.length === 0 && (
            <p className="text-sm text-text-secondary">
              No batches generated yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
