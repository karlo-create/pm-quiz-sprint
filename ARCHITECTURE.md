# Architecture Summary

## System Overview

PM Quiz Sprint is a cache-first quiz application. Questions are pre-generated in batches via OpenAI and stored in Firestore. Quizzes are served entirely from the stored question bank — no LLM calls happen during quiz sessions.

```
┌────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client    │────▶│  Next.js API │────▶│  Firestore   │
│  (Browser)  │◀────│   Routes     │◀────│  (Questions, │
│             │     │  (Vercel)    │     │   Progress)  │
└────────────┘     └──────┬───────┘     └──────────────┘
                          │
                  Admin only, batch:
                          │
                   ┌──────▼───────┐
                   │  OpenAI API  │
                   │  (gpt-4o)    │
                   └──────────────┘
```

## Request Flow

### Quiz Session
1. User taps "Quick 5" on Home screen
2. Client POSTs to `/api/build-quiz` with auth token
3. Server reads all questions from Firestore + user's progress subcollection
4. Selection algorithm scores questions (spaced repetition, recency, error rate, category mix)
5. Server creates session document, returns question payloads (without correct answers)
6. For each question, user taps answer → client POSTs to `/api/submit-answer`
7. Server validates, updates session, progress, attempt docs in a batch write
8. Client receives correctness + explanation
9. After last question, client navigates to Results page

### Question Generation (Admin Only)
1. Admin clicks "Generate 50 Questions" on Admin page
2. Client POSTs to `/api/generate-batch` with auth token
3. Server verifies admin email, fetches existing fingerprints for dedup
4. Server calls OpenAI Responses API with structured JSON schema
5. Response validated with Zod, fingerprinted, deduplicated
6. Accepted questions saved to `questions/` collection
7. Batch metadata saved to `question_batches/` collection

## Spaced Repetition (SM-2 Variant)

Each `question_progress` document tracks:
- `easeFactor`: starts at 2.5, adjusted per answer quality
- `interval`: days until next review (1, 3, then interval × easeFactor)
- `nextEligibleAt`: ISO timestamp for next eligible review
- `streakCorrect`: consecutive correct answers
- `status`: new → learning → solid (or needs-review on wrong answer)

Wrong answers reset interval to 1 day. Correct answers extend interval based on ease factor, capped at 90 days.

## Question Selection Scoring

Each question gets a priority score based on:
- **+50**: Never seen (new question bonus)
- **+60**: High error rate (proportional)
- **+40**: Overdue for review (proportional to hours overdue)
- **+20**: Low exposure (seen ≤ 2 times)
- **-100**: Seen in last 4 hours
- **-30**: Seen in last 24 hours
- **-200**: Not yet eligible (proportional to hours remaining)
- **-30 to -50**: High streak (already mastered)
- **Weak spots mode**: +80 for needs-review, +40 for more wrong than right

After scoring, questions are distributed across categories per target weights, then interleaved by difficulty for variety.

## Security Model

- Firebase Auth tokens verified server-side via Admin SDK
- OpenAI API key only in server environment (never in client bundle)
- Firestore rules restrict users to their own data
- Admin actions gated by email check against `ADMIN_EMAIL` env var
- Question writes only via Admin SDK (rules deny client writes to questions)
