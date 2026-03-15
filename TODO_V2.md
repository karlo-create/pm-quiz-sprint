# V2 Improvements

## High Priority

- [ ] **Session recovery**: Read existing session from Firestore on quiz page load instead of creating a new one. Currently the quiz page always starts a fresh session.
- [ ] **Streak calculation**: Implement proper daily streak tracking with timezone-aware date comparison. Currently only incremented server-side on quiz completion.
- [ ] **Category-aware stats**: Join question_progress with questions collection to show per-category accuracy on the Stats page.
- [ ] **Offline support**: Service worker + IndexedDB cache for questions so quizzes work without network.
- [ ] **PWA manifest**: Add full PWA support with app icon, splash screen, and install prompt.

## Medium Priority

- [ ] **7-day and 30-day accuracy trends**: Track daily accuracy snapshots and render line charts on the Stats page.
- [ ] **Question flagging from quiz**: Let the user flag a question as incorrect/confusing directly from the quiz or results screen.
- [ ] **Question review screen**: After results, show full question text + explanation for wrong answers (not just question IDs).
- [ ] **Timed mode**: Add a countdown timer option (e.g. 30 seconds per question).
- [ ] **Daily challenge**: A shared set of 5 questions everyone gets, with a daily leaderboard.
- [ ] **Haptic feedback**: Use the Vibration API for correct/incorrect answer feedback on mobile.
- [ ] **Animations**: Add smooth transitions between questions (slide, fade).
- [ ] **Sound effects**: Optional correct/incorrect sounds.

## Low Priority

- [ ] **Multiple users**: Add leaderboard, friend comparisons.
- [ ] **Custom categories**: Let the admin add new categories and subcategories.
- [ ] **Question editing**: Admin UI for editing question text, options, explanations.
- [ ] **Batch scheduling**: Auto-trigger question generation via Vercel Cron when pool is low.
- [ ] **Export data**: Export quiz history and progress as CSV.
- [ ] **Analytics dashboard**: Full admin analytics with DAU/WAU charts, retention, pool freshness.
- [ ] **Dark mode toggle**: Manual dark/light mode switch (currently follows system preference).
- [ ] **Semantic deduplication**: Use embeddings to detect semantically similar questions, not just text hash.
- [ ] **Difficulty calibration**: Adjust question difficulty based on global correct/wrong rates.
- [ ] **Prompt versioning UI**: Show prompt diff between versions in admin, allow A/B testing.
- [ ] **Rate limiting**: Add rate limits to API routes to prevent abuse.
- [ ] **Error boundaries**: Add React error boundaries for graceful error handling in UI.

## Technical Debt

- [ ] Remove unused `CATEGORY_WEIGHTS` import in `selection.ts`
- [ ] Add proper error handling for Firestore permission errors on client
- [ ] Add loading skeletons instead of spinners
- [ ] Add unit tests for spaced repetition and selection algorithms
- [ ] Add E2E tests with Playwright
- [ ] Set up CI/CD pipeline
