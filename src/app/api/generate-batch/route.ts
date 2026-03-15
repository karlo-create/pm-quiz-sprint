import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/firebase/auth-helpers";
import { getOpenAI, GENERATION_MODEL, PROMPT_VERSION } from "@/lib/openai/client";
import { buildBatchPrompt, BATCH_RESPONSE_SCHEMA } from "@/lib/openai/prompts";
import { generatedBatchSchema } from "@/lib/validation/schemas";
import { generateFingerprint } from "@/lib/utils";
import type { Question, QuestionBatch, QuestionCategory } from "@/types";

const ALL_CATEGORIES: QuestionCategory[] = [
  "product-management",
  "ai-pm",
  "tech-basics",
  "ux-ui",
];

export async function POST(req: NextRequest) {
  // Auth check — only admin can trigger generation
  const user = await verifyAuth(req);
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const categories = body.categories || ALL_CATEGORIES;
  const count = body.count || 50;

  // Create batch record
  const batchRef = adminDb.collection("question_batches").doc();
  const batchId = batchRef.id;

  const batch: QuestionBatch = {
    id: batchId,
    createdAt: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    model: GENERATION_MODEL,
    requestedCount: count,
    acceptedCount: 0,
    rejectedCount: 0,
    duplicateCount: 0,
    categories,
    status: "pending",
  };

  await batchRef.set(batch);

  try {
    // Fetch existing fingerprints for dedup
    const existingSnap = await adminDb
      .collection("questions")
      .select("fingerprint")
      .get();
    const existingFingerprints = existingSnap.docs.map(
      (d) => d.data().fingerprint as string
    );
    const fpSet = new Set(existingFingerprints);

    // Call OpenAI
    const prompt = buildBatchPrompt(categories, count, existingFingerprints);
    const openai = getOpenAI();
    const response = await openai.responses.create({
      model: GENERATION_MODEL,
      input: [{ role: "user", content: prompt }],
      text: {
        format: BATCH_RESPONSE_SCHEMA,
      },
    });

    const outputText = response.output_text;
    const parsed = JSON.parse(outputText);

    // Validate with Zod
    const validated = generatedBatchSchema.parse(parsed);

    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;
    const writeBatch = adminDb.batch();

    for (const q of validated.questions) {
      const fingerprint = generateFingerprint(q.questionText);

      // Check for duplicate
      if (fpSet.has(fingerprint)) {
        duplicates++;
        continue;
      }

      // Validate correctOption matches an actual option
      const optionIdx = { A: 0, B: 1, C: 2, D: 3 }[q.correctOption];
      if (!q.options[optionIdx]) {
        rejected++;
        continue;
      }

      const questionRef = adminDb.collection("questions").doc();
      const question: Question = {
        id: questionRef.id,
        category: q.category,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        questionText: q.questionText,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
        tags: q.tags,
        fingerprint,
        createdAt: new Date().toISOString(),
        batchId,
        globalTimesServed: 0,
        globalTimesCorrect: 0,
        globalTimesWrong: 0,
      };

      writeBatch.set(questionRef, question);
      fpSet.add(fingerprint);
      accepted++;
    }

    rejected += validated.questions.length - accepted - duplicates;

    await writeBatch.commit();

    // Update batch record
    await batchRef.update({
      status: "completed",
      acceptedCount: accepted,
      rejectedCount: rejected,
      duplicateCount: duplicates,
    });

    return NextResponse.json({
      batchId,
      requested: count,
      accepted,
      rejected,
      duplicates,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    await batchRef.update({
      status: "failed",
      errorMessage: message,
    });

    return NextResponse.json(
      { error: "Batch generation failed", details: message },
      { status: 500 }
    );
  }
}
