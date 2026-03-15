# Firestore Schema

## Collections

### `questions/{questionId}`

Pre-generated quiz questions. Written by Admin SDK only.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID |
| category | string | `product-management`, `ai-pm`, `tech-basics`, `ux-ui` |
| subCategory | string | e.g. "prioritization-frameworks", "ml-metrics" |
| difficulty | string | `easy`, `medium`, `hard` |
| questionText | string | The question |
| options | string[4] | Answer options A through D |
| correctOption | string | `A`, `B`, `C`, or `D` |
| explanation | string | Why the correct answer is correct |
| tags | string[] | Keyword tags for the question |
| fingerprint | string | SHA-256 hash of normalized question text (first 16 chars) |
| createdAt | string | ISO timestamp |
| batchId | string | Reference to the generation batch |
| flagged | boolean | Whether the question has been flagged |
| flagReason | string? | Why it was flagged |
| globalTimesServed | number | How many times served across all users |
| globalTimesCorrect | number | Global correct count |
| globalTimesWrong | number | Global wrong count |

### `question_batches/{batchId}`

Metadata for each question generation batch.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID |
| createdAt | string | ISO timestamp |
| promptVersion | string | Version of the generation prompt used |
| model | string | OpenAI model used |
| requestedCount | number | How many questions were requested |
| acceptedCount | number | How many passed validation and dedup |
| rejectedCount | number | How many failed validation |
| duplicateCount | number | How many were duplicates |
| categories | string[] | Categories included in the batch |
| status | string | `pending`, `completed`, `failed` |
| errorMessage | string? | Error details if failed |

### `users/{userId}`

User profile and aggregate stats.

| Field | Type | Description |
|-------|------|-------------|
| uid | string | Firebase Auth UID |
| displayName | string? | From Google profile |
| email | string? | From Google profile |
| photoURL | string? | From Google profile |
| createdAt | string | ISO timestamp |
| lastActiveAt | string | ISO timestamp |
| totalQuizzes | number | Completed quiz count |
| totalQuestions | number | Total questions answered |
| totalCorrect | number | Total correct answers |
| currentStreak | number | Consecutive days with activity |
| longestStreak | number | All-time longest streak |
| lastQuizDate | string? | YYYY-MM-DD of last completed quiz |

### `users/{userId}/question_progress/{questionId}`

Per-question learning progress for spaced repetition.

| Field | Type | Description |
|-------|------|-------------|
| questionId | string | Reference to question |
| userId | string | Reference to user |
| timesSeen | number | Total times seen |
| timesCorrect | number | Total correct answers |
| timesWrong | number | Total wrong answers |
| streakCorrect | number | Consecutive correct (resets on wrong) |
| easeFactor | number | SM-2 ease factor (default 2.5) |
| interval | number | Days until next review |
| lastSeenAt | string? | ISO timestamp |
| nextEligibleAt | string? | ISO timestamp for next eligible review |
| status | string | `new`, `learning`, `solid`, `needs-review` |

### `users/{userId}/quiz_sessions/{sessionId}`

Individual quiz session state.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID |
| userId | string | Reference to user |
| mode | string | `quick-5`, `standard-10`, `weak-spots` |
| questionIds | string[] | Ordered list of question IDs |
| currentIndex | number | Current question index |
| answers | map | questionId → SessionAnswer |
| startedAt | string | ISO timestamp |
| completedAt | string? | ISO timestamp |
| score | number | Correct answer count |
| totalQuestions | number | Total questions in session |
| status | string | `in-progress`, `completed`, `abandoned` |

### `users/{userId}/attempts/{attemptId}`

Individual answer attempts (immutable log).

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID |
| userId | string | Reference to user |
| questionId | string | Reference to question |
| sessionId | string | Reference to session |
| selectedOption | string | A, B, C, or D |
| correctOption | string | The correct answer |
| isCorrect | boolean | Whether the answer was correct |
| answeredAt | string | ISO timestamp |
| timeSpentMs | number | Milliseconds spent on the question |

### `analytics/daily_snapshots/{date}`

Aggregated daily analytics (written by server/cron).

| Field | Type | Description |
|-------|------|-------------|
| date | string | YYYY-MM-DD |
| dau | number | Daily active users |
| totalSessions | number | Sessions started |
| totalQuestions | number | Questions answered |
| completionRate | number | % of sessions completed |
| averageScore | number | Average score across sessions |
| avgQuestionsPerSession | number | Average questions per session |
| categoryAccuracy | map | Category → accuracy % |
| poolSize | map | Category → question count |
| newQuestionsAdded | number | Questions generated that day |
