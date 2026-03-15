import { adminDb } from "@/lib/firebase/admin";
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

/**
 * Check if the user has seen >= threshold% of the question pool.
 * Returns true if a new batch should be generated.
 */
export async function shouldAutoGenerate(
  userId: string,
  totalQuestions: number,
  threshold = 0.9
): Promise<boolean> {
  if (totalQuestions === 0) return true;

  const progressSnap = await adminDb
    .collection(`users/${userId}/question_progress`)
    .where("timesSeen", ">", 0)
    .get();

  const seenCount = progressSnap.size;
  return seenCount >= totalQuestions * threshold;
}

/**
 * Generate a batch of questions via OpenAI and save to Firestore.
 * This is the same logic as the generate-batch API route but callable
 * internally without HTTP/auth overhead.
 */
export async function generateQuestionBatch(
  count = 50,
  categories: QuestionCategory[] = ALL_CATEGORIES
): Promise<{ accepted: number; duplicates: number; rejected: number }> {
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
  const validated = generatedBatchSchema.parse(parsed);

  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;
  const writeBatch = adminDb.batch();

  for (const q of validated.questions) {
    const fingerprint = generateFingerprint(q.questionText);

    if (fpSet.has(fingerprint)) {
      duplicates++;
      continue;
    }

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

  await batchRef.update({
    status: "completed",
    acceptedCount: accepted,
    rejectedCount: rejected,
    duplicateCount: duplicates,
  });

  console.log(
    `Auto-generated batch ${batchId}: ${accepted} accepted, ${rejected} rejected, ${duplicates} duplicates`
  );

  return { accepted, duplicates, rejected };
}
