import { z } from "zod";

export const questionCategorySchema = z.enum([
  "product-management",
  "ai-pm",
  "tech-basics",
  "ux-ui",
]);

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const answerOptionSchema = z.enum(["A", "B", "C", "D"]);

// Schema for a single generated question from OpenAI
export const generatedQuestionSchema = z.object({
  category: questionCategorySchema,
  subCategory: z.string().min(1).max(100),
  difficulty: difficultySchema,
  questionText: z.string().min(10).max(1000),
  options: z.tuple([
    z.string().min(1).max(500),
    z.string().min(1).max(500),
    z.string().min(1).max(500),
    z.string().min(1).max(500),
  ]),
  correctOption: answerOptionSchema,
  explanation: z.string().min(10).max(2000),
  tags: z.array(z.string().min(1).max(50)).min(1).max(10),
});

// Schema for the full batch response from OpenAI
export const generatedBatchSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(100),
});

// API request schemas
export const buildQuizRequestSchema = z.object({
  mode: z.enum(["quick-5", "standard-10", "weak-spots"]),
});

export const submitAnswerRequestSchema = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOption: answerOptionSchema,
  timeSpentMs: z.number().int().min(0).max(300000), // max 5 min
});

export const generateBatchRequestSchema = z.object({
  categories: z.array(questionCategorySchema).optional(),
  count: z.number().int().min(5).max(100).optional(),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedBatch = z.infer<typeof generatedBatchSchema>;
