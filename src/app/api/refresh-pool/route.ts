import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/firebase/auth-helpers";
import type { QuestionCategory, PoolStatus } from "@/types";

const CATEGORY_THRESHOLDS: Record<QuestionCategory, number> = {
  "product-management": 100,
  "ai-pm": 40,
  "tech-basics": 30,
  "ux-ui": 15,
};

const ALL_CATEGORIES: QuestionCategory[] = [
  "product-management",
  "ai-pm",
  "tech-basics",
  "ux-ui",
];

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const statuses: PoolStatus[] = [];

    for (const category of ALL_CATEGORIES) {
      const snap = await adminDb
        .collection("questions")
        .where("category", "==", category)
        .get();

      const total = snap.size;
      const unflagged = snap.docs.filter(
        (d) => !d.data().flagged
      ).length;

      statuses.push({
        category,
        total,
        unflagged,
        belowThreshold: unflagged < CATEGORY_THRESHOLDS[category],
      });
    }

    const needsRefresh = statuses.some((s) => s.belowThreshold);

    return NextResponse.json({
      statuses,
      needsRefresh,
      thresholds: CATEGORY_THRESHOLDS,
    });
  } catch (error) {
    console.error("Refresh pool check error:", error);
    return NextResponse.json(
      { error: "Failed to check pool status" },
      { status: 500 }
    );
  }
}

// POST triggers a batch generation for under-threshold categories
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lowCategories: QuestionCategory[] = [];

    for (const category of ALL_CATEGORIES) {
      const snap = await adminDb
        .collection("questions")
        .where("category", "==", category)
        .where("flagged", "in", [false, null])
        .get();

      if (snap.size < CATEGORY_THRESHOLDS[category]) {
        lowCategories.push(category);
      }
    }

    if (lowCategories.length === 0) {
      return NextResponse.json({
        message: "All categories are above threshold",
        triggered: false,
      });
    }

    // Trigger generation by calling our own endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const authHeader = req.headers.get("authorization") || "";

    const genResponse = await fetch(`${baseUrl}/api/generate-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        categories: lowCategories,
        count: 50,
      }),
    });

    const result = await genResponse.json();

    return NextResponse.json({
      triggered: true,
      lowCategories,
      generationResult: result,
    });
  } catch (error) {
    console.error("Refresh pool trigger error:", error);
    return NextResponse.json(
      { error: "Failed to trigger pool refresh" },
      { status: 500 }
    );
  }
}
