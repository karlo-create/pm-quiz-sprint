// ─── Question Categories ───────────────────────────────────────────────────
export type QuestionCategory =
  | "product-management"
  | "ai-pm"
  | "tech-basics"
  | "ux-ui";

export type Difficulty = "easy" | "medium" | "hard";
export type AnswerOption = "A" | "B" | "C" | "D";

export const CATEGORY_WEIGHTS: Record<QuestionCategory, number> = {
  "product-management": 0.6,
  "ai-pm": 0.2,
  "tech-basics": 0.15,
  "ux-ui": 0.05,
};

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  "product-management": "Product Management",
  "ai-pm": "AI PM / AI Concepts",
  "tech-basics": "Tech / Coding / Architecture",
  "ux-ui": "UX / UI",
};

// ─── Firestore: questions/{questionId} ─────────────────────────────────────
export interface Question {
  id: string;
  category: QuestionCategory;
  subCategory: string;
  difficulty: Difficulty;
  questionText: string;
  options: [string, string, string, string];
  correctOption: AnswerOption;
  explanation: string;
  tags: string[];
  fingerprint: string; // normalized hash for dedup
  createdAt: string; // ISO timestamp
  batchId: string;
  flagged?: boolean;
  flagReason?: string;
  globalTimesServed?: number;
  globalTimesCorrect?: number;
  globalTimesWrong?: number;
}

// ─── Firestore: question_batches/{batchId} ─────────────────────────────────
export interface QuestionBatch {
  id: string;
  createdAt: string;
  promptVersion: string;
  model: string;
  requestedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  categories: QuestionCategory[];
  status: "pending" | "completed" | "failed";
  errorMessage?: string;
}

// ─── Firestore: users/{userId} ─────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: string;
  lastActiveAt: string;
  totalQuizzes: number;
  totalQuestions: number;
  totalCorrect: number;
  currentStreak: number;
  longestStreak: number;
  lastQuizDate: string | null; // YYYY-MM-DD in user's local timezone
  // Streak freeze: 1 free freeze per week
  streakFreezeUsedAt: string | null; // ISO date when freeze was last used
  streakFreezeWeekStart: string | null; // ISO date of the week the freeze belongs to
  // Daily goal tracking
  dailyGoalProgress: number; // questions answered today
  dailyGoalDate: string | null; // YYYY-MM-DD in user's local timezone
  dailyGoalCompleted: boolean; // whether today's goal was met
  // Timezone
  timezone: string | null; // IANA timezone string e.g. "Europe/Zagreb"
  // Achievement badges
  badges: string[]; // array of earned badge IDs
  badgesLastCheckedAt: string | null;
}

// ─── Firestore: users/{userId}/question_progress/{questionId} ──────────────
export interface QuestionProgress {
  questionId: string;
  userId: string;
  timesSeen: number;
  timesCorrect: number;
  timesWrong: number;
  streakCorrect: number;
  easeFactor: number; // SM-2 ease factor, starts at 2.5
  interval: number; // days until next review
  lastSeenAt: string | null;
  nextEligibleAt: string | null;
  status: "new" | "learning" | "solid" | "needs-review";
}

// ─── Firestore: users/{userId}/quiz_sessions/{sessionId} ───────────────────
export type QuizMode = "quick-5" | "standard-10" | "weak-spots";

export interface QuizSession {
  id: string;
  userId: string;
  mode: QuizMode;
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, SessionAnswer>;
  startedAt: string;
  completedAt: string | null;
  score: number;
  totalQuestions: number;
  status: "in-progress" | "completed" | "abandoned";
}

export interface SessionAnswer {
  questionId: string;
  selectedOption: AnswerOption;
  isCorrect: boolean;
  answeredAt: string;
  timeSpentMs: number;
}

// ─── Firestore: users/{userId}/attempts/{attemptId} ────────────────────────
export interface Attempt {
  id: string;
  userId: string;
  questionId: string;
  sessionId: string;
  selectedOption: AnswerOption;
  correctOption: AnswerOption;
  isCorrect: boolean;
  answeredAt: string;
  timeSpentMs: number;
}

// ─── Firestore: analytics/daily_snapshots/{date} ──────────────────────────
export interface DailySnapshot {
  date: string; // YYYY-MM-DD
  dau: number;
  totalSessions: number;
  totalQuestions: number;
  completionRate: number;
  averageScore: number;
  avgQuestionsPerSession: number;
  categoryAccuracy: Record<QuestionCategory, number>;
  poolSize: Record<QuestionCategory, number>;
  newQuestionsAdded: number;
}

// ─── API Request/Response types ────────────────────────────────────────────
export interface BuildQuizRequest {
  mode: QuizMode;
}

export interface BuildQuizResponse {
  sessionId: string;
  questions: QuizQuestionPayload[];
}

export interface QuizQuestionPayload {
  id: string;
  category: QuestionCategory;
  subCategory: string;
  difficulty: Difficulty;
  questionText: string;
  options: [string, string, string, string];
  tags: string[];
}

export interface SubmitAnswerRequest {
  sessionId: string;
  questionId: string;
  selectedOption: AnswerOption;
  timeSpentMs: number;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctOption: AnswerOption;
  explanation: string;
  sessionProgress: {
    currentIndex: number;
    totalQuestions: number;
    score: number;
  };
  dailyGoalProgress?: number;
  dailyGoalTarget?: number;
  dailyGoalJustCompleted?: boolean;
  newBadges?: string[];
}

export interface GenerateBatchRequest {
  categories?: QuestionCategory[];
  count?: number;
}

export interface PoolStatus {
  category: QuestionCategory;
  total: number;
  unflagged: number;
  belowThreshold: boolean;
}
