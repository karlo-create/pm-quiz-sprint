/**
 * Timezone-aware streak calculation with streak freeze support.
 * All date comparisons use the user's local timezone.
 */

/** Get today's date string (YYYY-MM-DD) in the given timezone. */
export function getLocalDateString(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA gives YYYY-MM-DD
}

/** Get the Monday of the current week in the given timezone. */
function getWeekStart(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localDate = new Date(formatter.format(now));
  const day = localDate.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  localDate.setDate(localDate.getDate() - diff);
  return localDate.toISOString().split("T")[0];
}

/** Calculate the difference in days between two YYYY-MM-DD strings. */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00Z");
  const b = new Date(dateB + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export interface StreakUpdate {
  currentStreak: number;
  longestStreak: number;
  lastQuizDate: string;
  streakFreezeUsedAt: string | null;
  streakFreezeWeekStart: string | null;
}

/**
 * Compute updated streak values after a quiz completion.
 * Call this when a quiz session is completed (not on every answer).
 */
export function computeStreakUpdate(
  currentStreak: number,
  longestStreak: number,
  lastQuizDate: string | null,
  streakFreezeUsedAt: string | null,
  streakFreezeWeekStart: string | null,
  timezone: string
): StreakUpdate {
  const today = getLocalDateString(timezone);
  const weekStart = getWeekStart(timezone);

  // Already played today — no streak change
  if (lastQuizDate === today) {
    return {
      currentStreak,
      longestStreak,
      lastQuizDate: today,
      streakFreezeUsedAt,
      streakFreezeWeekStart,
    };
  }

  let newStreak = currentStreak;
  let newFreezeUsedAt = streakFreezeUsedAt;
  let newFreezeWeekStart = streakFreezeWeekStart;

  if (!lastQuizDate) {
    // First quiz ever
    newStreak = 1;
  } else {
    const gap = daysBetween(lastQuizDate, today);

    if (gap === 1) {
      // Consecutive day — extend streak
      newStreak = currentStreak + 1;
    } else if (gap === 2) {
      // Missed exactly 1 day — try streak freeze
      const freezeAvailable =
        !streakFreezeUsedAt || streakFreezeWeekStart !== weekStart;

      if (freezeAvailable) {
        // Use the freeze: streak continues as if no day was missed
        newStreak = currentStreak + 1;
        newFreezeUsedAt = today;
        newFreezeWeekStart = weekStart;
      } else {
        // No freeze available — streak resets
        newStreak = 1;
      }
    } else {
      // Missed 2+ days — streak resets (freeze only covers 1 missed day)
      newStreak = 1;
    }
  }

  const newLongest = Math.max(longestStreak, newStreak);

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastQuizDate: today,
    streakFreezeUsedAt: newFreezeUsedAt,
    streakFreezeWeekStart: newFreezeWeekStart,
  };
}
